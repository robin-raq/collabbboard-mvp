import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as Y from 'yjs'

const PORT = parseInt(process.env.PORT ?? '1234', 10)

// Message types: 0 = yjs update, 1 = awareness
const MSG_YJS = 0

// In-memory YDoc per room
const docs = new Map<string, Y.Doc>()

function getDoc(room: string): Y.Doc {
  if (!docs.has(room)) {
    console.log(`[WS] Creating new YDoc for room: ${room}`)
    docs.set(room, new Y.Doc())
  }
  return docs.get(room)!
}

// Track which sockets belong to which rooms
const socketRooms = new Map<WebSocket, string>()

const server = http.createServer((_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  res.writeHead(200)
  res.end('y-websocket server')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  // Room name from URL path: /<roomname>
  const room = req.url?.slice(1) || 'default'
  console.log(`[WS] New connection to room: ${room}`)

  const doc = getDoc(room)
  socketRooms.set(ws, room)

  // Send current document state to the new client (prefixed with MSG_YJS)
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

      if (msgType === MSG_YJS) {
        // Apply Yjs update to server doc
        Y.applyUpdate(doc, payload, 'remote')
        console.log(`[WS] Applied Yjs update (${payload.byteLength} bytes)`)
      }

      // Broadcast entire message (yjs or awareness) to other clients in room
      wss.clients.forEach((client) => {
        if (
          client !== ws &&
          client.readyState === WebSocket.OPEN &&
          socketRooms.get(client) === room
        ) {
          client.send(data)
        }
      })
    } catch (err) {
      console.error('[WS] Error processing message:', err)
    }
  })

  ws.on('close', () => {
    console.log(`[WS] Client disconnected from room: ${room}`)
    socketRooms.delete(ws)
  })
})

server.listen(PORT, () => {
  console.log(`[WS] y-websocket server running on :${PORT}`)
})
