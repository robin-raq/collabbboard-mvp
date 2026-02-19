/**
 * Persistence Tests
 *
 * Tests the Supabase snapshot persistence logic:
 *  - Y.Doc encode/decode round-trip via base64
 *  - Dirty room tracking on Yjs updates
 *  - Snapshot restore populates objects correctly
 *  - Multiple objects survive encode/decode
 *  - Empty doc encodes/decodes cleanly
 *  - Complex nested object properties preserved
 */

import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'

// ---------------------------------------------------------------------------
// Helpers — replicate the encode/decode logic from server/src/index.ts
// ---------------------------------------------------------------------------

/** Encode a Y.Doc state as a base64 string (same as saveDocToSupabase). */
function encodeSnapshot(doc: Y.Doc): string {
  const state = Y.encodeStateAsUpdate(doc)
  return Buffer.from(state).toString('base64')
}

/** Decode a base64 snapshot and apply to a new Y.Doc (same as loadDocFromSupabase). */
function decodeSnapshot(snapshot: string): Y.Doc {
  const doc = new Y.Doc()
  const binary = Buffer.from(snapshot, 'base64')
  Y.applyUpdate(doc, new Uint8Array(binary))
  return doc
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Snapshot encode/decode', () => {
  it('round-trips a single sticky note through base64 encoding', () => {
    const original = new Y.Doc()
    const objects = original.getMap('objects')
    objects.set('s1', {
      id: 's1',
      type: 'sticky',
      x: 100,
      y: 200,
      width: 200,
      height: 150,
      text: 'Hello World',
      fill: '#FFD700',
      rotation: 0,
    })

    const snapshot = encodeSnapshot(original)
    expect(typeof snapshot).toBe('string')
    expect(snapshot.length).toBeGreaterThan(0)

    const restored = decodeSnapshot(snapshot)
    const restoredObj = restored.getMap('objects').get('s1') as any
    expect(restoredObj).toBeDefined()
    expect(restoredObj.id).toBe('s1')
    expect(restoredObj.type).toBe('sticky')
    expect(restoredObj.x).toBe(100)
    expect(restoredObj.y).toBe(200)
    expect(restoredObj.text).toBe('Hello World')
    expect(restoredObj.fill).toBe('#FFD700')

    original.destroy()
    restored.destroy()
  })

  it('round-trips multiple objects of different types', () => {
    const original = new Y.Doc()
    const objects = original.getMap('objects')

    objects.set('sticky-1', {
      id: 'sticky-1', type: 'sticky', x: 50, y: 50,
      width: 200, height: 150, text: 'Note 1', fill: '#FFD700',
    })
    objects.set('rect-1', {
      id: 'rect-1', type: 'rect', x: 300, y: 100,
      width: 150, height: 100, fill: '#87CEEB',
    })
    objects.set('circle-1', {
      id: 'circle-1', type: 'circle', x: 500, y: 200,
      width: 100, height: 100, fill: '#DDA0DD',
    })

    const snapshot = encodeSnapshot(original)
    const restored = decodeSnapshot(snapshot)
    const restoredObjects = restored.getMap('objects')

    expect(restoredObjects.size).toBe(3)
    expect((restoredObjects.get('sticky-1') as any).type).toBe('sticky')
    expect((restoredObjects.get('rect-1') as any).type).toBe('rect')
    expect((restoredObjects.get('circle-1') as any).type).toBe('circle')
    expect((restoredObjects.get('rect-1') as any).fill).toBe('#87CEEB')

    original.destroy()
    restored.destroy()
  })

  it('round-trips an empty doc cleanly', () => {
    const original = new Y.Doc()
    // Don't add any objects — just the empty map
    original.getMap('objects')

    const snapshot = encodeSnapshot(original)
    const restored = decodeSnapshot(snapshot)

    expect(restored.getMap('objects').size).toBe(0)

    original.destroy()
    restored.destroy()
  })

  it('preserves optional fields like rotation, fontSize, and line points', () => {
    const original = new Y.Doc()
    const objects = original.getMap('objects')

    objects.set('rotated', {
      id: 'rotated', type: 'rect', x: 0, y: 0,
      width: 100, height: 50, fill: '#FF0000',
      rotation: 45,
    })
    objects.set('text-big', {
      id: 'text-big', type: 'text', x: 200, y: 200,
      width: 300, height: 60, fill: '#333',
      text: 'Big text', fontSize: 24,
    })
    objects.set('line-1', {
      id: 'line-1', type: 'line', x: 0, y: 0,
      width: 200, height: 100, fill: '#000',
      points: [0, 0, 200, 100],
      arrowEnd: true,
    })

    const snapshot = encodeSnapshot(original)
    const restored = decodeSnapshot(snapshot)
    const restoredObjects = restored.getMap('objects')

    const rotated = restoredObjects.get('rotated') as any
    expect(rotated.rotation).toBe(45)

    const textBig = restoredObjects.get('text-big') as any
    expect(textBig.fontSize).toBe(24)
    expect(textBig.text).toBe('Big text')

    const line = restoredObjects.get('line-1') as any
    expect(line.points).toEqual([0, 0, 200, 100])
    expect(line.arrowEnd).toBe(true)

    original.destroy()
    restored.destroy()
  })

  it('handles special characters in text fields', () => {
    const original = new Y.Doc()
    const objects = original.getMap('objects')
    objects.set('special', {
      id: 'special', type: 'sticky', x: 0, y: 0,
      width: 200, height: 150, fill: '#FFD700',
      text: 'Hello "World" <script>alert("xss")</script> & 🎉 emoji',
    })

    const snapshot = encodeSnapshot(original)
    const restored = decodeSnapshot(snapshot)
    const obj = restored.getMap('objects').get('special') as any

    expect(obj.text).toBe('Hello "World" <script>alert("xss")</script> & 🎉 emoji')

    original.destroy()
    restored.destroy()
  })
})

describe('Dirty room tracking', () => {
  it('tracks which rooms have been modified', () => {
    const dirtyRooms = new Set<string>()

    // Simulate receiving Yjs updates for different rooms
    dirtyRooms.add('room-a')
    dirtyRooms.add('room-b')
    dirtyRooms.add('room-a') // duplicate should not increase size

    expect(dirtyRooms.size).toBe(2)
    expect(dirtyRooms.has('room-a')).toBe(true)
    expect(dirtyRooms.has('room-b')).toBe(true)
    expect(dirtyRooms.has('room-c')).toBe(false)
  })

  it('clears after snapshot cycle', () => {
    const dirtyRooms = new Set<string>()
    dirtyRooms.add('room-1')
    dirtyRooms.add('room-2')

    // Simulate snapshot cycle
    const roomsToSave = [...dirtyRooms]
    dirtyRooms.clear()

    expect(roomsToSave).toEqual(['room-1', 'room-2'])
    expect(dirtyRooms.size).toBe(0)
  })

  it('new modifications after clear are tracked independently', () => {
    const dirtyRooms = new Set<string>()
    dirtyRooms.add('room-1')

    // Snapshot cycle
    const batch1 = [...dirtyRooms]
    dirtyRooms.clear()

    // New modifications come in
    dirtyRooms.add('room-3')

    expect(batch1).toEqual(['room-1'])
    expect(dirtyRooms.size).toBe(1)
    expect(dirtyRooms.has('room-3')).toBe(true)
    expect(dirtyRooms.has('room-1')).toBe(false)
  })
})

describe('Doc state after Yjs update', () => {
  it('applying a remote update adds objects to the server doc', () => {
    const serverDoc = new Y.Doc()
    const clientDoc = new Y.Doc()

    // Client creates an object
    clientDoc.getMap('objects').set('remote-obj', {
      id: 'remote-obj', type: 'sticky', x: 100, y: 200,
      width: 200, height: 150, text: 'From client', fill: '#98FB98',
    })

    // Simulate the server receiving the update
    const update = Y.encodeStateAsUpdate(clientDoc)
    Y.applyUpdate(serverDoc, update, 'remote')

    const serverObjects = serverDoc.getMap('objects')
    expect(serverObjects.size).toBe(1)
    const obj = serverObjects.get('remote-obj') as any
    expect(obj.text).toBe('From client')
    expect(obj.fill).toBe('#98FB98')

    serverDoc.destroy()
    clientDoc.destroy()
  })

  it('snapshot taken after update contains the new objects', () => {
    const serverDoc = new Y.Doc()
    const clientDoc = new Y.Doc()

    clientDoc.getMap('objects').set('obj-1', {
      id: 'obj-1', type: 'rect', x: 0, y: 0,
      width: 100, height: 50, fill: '#F00',
    })

    // Server receives update
    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(clientDoc), 'remote')

    // Snapshot and restore
    const snapshot = encodeSnapshot(serverDoc)
    const restored = decodeSnapshot(snapshot)

    expect(restored.getMap('objects').size).toBe(1)
    expect((restored.getMap('objects').get('obj-1') as any).fill).toBe('#F00')

    serverDoc.destroy()
    clientDoc.destroy()
    restored.destroy()
  })
})
