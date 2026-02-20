/**
 * CollabBoard WebSocket Server
 *
 * A Yjs document relay with room isolation and Supabase persistence.
 *
 * Responsibilities:
 *  - Accept WebSocket connections on /<room-name>
 *  - Maintain an in-memory Y.Doc per room
 *  - Restore docs from Supabase on first access
 *  - Snapshot dirty docs to Supabase every 30 seconds
 *  - Send the full document state to new clients on connect
 *  - Apply incoming Yjs updates to the server-side doc
 *  - Broadcast all messages (Yjs updates + awareness) to other clients in the room
 *
 * Wire protocol (same as client):
 *   byte[0]  = 0 (Yjs update) | 1 (awareness)
 *   byte[1:] = payload
 */

import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as Y from 'yjs'
import { supabase } from './db/supabase.js'
import { processAICommand } from './aiHandler.js'
import { flushTraces, isLangfuseEnabled } from './langfuse.js'
import {
  isOriginAllowed,
  getCorsOrigin,
  isMessageSizeValid,
  shouldRejectUpdate,
  isValidRoomName,
  isAIMessageValid,
  MAX_WS_MESSAGE_SIZE,
} from './security.js'
import {
  handleListBoards,
  handleCreateBoard,
  handleRenameBoard,
  handleDeleteBoard,
} from './routes/boards.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '1234', 10)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? ''
const MSG_YJS = 0
const SNAPSHOT_INTERVAL_MS = 30_000   // 30 seconds
const ROOM_IDLE_TIMEOUT_MS = 3_600_000 // 1 hour — evict idle rooms to free memory
const EVICTION_CHECK_MS = 300_000      // 5 minutes — how often to check for idle rooms

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** In-memory Y.Doc per room. Restored from Supabase on first access. */
const docs = new Map<string, Y.Doc>()

/** Rooms currently being loaded from Supabase (prevents duplicate loads). */
const loadingDocs = new Map<string, Promise<Y.Doc>>()

/** Maps each socket to its room name for targeted broadcasting. */
const socketRooms = new Map<WebSocket, string>()

/** Tracks rooms that have been modified since last snapshot. */
const dirtyRooms = new Set<string>()

/** Last activity timestamp per room (for idle eviction). */
const roomLastActive = new Map<string, number>()

// ---------------------------------------------------------------------------
// Supabase Persistence
// ---------------------------------------------------------------------------

/**
 * Load a snapshot from Supabase and apply it to a fresh Y.Doc.
 */
async function loadDocFromSupabase(room: string): Promise<Y.Doc> {
  const doc = new Y.Doc()

  if (!supabase) {
    console.log(`[DB] No Supabase — creating empty doc for room: ${room}`)
    return doc
  }

  try {
    const { data, error } = await supabase
      .from('board_snapshots')
      .select('snapshot')
      .eq('board_id', room)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" — that's fine for new boards
      console.error(`[DB] Error loading snapshot for ${room}:`, error.message)
    }

    if (data?.snapshot) {
      const binary = Buffer.from(data.snapshot, 'base64')
      Y.applyUpdate(doc, new Uint8Array(binary))
      console.log(`[DB] Restored snapshot for room: ${room} (${binary.length} bytes)`)
    } else {
      console.log(`[DB] No existing snapshot for room: ${room} — starting fresh`)
    }
  } catch (err) {
    console.error(`[DB] Failed to load snapshot for ${room}:`, err)
  }

  return doc
}

/**
 * Save a Y.Doc snapshot to Supabase.
 */
async function saveDocToSupabase(room: string, doc: Y.Doc): Promise<void> {
  if (!supabase) return

  try {
    const state = Y.encodeStateAsUpdate(doc)
    const snapshot = Buffer.from(state).toString('base64')

    const { error } = await supabase
      .from('board_snapshots')
      .upsert(
        { board_id: room, snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'board_id' }
      )

    if (error) {
      console.error(`[DB] Error saving snapshot for ${room}:`, error.message)
    } else {
      console.log(`[DB] Saved snapshot for room: ${room} (${state.byteLength} bytes)`)
    }
  } catch (err) {
    console.error(`[DB] Failed to save snapshot for ${room}:`, err)
  }
}

/**
 * Register a Y.Doc 'update' listener that broadcasts server-side mutations
 * (e.g., from the AI handler) to all connected WebSocket clients in the room.
 *
 * Client-originated updates (origin === 'remote') are already relayed in the
 * ws.on('message') handler, so we skip those here to avoid double-sending.
 */
function registerDocUpdateListener(room: string, doc: Y.Doc): void {
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    // Only broadcast server-side (local) mutations — not client relays
    if (origin === 'remote') return

    const msg = new Uint8Array(1 + update.length)
    msg[0] = MSG_YJS
    msg.set(update, 1)

    let sent = 0
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && socketRooms.get(client) === room) {
        client.send(msg)
        sent++
      }
    }

    if (sent > 0) {
      console.log(`[WS] Broadcast server-side update to ${sent} client(s) in room: ${room}`)
    }
  })
}

/**
 * Get or create a Y.Doc for a room. Loads from Supabase on first access.
 * Uses a loading lock to prevent duplicate loads for the same room.
 */
async function getOrCreateDoc(room: string): Promise<Y.Doc> {
  // Already in memory
  if (docs.has(room)) {
    return docs.get(room)!
  }

  // Already loading — wait for it
  if (loadingDocs.has(room)) {
    return loadingDocs.get(room)!
  }

  // Start loading
  const loadPromise = loadDocFromSupabase(room).then((doc) => {
    docs.set(room, doc)
    loadingDocs.delete(room)
    roomLastActive.set(room, Date.now())
    // Register listener to broadcast server-side mutations to WS clients
    registerDocUpdateListener(room, doc)
    return doc
  })
  loadingDocs.set(room, loadPromise)
  return loadPromise
}

/**
 * Periodically snapshot all dirty docs to Supabase.
 */
function startSnapshotInterval(): void {
  setInterval(async () => {
    if (dirtyRooms.size === 0) return

    const roomsToSave = [...dirtyRooms]
    dirtyRooms.clear()

    console.log(`[DB] Snapshotting ${roomsToSave.length} dirty room(s)...`)

    for (const room of roomsToSave) {
      const doc = docs.get(room)
      if (doc) {
        await saveDocToSupabase(room, doc)
      }
    }
  }, SNAPSHOT_INTERVAL_MS)
}

// ---------------------------------------------------------------------------
// HTTP server (health check + AI endpoint)
// ---------------------------------------------------------------------------

/** Read the full request body as a string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  // CORS — restrict to allowed origins when configured
  const origin = req.headers.origin
  const corsOrigin = getCorsOrigin(origin, ALLOWED_ORIGINS)

  if (!corsOrigin) {
    // Origin not allowed
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Origin not allowed' }))
    return
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (corsOrigin !== '*') {
    res.setHeader('Vary', 'Origin')
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // -----------------------------------------------------------------------
  // Board CRUD REST API — /api/boards
  // -----------------------------------------------------------------------

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const pathname = url.pathname

  if (pathname === '/api/boards' && req.method === 'GET') {
    await handleListBoards(req, res)
    return
  }

  if (pathname === '/api/boards' && req.method === 'POST') {
    const body = await readBody(req)
    await handleCreateBoard(req, res, body)
    return
  }

  // PATCH /api/boards/:id — Rename
  const patchMatch = pathname.match(/^\/api\/boards\/([a-f0-9-]+)$/)
  if (patchMatch && req.method === 'PATCH') {
    const body = await readBody(req)
    await handleRenameBoard(req, res, patchMatch[1], body)
    return
  }

  // DELETE /api/boards/:id — Delete
  const deleteMatch = pathname.match(/^\/api\/boards\/([a-f0-9-]+)$/)
  if (deleteMatch && req.method === 'DELETE') {
    await handleDeleteBoard(req, res, deleteMatch[1])
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: docs.size,
      persistence: supabase ? 'supabase' : 'none',
      langfuseEnabled: isLangfuseEnabled(),
    }))
    return
  }

  // POST /api/clear — Clear all objects from a board (dev/testing only)
  if (req.method === 'POST' && req.url === '/api/clear') {
    try {
      const room = 'mvp-board-1'
      const doc = await getOrCreateDoc(room)
      const objectsMap = doc.getMap('objects')
      const keys = Array.from(objectsMap.keys())
      doc.transact(() => {
        for (const key of keys) {
          objectsMap.delete(key)
        }
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, deleted: keys.length }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
    return
  }

  // POST /api/ai — Process AI commands
  if (req.method === 'POST' && req.url === '/api/ai') {
    try {
      const body = JSON.parse(await readBody(req))
      const { message, boardId } = body

      if (!isAIMessageValid(message)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid message: must be 1-2000 characters' }))
        return
      }

      const roomId = boardId || 'mvp-board-1'
      const doc = await getOrCreateDoc(roomId)

      console.log(`[AI] Processing command for room ${roomId}: "${message.slice(0, 80)}"`)

      const result = await processAICommand(message, doc, { boardId: roomId })

      // Mark room as dirty so the snapshot interval will save it
      dirtyRooms.add(roomId)

      console.log(`[AI] Completed: ${result.actions.length} action(s)`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err) {
      console.error('[AI] Error processing command:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'AI processing failed', details: String(err) }))
    }
    return
  }

  res.writeHead(200)
  res.end('CollabBoard y-websocket server')
})

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({
  server,
  perMessageDeflate: true, // ~70% compression on Yjs binary payloads
})

wss.on('connection', async (ws, req) => {
  // Parse room name and optional auth token from URL: /<room>?token=<jwt>
  const wsUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const room = wsUrl.pathname.slice(1) || 'default'
  const _wsToken = wsUrl.searchParams.get('token') // Auth token for future use

  // Validate room name
  if (!isValidRoomName(room)) {
    console.warn(`[WS] Rejected connection — invalid room name: "${room}"`)
    ws.close(1008, 'Invalid room name')
    return
  }

  // Validate origin (if ALLOWED_ORIGINS is set)
  const wsOrigin = req.headers.origin
  if (!isOriginAllowed(wsOrigin, ALLOWED_ORIGINS)) {
    console.warn(`[WS] Rejected connection — origin not allowed: ${wsOrigin}`)
    ws.close(1008, 'Origin not allowed')
    return
  }

  console.log(`[WS] New connection to room: ${room}`)

  socketRooms.set(ws, room)
  roomLastActive.set(room, Date.now())

  // Queue messages that arrive while the doc is loading from Supabase
  const pendingMessages: Uint8Array[] = []
  let docReady = false
  let doc: Y.Doc

  // Register message handler BEFORE async doc load to avoid dropping messages
  ws.on('message', (raw: Buffer) => {
    try {
      const data = new Uint8Array(raw)
      if (data.length < 2) return

      // Reject oversized messages
      if (!isMessageSizeValid(data)) {
        console.warn(`[WS] Rejected message from room ${room}: ${data.byteLength} bytes exceeds ${MAX_WS_MESSAGE_SIZE}`)
        return
      }

      if (!docReady) {
        pendingMessages.push(data)
        return
      }

      const msgType = data[0]
      const payload = data.slice(1)

      // Apply Yjs updates to the server-side doc (keeps state for new clients)
      if (msgType === MSG_YJS) {
        // Preemptive check: reject if board is already at the object limit
        if (shouldRejectUpdate(doc)) {
          console.warn(`[WS] Rejected update for room ${room}: object limit reached`)
          return
        }

        Y.applyUpdate(doc, payload, 'remote')
        dirtyRooms.add(room)
        roomLastActive.set(room, Date.now())
      }

      // Broadcast to all other clients in the same room
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN && socketRooms.get(client) === room) {
          client.send(data)
        }
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err)
    }
  })

  ws.on('close', () => {
    console.log(`[WS] Client disconnected from room: ${room}`)
    socketRooms.delete(ws)
  })

  // Load doc (may be async if fetching from Supabase)
  doc = await getOrCreateDoc(room)
  docReady = true

  // Process any messages that arrived while loading
  for (const data of pendingMessages) {
    const msgType = data[0]
    const payload = data.slice(1)

    if (msgType === MSG_YJS) {
      Y.applyUpdate(doc, payload, 'remote')
      dirtyRooms.add(room)
    }

    // Broadcast queued messages to other clients
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN && socketRooms.get(client) === room) {
        client.send(data)
      }
    }
  }

  // Send current document state to the new client
  const state = Y.encodeStateAsUpdate(doc)
  const initMsg = new Uint8Array(1 + state.length)
  initMsg[0] = MSG_YJS
  initMsg.set(state, 1)

  // Client may have disconnected while we were loading the doc
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(initMsg)
    console.log(`[WS] Sent initial state (${state.byteLength} bytes)`)
  }
})

// ---------------------------------------------------------------------------
// Room Eviction — clean up idle rooms to free memory
// ---------------------------------------------------------------------------

/**
 * Check all rooms for idle timeout and evict them.
 * Before evicting, saves dirty docs to Supabase.
 */
function evictIdleRooms(): void {
  const now = Date.now()
  for (const [room, lastTime] of roomLastActive) {
    if (now - lastTime > ROOM_IDLE_TIMEOUT_MS) {
      // Check if any clients are still connected to this room
      let hasClients = false
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && socketRooms.get(client) === room) {
          hasClients = true
          break
        }
      }

      // Don't evict rooms with active connections
      if (hasClients) {
        roomLastActive.set(room, now)
        continue
      }

      const doc = docs.get(room)
      if (doc) {
        // Save before evicting if dirty
        if (dirtyRooms.has(room)) {
          dirtyRooms.delete(room)
          saveDocToSupabase(room, doc).catch((err) => {
            console.error(`[EVICT] Failed to save room ${room} before eviction:`, err)
          })
        }
        doc.destroy()
      }
      docs.delete(room)
      loadingDocs.delete(room)
      roomLastActive.delete(room)
      console.log(`[EVICT] Evicted idle room: ${room}`)
    }
  }
}

/**
 * Start periodic eviction of idle rooms.
 */
function startEvictionInterval(): void {
  setInterval(() => {
    if (roomLastActive.size === 0) return
    evictIdleRooms()
  }, EVICTION_CHECK_MS)
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

startSnapshotInterval()
startEvictionInterval()

// ---------------------------------------------------------------------------
// Graceful Shutdown — flush Langfuse traces before exit
// ---------------------------------------------------------------------------

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`)

  // Flush pending Langfuse traces
  try {
    await flushTraces()
    console.log('[Langfuse] Flushed pending traces')
  } catch (err) {
    console.error('[Langfuse] Error flushing traces:', err)
  }

  // Save dirty rooms before exiting
  for (const room of dirtyRooms) {
    const doc = docs.get(room)
    if (doc) {
      await saveDocToSupabase(room, doc)
    }
  }
  dirtyRooms.clear()

  process.exit(0)
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM') })
process.on('SIGINT', () => { gracefulShutdown('SIGINT') })

server.listen(PORT, () => {
  console.log(`[WS] y-websocket server running on :${PORT}`)
  console.log(`[WS] Persistence: ${supabase ? 'Supabase' : 'DISABLED (no env vars)'}`)
  console.log(`[WS] Langfuse: ${isLangfuseEnabled() ? 'ENABLED' : 'DISABLED (no env vars)'}`)
  console.log(`[WS] Snapshot interval: ${SNAPSHOT_INTERVAL_MS / 1000}s`)
  console.log(`[WS] Room eviction: idle >${ROOM_IDLE_TIMEOUT_MS / 60_000}m, check every ${EVICTION_CHECK_MS / 60_000}m`)
})
