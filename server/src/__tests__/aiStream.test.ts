/**
 * AI Stream SSE Endpoint Tests (TDD)
 *
 * Tests the POST /api/ai/stream endpoint that streams AI responses
 * via Server-Sent Events.
 *
 * Uses a minimal test HTTP server to avoid importing the full index.ts
 * (which has side effects like DB connections and WebSocket setup).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import * as Y from 'yjs'

import { processAICommandStream } from '../aiHandler.js'
import type { AIStreamEvent } from '../../../shared/aiStreamTypes.js'

// ---------------------------------------------------------------------------
// Test server that mirrors the SSE endpoint from index.ts
// ---------------------------------------------------------------------------

let server: http.Server
let port: number
const docs = new Map<string, Y.Doc>()

function getOrCreateDoc(room: string): Y.Doc {
  if (!docs.has(room)) {
    docs.set(room, new Y.Doc())
  }
  return docs.get(room)!
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        if (req.method === 'POST' && req.url === '/api/ai/stream') {
          try {
            const body = JSON.parse(await readBody(req))
            const { message, boardId } = body

            if (!message || typeof message !== 'string' || message.length === 0 || message.length > 2000) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid message: must be 1-2000 characters' }))
              return
            }

            const roomId = boardId || 'default'
            const doc = getOrCreateDoc(roomId)

            // Set SSE headers
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
            })

            // Set up abort on client disconnect
            const controller = new AbortController()
            req.on('close', () => controller.abort())

            // 60-second timeout
            const timeout = setTimeout(() => controller.abort(), 60_000)

            try {
              const gen = processAICommandStream(message, doc, { boardId: roomId }, controller.signal)

              for await (const event of gen) {
                res.write(`data: ${JSON.stringify(event)}\n\n`)
              }
            } finally {
              clearTimeout(timeout)
            }

            res.end()
          } catch (err) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'AI stream failed', details: String(err) }))
            } else {
              res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
              res.end()
            }
          }
          return
        }

        res.writeHead(404)
        res.end('Not found')
      })

      server.listen(0, () => {
        const addr = server.address()
        port = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
)

afterAll(
  () =>
    new Promise<void>((resolve) => {
      for (const doc of docs.values()) doc.destroy()
      docs.clear()
      server.close(() => resolve())
    })
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseSSEEvents(response: Response): Promise<AIStreamEvent[]> {
  const text = await response.text()
  const events: AIStreamEvent[] = []

  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)))
      } catch {
        // skip malformed lines
      }
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/stream', () => {
  it('returns 200 with text/event-stream content type', async () => {
    const res = await fetch(`http://localhost:${port}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Create a yellow sticky note that says Hello' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
  })

  it('returns 400 for invalid message', async () => {
    // Empty message
    const res1 = await fetch(`http://localhost:${port}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    })
    expect(res1.status).toBe(400)

    // Missing message
    const res2 = await fetch(`http://localhost:${port}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res2.status).toBe(400)
  })

  it('sends SSE events ending with done event', async () => {
    const res = await fetch(`http://localhost:${port}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Create a blue sticky note that says Test' }),
    })

    const events = await parseSSEEvents(res)

    expect(events.length).toBeGreaterThan(0)

    // Last event should be 'done'
    const lastEvent = events[events.length - 1]
    expect(lastEvent.type).toBe('done')

    if (lastEvent.type === 'done') {
      expect(lastEvent.message).toBeDefined()
      expect(lastEvent.actions).toBeInstanceOf(Array)
    }
  })

  it('handles CORS correctly', async () => {
    const res = await fetch(`http://localhost:${port}/api/ai/stream`, {
      method: 'OPTIONS',
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})
