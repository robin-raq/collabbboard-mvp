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
import {
  isOriginAllowed,
  getCorsOrigin,
  isMessageSizeValid,
  canAddObject,
  isValidRoomName,
  isAIMessageValid,
  MAX_WS_MESSAGE_SIZE,
  MAX_OBJECTS_PER_BOARD,
} from './security.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '1234', 10)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? ''
const MSG_YJS = 0
const SNAPSHOT_INTERVAL_MS = 30_000 // 30 seconds

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (corsOrigin !== '*') {
    res.setHeader('Vary', 'Origin')
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: docs.size,
      persistence: supabase ? 'supabase' : 'none',
    }))
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

      const result = await processAICommand(message, doc)

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

const wss = new WebSocketServer({ server })

wss.on('connection', async (ws, req) => {
  const room = req.url?.slice(1) || 'default'

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
        // Check object count before applying
        const objectsMap = doc.getMap('objects')
        const countBefore = objectsMap.size

        Y.applyUpdate(doc, payload, 'remote')
        dirtyRooms.add(room)

        // If update pushed past the object limit, log a warning
        if (!canAddObject(countBefore) && objectsMap.size > countBefore) {
          console.warn(`[WS] Room ${room} has ${objectsMap.size} objects — exceeds limit of ${MAX_OBJECTS_PER_BOARD}`)
        }
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
// Start
// ---------------------------------------------------------------------------

startSnapshotInterval()

server.listen(PORT, () => {
  console.log(`[WS] y-websocket server running on :${PORT}`)
  console.log(`[WS] Persistence: ${supabase ? 'Supabase' : 'DISABLED (no env vars)'}`)
  console.log(`[WS] Snapshot interval: ${SNAPSHOT_INTERVAL_MS / 1000}s`)
})
