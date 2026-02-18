/**
 * Server Integration Tests
 *
 * Tests the WebSocket relay server behavior:
 *  - Health check endpoint
 *  - New client receives initial document state
 *  - Updates broadcast to other clients in the same room
 *  - Room isolation (room A doesn't leak to room B)
 *
 * Spins up the actual HTTP + WebSocket server on a random port,
 * then connects real WebSocket clients to verify end-to-end behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as Y from 'yjs'

const MSG_YJS = 0
const MSG_AWARENESS = 1

// ---------------------------------------------------------------------------
// Test server (mirrors server/src/index.ts)
// ---------------------------------------------------------------------------

let server: http.Server
let wss: WebSocketServer
let port: number
const docs = new Map<string, Y.Doc>()
const socketRooms = new Map<WebSocket, string>()

function getOrCreateDoc(room: string): Y.Doc {
  if (!docs.has(room)) {
    docs.set(room, new Y.Doc())
  }
  return docs.get(room)!
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok' }))
          return
        }
        res.writeHead(200)
        res.end('test server')
      })

      wss = new WebSocketServer({ server })

      wss.on('connection', (ws, req) => {
        const room = req.url?.slice(1) || 'default'
        const doc = getOrCreateDoc(room)
        socketRooms.set(ws, room)

        // Send initial state
        const state = Y.encodeStateAsUpdate(doc)
        const initMsg = new Uint8Array(1 + state.length)
        initMsg[0] = MSG_YJS
        initMsg.set(state, 1)
        ws.send(initMsg)

        ws.on('message', (raw: ArrayBuffer | Buffer) => {
          const data = new Uint8Array(raw instanceof ArrayBuffer ? raw : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
          if (data.length < 2) return
          const msgType = data[0]
          const payload = data.slice(1)

          if (msgType === MSG_YJS) {
            Y.applyUpdate(doc, payload, 'remote')
          }

          for (const client of wss.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN && socketRooms.get(client) === room) {
              client.send(data)
            }
          }
        })

        ws.on('close', () => {
          socketRooms.delete(ws)
        })
      })

      server.listen(0, () => {
        const addr = server.address()
        port = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    }),
)

afterAll(
  () =>
    new Promise<void>((resolve) => {
      for (const client of wss.clients) {
        client.close()
      }
      wss.close()
      server.close(() => resolve())
    }),
)

// ---------------------------------------------------------------------------
// Helpers — queue-based message handling to avoid race conditions
// ---------------------------------------------------------------------------

interface TestClient {
  ws: WebSocket
  messages: Uint8Array[]
  close: () => void
}

/**
 * Connect a WebSocket client and immediately start queuing all messages.
 * This avoids the race condition where the initial state arrives before
 * a `waitForMessage` listener is attached.
 */
function connectClient(room: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/${room}`)
    const messages: Uint8Array[] = []
    const waiters: Array<(msg: Uint8Array) => void> = []

    ws.on('message', (raw: Buffer) => {
      const data = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
      // If someone is waiting for a message, deliver immediately
      const waiter = waiters.shift()
      if (waiter) {
        waiter(data)
      } else {
        messages.push(data)
      }
    })

    ws.on('open', () => {
      const client: TestClient = {
        ws,
        messages,
        close: () => ws.close(),
      }

      // Attach a waitForMessage method
      ;(client as any).waitForMessage = (): Promise<Uint8Array> => {
        // Check if there's already a queued message
        const queued = messages.shift()
        if (queued) return Promise.resolve(queued)
        // Otherwise wait for the next one
        return new Promise((res) => waiters.push(res))
      }

      resolve(client)
    })

    ws.on('error', reject)
  })
}

/** Pull the next message from a test client (waits if none available yet) */
function waitForMessage(client: TestClient): Promise<Uint8Array> {
  return (client as any).waitForMessage()
}

function encodeYjsMessage(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length)
  msg[0] = MSG_YJS
  msg.set(update, 1)
  return msg
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health check', () => {
  it('GET /health returns { status: "ok" }', async () => {
    const res = await fetch(`http://localhost:${port}/health`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })
})

describe('Initial state delivery', () => {
  it('new client receives initial Yjs state on connect', async () => {
    const client = await connectClient('init-test')
    const msg = await waitForMessage(client)

    expect(msg[0]).toBe(MSG_YJS)

    // Payload should be a valid Yjs state update
    const payload = msg.slice(1)
    const doc = new Y.Doc()
    expect(() => Y.applyUpdate(doc, payload)).not.toThrow()

    client.close()
    doc.destroy()
  })

  it('new client receives objects created by a previous client', async () => {
    const clientA = await connectClient('persist-test')
    await waitForMessage(clientA) // consume initial empty state

    // A creates an object
    const docA = new Y.Doc()
    docA.getMap('objects').set('obj1', { id: 'obj1', type: 'sticky', x: 10, y: 20 })
    clientA.ws.send(encodeYjsMessage(Y.encodeStateAsUpdate(docA)))

    await delay(100)

    // B connects and should receive the object in initial state
    const clientB = await connectClient('persist-test')
    const initMsg = await waitForMessage(clientB)

    const docB = new Y.Doc()
    Y.applyUpdate(docB, initMsg.slice(1))
    expect(docB.getMap('objects').get('obj1')).toBeDefined()

    clientA.close()
    clientB.close()
    docA.destroy()
    docB.destroy()
  })
})

describe('Broadcast', () => {
  it('broadcasts Yjs updates to other clients in the same room', async () => {
    const clientA = await connectClient('bcast-test')
    const clientB = await connectClient('bcast-test')
    await waitForMessage(clientA) // consume init
    await waitForMessage(clientB) // consume init

    // A sends an update
    const docA = new Y.Doc()
    docA.getMap('objects').set('x', { id: 'x', value: 42 })
    clientA.ws.send(encodeYjsMessage(Y.encodeStateAsUpdate(docA)))

    // B should receive it
    const received = await waitForMessage(clientB)
    expect(received[0]).toBe(MSG_YJS)
    expect(received.length).toBeGreaterThan(1)

    clientA.close()
    clientB.close()
    docA.destroy()
  })

  it('does NOT echo message back to the sender', async () => {
    const clientA = await connectClient('echo-test')
    await waitForMessage(clientA) // consume init

    let receivedExtra = false
    clientA.ws.on('message', () => {
      receivedExtra = true
    })

    const docA = new Y.Doc()
    docA.getMap('objects').set('y', { id: 'y' })
    clientA.ws.send(encodeYjsMessage(Y.encodeStateAsUpdate(docA)))

    await delay(200)
    expect(receivedExtra).toBe(false)

    clientA.close()
    docA.destroy()
  })

  it('broadcasts awareness messages to other clients', async () => {
    const clientA = await connectClient('aware-test')
    const clientB = await connectClient('aware-test')
    await waitForMessage(clientA)
    await waitForMessage(clientB)

    const cursor = { clientId: 'a1', name: 'Alice', color: '#f00', cursor: { x: 100, y: 200 } }
    const encoded = new TextEncoder().encode(JSON.stringify(cursor))
    const msg = new Uint8Array(1 + encoded.length)
    msg[0] = MSG_AWARENESS
    msg.set(encoded, 1)

    clientA.ws.send(msg)

    const received = await waitForMessage(clientB)
    expect(received[0]).toBe(MSG_AWARENESS)

    const payload = JSON.parse(new TextDecoder().decode(received.slice(1)))
    expect(payload.name).toBe('Alice')
    expect(payload.cursor).toEqual({ x: 100, y: 200 })

    clientA.close()
    clientB.close()
  })
})

describe('Room isolation', () => {
  it('messages in room A do NOT reach clients in room B', async () => {
    const clientA = await connectClient('iso-room-a')
    const clientB = await connectClient('iso-room-b')
    await waitForMessage(clientA)
    await waitForMessage(clientB)

    let bReceivedMessage = false
    clientB.ws.on('message', () => {
      bReceivedMessage = true
    })

    const doc = new Y.Doc()
    doc.getMap('objects').set('isolated', { id: 'isolated' })
    clientA.ws.send(encodeYjsMessage(Y.encodeStateAsUpdate(doc)))

    await delay(200)
    expect(bReceivedMessage).toBe(false)

    clientA.close()
    clientB.close()
    doc.destroy()
  })

  it('each room maintains its own Y.Doc state', async () => {
    const clientX = await connectClient('state-room-x')
    await waitForMessage(clientX)

    const docX = new Y.Doc()
    docX.getMap('objects').set('x-only', { id: 'x-only' })
    clientX.ws.send(encodeYjsMessage(Y.encodeStateAsUpdate(docX)))

    await delay(100)

    // New client joins a different room — should NOT see room-x data
    const clientY = await connectClient('state-room-y')
    const initY = await waitForMessage(clientY)

    const docY = new Y.Doc()
    Y.applyUpdate(docY, initY.slice(1))
    expect(docY.getMap('objects').get('x-only')).toBeUndefined()

    clientX.close()
    clientY.close()
    docX.destroy()
    docY.destroy()
  })
})
