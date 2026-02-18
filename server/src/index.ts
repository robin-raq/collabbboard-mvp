/**
 * CollabBoard WebSocket Server
 *
 * A minimal Yjs document relay with room isolation.
 * No database — documents live in memory and are lost on restart.
 *
 * Responsibilities:
 *  - Accept WebSocket connections on /<room-name>
 *  - Maintain an in-memory Y.Doc per room
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '1234', 10)
const MSG_YJS = 0

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** In-memory Y.Doc per room. Lost on server restart (persistence = Week 2). */
const docs = new Map<string, Y.Doc>()

/** Maps each socket to its room name for targeted broadcasting. */
const socketRooms = new Map<WebSocket, string>()

function getOrCreateDoc(room: string): Y.Doc {
  if (!docs.has(room)) {
    console.log(`[WS] Creating new YDoc for room: ${room}`)
    docs.set(room, new Y.Doc())
  }
  return docs.get(room)!
}

// ---------------------------------------------------------------------------
// HTTP server (health check only)
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  res.writeHead(200)
  res.end('CollabBoard y-websocket server')
})

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const room = req.url?.slice(1) || 'default'
  console.log(`[WS] New connection to room: ${room}`)

  const doc = getOrCreateDoc(room)
  socketRooms.set(ws, room)

  // Send current document state to the new client
  const state = Y.encodeStateAsUpdate(doc)
  const initMsg = new Uint8Array(1 + state.length)
  initMsg[0] = MSG_YJS
  initMsg.set(state, 1)
  ws.send(initMsg)
  console.log(`[WS] Sent initial state (${state.byteLength} bytes)`)

  ws.on('message', (raw: Buffer) => {
    try {
      const data = new Uint8Array(raw)
      if (data.length < 2) return

      const msgType = data[0]
      const payload = data.slice(1)

      // Apply Yjs updates to the server-side doc (keeps state for new clients)
      if (msgType === MSG_YJS) {
        Y.applyUpdate(doc, payload, 'remote')
        console.log(`[WS] Applied Yjs update (${payload.byteLength} bytes)`)
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
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[WS] y-websocket server running on :${PORT}`)
})
