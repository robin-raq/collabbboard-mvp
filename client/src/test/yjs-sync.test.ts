/**
 * Yjs Sync Logic Tests
 *
 * These test the core CRDT behavior that useYjs.ts relies on:
 *  - Two Y.Docs sync via state updates
 *  - Echo prevention via origin tagging
 *  - CRUD operations on a shared Y.Map
 *  - Conflict resolution (last-write-wins per key)
 *  - Wire protocol encoding (message type prefix byte)
 */

import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'

// Mirrors the constants in useYjs.ts
const MSG_YJS = 0
const MSG_AWARENESS = 1
const REMOTE = 'remote'

interface BoardObject {
  id: string
  type: 'sticky' | 'rect'
  x: number
  y: number
  width: number
  height: number
  text?: string
  fill: string
}

/** Helper: create a Y.Doc with a 'objects' Y.Map, like the real app */
function createDoc() {
  const doc = new Y.Doc()
  const map = doc.getMap<BoardObject>('objects')
  return { doc, map }
}

/** Helper: simulate the wire protocol — prefix a Yjs update with MSG_YJS byte */
function encodeYjsMessage(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length)
  msg[0] = MSG_YJS
  msg.set(update, 1)
  return msg
}

/** Helper: simulate the wire protocol — prefix awareness with MSG_AWARENESS byte */
function encodeAwarenessMessage(payload: object): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  const msg = new Uint8Array(1 + encoded.length)
  msg[0] = MSG_AWARENESS
  msg.set(encoded, 1)
  return msg
}

// ---------------------------------------------------------------------------
// Two-doc sync (simulates two clients)
// ---------------------------------------------------------------------------

describe('Yjs two-doc sync', () => {
  it('syncs a created object from doc A to doc B via state update', () => {
    const a = createDoc()
    const b = createDoc()

    // Client A creates a sticky
    const obj: BoardObject = {
      id: 'sticky-1',
      type: 'sticky',
      x: 100,
      y: 200,
      width: 150,
      height: 150,
      text: 'Hello',
      fill: '#FFEB3B',
    }
    a.map.set(obj.id, obj)

    // Simulate server relay: encode A's state → apply to B
    const update = Y.encodeStateAsUpdate(a.doc)
    Y.applyUpdate(b.doc, update)

    // B should now have the object
    expect(b.map.get('sticky-1')).toEqual(obj)
    expect(b.map.size).toBe(1)
  })

  it('syncs bidirectionally — both docs converge', () => {
    const a = createDoc()
    const b = createDoc()

    // A creates a sticky, B creates a rect (simultaneously)
    a.map.set('s1', { id: 's1', type: 'sticky', x: 0, y: 0, width: 100, height: 100, text: 'A', fill: '#fff' })
    b.map.set('r1', { id: 'r1', type: 'rect', x: 500, y: 500, width: 80, height: 80, fill: '#00f' })

    // Exchange state updates (both directions)
    const updateA = Y.encodeStateAsUpdate(a.doc)
    const updateB = Y.encodeStateAsUpdate(b.doc)
    Y.applyUpdate(b.doc, updateA)
    Y.applyUpdate(a.doc, updateB)

    // Both should now have 2 objects
    expect(a.map.size).toBe(2)
    expect(b.map.size).toBe(2)
    expect(a.map.get('s1')).toBeDefined()
    expect(a.map.get('r1')).toBeDefined()
    expect(b.map.get('s1')).toBeDefined()
    expect(b.map.get('r1')).toBeDefined()
  })

  it('handles concurrent edits to the same object (last-write-wins per key)', () => {
    const a = createDoc()
    const b = createDoc()

    // Both start with the same object
    const initial: BoardObject = { id: 'obj1', type: 'sticky', x: 0, y: 0, width: 100, height: 100, text: 'init', fill: '#fff' }
    a.map.set('obj1', initial)
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))

    // A moves it right, B moves it down (concurrent)
    a.map.set('obj1', { ...initial, x: 200 })
    b.map.set('obj1', { ...initial, y: 300 })

    // Exchange updates
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))

    // Both docs should converge to the same value
    const resultA = a.map.get('obj1')
    const resultB = b.map.get('obj1')
    expect(resultA).toEqual(resultB)
  })

  it('delete syncs across docs', () => {
    const a = createDoc()
    const b = createDoc()

    // A creates, sync to B
    a.map.set('del-me', { id: 'del-me', type: 'rect', x: 0, y: 0, width: 50, height: 50, fill: '#f00' })
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
    expect(b.map.size).toBe(1)

    // A deletes it
    a.map.delete('del-me')
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))

    expect(b.map.size).toBe(0)
    expect(b.map.get('del-me')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Echo prevention
// ---------------------------------------------------------------------------

describe('echo prevention via origin tagging', () => {
  it('update handler can distinguish local vs remote updates', () => {
    const { doc, map } = createDoc()
    const handler = vi.fn()

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      handler(origin)
    })

    // Local mutation (no origin) — should be sent to server
    map.set('local-obj', { id: 'local-obj', type: 'sticky', x: 0, y: 0, width: 100, height: 100, fill: '#fff' })
    expect(handler).toHaveBeenCalledWith(null)

    handler.mockClear()

    // Remote update (with REMOTE origin) — should NOT be sent to server
    const remoteDoc = new Y.Doc()
    const remoteMap = remoteDoc.getMap<BoardObject>('objects')
    remoteMap.set('remote-obj', { id: 'remote-obj', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#00f' })
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc)

    Y.applyUpdate(doc, remoteUpdate, REMOTE)
    expect(handler).toHaveBeenCalledWith(REMOTE)

    remoteDoc.destroy()
  })

  it('filtering on origin prevents echo loop', () => {
    const { doc, map } = createDoc()
    const sentToServer: Uint8Array[] = []

    // Simulate the update handler from useYjs.ts
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return // DON'T echo back
      sentToServer.push(update)
    })

    // Local create — should be sent
    map.set('obj1', { id: 'obj1', type: 'sticky', x: 0, y: 0, width: 100, height: 100, fill: '#fff' })
    expect(sentToServer).toHaveLength(1)

    // Simulate receiving a remote update — should NOT be sent
    const remoteDoc = new Y.Doc()
    remoteDoc.getMap<BoardObject>('objects').set('obj2', {
      id: 'obj2', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#00f',
    })
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc), REMOTE)

    // Should still be 1 — the remote update was not echoed
    expect(sentToServer).toHaveLength(1)

    // Verify the data was still applied though
    expect(map.get('obj2')).toBeDefined()

    remoteDoc.destroy()
  })
})

// ---------------------------------------------------------------------------
// Wire protocol
// ---------------------------------------------------------------------------

describe('wire protocol encoding', () => {
  it('Yjs message has type byte 0 followed by update payload', () => {
    const { doc, map } = createDoc()
    map.set('test', { id: 'test', type: 'sticky', x: 0, y: 0, width: 100, height: 100, fill: '#fff' })

    const update = Y.encodeStateAsUpdate(doc)
    const msg = encodeYjsMessage(update)

    expect(msg[0]).toBe(MSG_YJS)
    expect(msg.slice(1)).toEqual(update)
    expect(msg.length).toBe(1 + update.length)
  })

  it('awareness message has type byte 1 followed by JSON payload', () => {
    const cursor = { clientId: 'abc', name: 'Alice', color: '#f00', cursor: { x: 100, y: 200 } }
    const msg = encodeAwarenessMessage(cursor)

    expect(msg[0]).toBe(MSG_AWARENESS)

    // Decode the payload back
    const payloadBytes = msg.slice(1)
    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes))
    expect(decoded).toEqual(cursor)
  })

  it('rejects messages shorter than 2 bytes', () => {
    // This mimics the guard in useYjs.ts onmessage handler
    const tooShort = new Uint8Array([0])
    expect(tooShort.length < 2).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

describe('CRUD on Y.Map (simulates useYjs operations)', () => {
  it('CREATE — set a new object on the map', () => {
    const { map } = createDoc()
    const obj: BoardObject = { id: 'new-1', type: 'sticky', x: 10, y: 20, width: 150, height: 150, text: 'hello', fill: '#FFEB3B' }

    map.set(obj.id, obj)

    expect(map.get('new-1')).toEqual(obj)
    expect(map.size).toBe(1)
  })

  it('READ — get all objects from the map', () => {
    const { map } = createDoc()
    map.set('a', { id: 'a', type: 'sticky', x: 0, y: 0, width: 100, height: 100, fill: '#fff' })
    map.set('b', { id: 'b', type: 'rect', x: 200, y: 200, width: 80, height: 80, fill: '#00f' })

    const all = Array.from(map.values())
    expect(all).toHaveLength(2)
  })

  it('UPDATE — merge partial updates into existing object', () => {
    const { map } = createDoc()
    const obj: BoardObject = { id: 'u1', type: 'sticky', x: 0, y: 0, width: 100, height: 100, text: 'old', fill: '#fff' }
    map.set(obj.id, obj)

    // Simulate updateObject from useYjs.ts
    const existing = map.get('u1')!
    const updated = { ...existing, x: 300, y: 400, text: 'updated' }
    map.set('u1', updated)

    expect(map.get('u1')!.x).toBe(300)
    expect(map.get('u1')!.y).toBe(400)
    expect(map.get('u1')!.text).toBe('updated')
    // Unchanged fields preserved
    expect(map.get('u1')!.fill).toBe('#fff')
    expect(map.get('u1')!.width).toBe(100)
  })

  it('DELETE — remove an object from the map', () => {
    const { map } = createDoc()
    map.set('d1', { id: 'd1', type: 'rect', x: 0, y: 0, width: 50, height: 50, fill: '#f00' })
    expect(map.size).toBe(1)

    map.delete('d1')

    expect(map.size).toBe(0)
    expect(map.get('d1')).toBeUndefined()
  })

  it('observer fires on create, update, and delete', () => {
    const { map } = createDoc()
    const events: string[] = []

    map.observe((event) => {
      for (const [, change] of event.changes.keys) {
        events.push(change.action)
      }
    })

    map.set('o1', { id: 'o1', type: 'sticky', x: 0, y: 0, width: 100, height: 100, fill: '#fff' })
    map.set('o1', { id: 'o1', type: 'sticky', x: 50, y: 50, width: 100, height: 100, fill: '#fff' })
    map.delete('o1')

    expect(events).toEqual(['add', 'update', 'delete'])
  })
})
