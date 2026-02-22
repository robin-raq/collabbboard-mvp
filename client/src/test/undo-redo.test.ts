/**
 * Undo/Redo Tests (Yjs UndoManager)
 *
 * Tests the core UndoManager behavior that useYjs.ts will expose:
 *  - Undo/redo for create, update, delete operations
 *  - canUndo/canRedo stack state
 *  - Remote changes are NOT undoable (only local)
 *  - captureTimeout groups rapid mutations into one undo step
 *  - Stack events fire correctly
 */

import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'

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

/** Helper: create a Y.Doc with UndoManager scoped to the 'objects' Y.Map */
function createDocWithUndo(captureTimeout = 500) {
  const doc = new Y.Doc()
  const map = doc.getMap<BoardObject>('objects')
  const undoManager = new Y.UndoManager(map, {
    captureTimeout,
    trackedOrigins: new Set([null]),
  })
  return { doc, map, undoManager }
}

/** Helper: create a sample board object */
function makeObj(id: string, overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id,
    type: 'sticky',
    x: 100,
    y: 200,
    width: 150,
    height: 150,
    fill: '#FFEB3B',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// UndoManager basics
// ---------------------------------------------------------------------------

describe('UndoManager basics', () => {
  it('can undo a single create operation', () => {
    const { map, undoManager } = createDocWithUndo()

    map.set('obj-1', makeObj('obj-1'))
    expect(map.size).toBe(1)

    undoManager.undo()

    expect(map.size).toBe(0)
    expect(map.get('obj-1')).toBeUndefined()
  })

  it('can redo an undone create operation', () => {
    const { map, undoManager } = createDocWithUndo()

    map.set('obj-1', makeObj('obj-1'))
    undoManager.undo()
    expect(map.size).toBe(0)

    undoManager.redo()

    expect(map.size).toBe(1)
    expect(map.get('obj-1')).toBeDefined()
  })

  it('can undo a delete operation — object is restored', () => {
    const { map, undoManager } = createDocWithUndo()
    const obj = makeObj('obj-1', { text: 'keep me' })

    map.set('obj-1', obj)
    // Stop tracking the create as one undo step
    undoManager.stopCapturing()

    map.delete('obj-1')
    expect(map.size).toBe(0)

    undoManager.undo()

    expect(map.size).toBe(1)
    expect(map.get('obj-1')).toBeDefined()
  })

  it('can undo an update operation — original value restored', () => {
    const { map, undoManager } = createDocWithUndo()

    map.set('obj-1', makeObj('obj-1', { x: 100, y: 200 }))
    undoManager.stopCapturing()

    // Update position
    map.set('obj-1', makeObj('obj-1', { x: 500, y: 600 }))

    undoManager.undo()

    const restored = map.get('obj-1')!
    expect(restored.x).toBe(100)
    expect(restored.y).toBe(200)
  })

  it('canUndo returns false on empty stack', () => {
    const { undoManager } = createDocWithUndo()

    expect(undoManager.canUndo()).toBe(false)
  })

  it('canRedo returns false when nothing has been undone', () => {
    const { map, undoManager } = createDocWithUndo()

    map.set('obj-1', makeObj('obj-1'))

    expect(undoManager.canRedo()).toBe(false)
  })

  it('canUndo returns true after a local mutation', () => {
    const { map, undoManager } = createDocWithUndo()

    map.set('obj-1', makeObj('obj-1'))

    expect(undoManager.canUndo()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Remote changes should NOT be undoable
// ---------------------------------------------------------------------------

describe('UndoManager ignores remote changes', () => {
  it('does not undo remote-origin changes', () => {
    const { doc, map, undoManager } = createDocWithUndo()

    // Simulate a remote user creating an object
    const remoteDoc = new Y.Doc()
    const remoteMap = remoteDoc.getMap<BoardObject>('objects')
    remoteMap.set('remote-1', makeObj('remote-1', { fill: '#FF0000' }))

    // Apply with 'remote' origin — UndoManager should ignore
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc), REMOTE)

    expect(map.size).toBe(1)
    expect(undoManager.canUndo()).toBe(false)

    remoteDoc.destroy()
  })

  it('undoes only local changes when mixed with remote', () => {
    const { doc, map, undoManager } = createDocWithUndo()

    // Local create
    map.set('local-1', makeObj('local-1', { text: 'mine' }))

    // Remote create
    const remoteDoc = new Y.Doc()
    const remoteMap = remoteDoc.getMap<BoardObject>('objects')
    remoteMap.set('remote-1', makeObj('remote-1', { text: 'theirs' }))
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc), REMOTE)

    expect(map.size).toBe(2)

    // Undo should only remove local object
    undoManager.undo()

    expect(map.size).toBe(1)
    expect(map.get('local-1')).toBeUndefined()
    expect(map.get('remote-1')).toBeDefined()

    remoteDoc.destroy()
  })
})

// ---------------------------------------------------------------------------
// captureTimeout grouping
// ---------------------------------------------------------------------------

describe('UndoManager captureTimeout grouping', () => {
  it('groups rapid mutations within captureTimeout into one undo step', () => {
    const { map, undoManager } = createDocWithUndo(500)

    // Rapid-fire: create then immediately update (within 500ms)
    map.set('obj-1', makeObj('obj-1', { x: 0 }))
    map.set('obj-1', makeObj('obj-1', { x: 100 }))
    map.set('obj-1', makeObj('obj-1', { x: 200 }))

    // All should be one undo step — single undo reverts everything
    undoManager.undo()

    expect(map.size).toBe(0)
  })

  it('separates mutations into distinct undo steps via stopCapturing', () => {
    const { map, undoManager } = createDocWithUndo(500)

    // First mutation
    map.set('obj-1', makeObj('obj-1', { x: 0 }))

    // Force a new capture group
    undoManager.stopCapturing()

    // Second mutation (new undo step)
    map.set('obj-1', makeObj('obj-1', { x: 999 }))

    // Undo should only revert the second mutation
    undoManager.undo()

    expect(map.get('obj-1')!.x).toBe(0)

    // Undo again should remove the object entirely
    undoManager.undo()

    expect(map.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Stack events
// ---------------------------------------------------------------------------

describe('UndoManager stack events', () => {
  it('fires stack-item-added when local mutation is tracked', () => {
    const { map, undoManager } = createDocWithUndo()
    const handler = vi.fn()

    undoManager.on('stack-item-added', handler)

    map.set('obj-1', makeObj('obj-1'))

    expect(handler).toHaveBeenCalledTimes(1)

    undoManager.off('stack-item-added', handler)
  })

  it('fires stack-item-popped on undo', () => {
    const { map, undoManager } = createDocWithUndo()
    const handler = vi.fn()

    map.set('obj-1', makeObj('obj-1'))

    undoManager.on('stack-item-popped', handler)
    undoManager.undo()

    expect(handler).toHaveBeenCalledTimes(1)

    undoManager.off('stack-item-popped', handler)
  })
})
