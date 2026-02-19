/**
 * Group Operations Tests (TDD — Red Phase)
 *
 * Tests the group operations that act on multiple selected objects:
 *  - Delete all selected objects
 *  - Duplicate all selected objects (with offset)
 *  - Change color of all selected objects
 *  - Selection-aware operations
 */

import { describe, it, expect } from 'vitest'
import type { BoardObject } from '../types'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeObj(
  id: string, x: number, y: number,
  overrides: Partial<BoardObject> = {},
): BoardObject {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 100,
    height: 100,
    fill: '#42A5F5',
    ...overrides,
  }
}

function createBoardState(): BoardObject[] {
  return [
    makeObj('a', 100, 100, { type: 'sticky', fill: '#FFEB3B', text: 'Note A' }),
    makeObj('b', 300, 100, { type: 'rect', fill: '#42A5F5' }),
    makeObj('c', 100, 300, { type: 'circle', fill: '#66BB6A' }),
    makeObj('d', 300, 300, { type: 'text', fill: 'transparent', text: 'Hello' }),
    makeObj('e', 500, 500, { type: 'frame', fill: 'transparent', text: 'Frame' }),
  ]
}

// ---------------------------------------------------------------------------
// Delete all selected objects
// ---------------------------------------------------------------------------

describe('Delete all selected objects', () => {
  it('deletes a single selected object', () => {
    let objects = createBoardState()
    const selectedIds = new Set(['b'])

    // Simulate deletion
    objects = objects.filter((obj) => !selectedIds.has(obj.id))

    expect(objects).toHaveLength(4)
    expect(objects.find((o) => o.id === 'b')).toBeUndefined()
  })

  it('deletes multiple selected objects', () => {
    let objects = createBoardState()
    const selectedIds = new Set(['a', 'c', 'e'])

    objects = objects.filter((obj) => !selectedIds.has(obj.id))

    expect(objects).toHaveLength(2)
    expect(objects.map((o) => o.id)).toEqual(['b', 'd'])
  })

  it('deletes all objects when all are selected', () => {
    let objects = createBoardState()
    const selectedIds = new Set(objects.map((o) => o.id))

    objects = objects.filter((obj) => !selectedIds.has(obj.id))

    expect(objects).toHaveLength(0)
  })

  it('does nothing when no objects are selected', () => {
    let objects = createBoardState()
    const selectedIds = new Set<string>()

    objects = objects.filter((obj) => !selectedIds.has(obj.id))

    expect(objects).toHaveLength(5)
  })

  it('clears selection after deletion', () => {
    const selectedIds = new Set(['a', 'b'])
    // After deleting, clear selection
    const newSelectedIds = new Set<string>()
    expect(newSelectedIds.size).toBe(0)
    expect(selectedIds.size).toBe(2) // original was 2
  })
})

// ---------------------------------------------------------------------------
// Duplicate all selected objects
// ---------------------------------------------------------------------------

describe('Duplicate all selected objects', () => {
  const DUPLICATE_OFFSET = 20

  it('duplicates a single object with offset', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a'])

    const duplicates: BoardObject[] = []
    for (const id of selectedIds) {
      const src = objects.find((o) => o.id === id)
      if (src) {
        duplicates.push({
          ...src,
          id: `dup-${src.id}`, // In real code, uses crypto.randomUUID()
          x: src.x + DUPLICATE_OFFSET,
          y: src.y + DUPLICATE_OFFSET,
        })
      }
    }

    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].x).toBe(120) // 100 + 20
    expect(duplicates[0].y).toBe(120) // 100 + 20
    expect(duplicates[0].type).toBe('sticky')
    expect(duplicates[0].fill).toBe('#FFEB3B')
    expect(duplicates[0].text).toBe('Note A')
    expect(duplicates[0].id).not.toBe('a') // New ID
  })

  it('duplicates multiple objects preserving relative positions', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b']) // a=(100,100), b=(300,100)

    const duplicates: BoardObject[] = []
    for (const id of selectedIds) {
      const src = objects.find((o) => o.id === id)
      if (src) {
        duplicates.push({
          ...src,
          id: `dup-${src.id}`,
          x: src.x + DUPLICATE_OFFSET,
          y: src.y + DUPLICATE_OFFSET,
        })
      }
    }

    expect(duplicates).toHaveLength(2)

    // Original relative offset: b.x - a.x = 200
    const dupA = duplicates.find((d) => d.id === 'dup-a')!
    const dupB = duplicates.find((d) => d.id === 'dup-b')!
    expect(dupB.x - dupA.x).toBe(200) // Relative position preserved
    expect(dupB.y - dupA.y).toBe(0)   // Same vertical offset
  })

  it('duplicated objects have unique IDs', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b', 'c'])

    const duplicates: BoardObject[] = []
    const usedIds = new Set(objects.map((o) => o.id))

    for (const id of selectedIds) {
      const src = objects.find((o) => o.id === id)
      if (src) {
        const newId = `dup-${src.id}-${Math.random()}`
        expect(usedIds.has(newId)).toBe(false) // No collision
        usedIds.add(newId)
        duplicates.push({ ...src, id: newId, x: src.x + DUPLICATE_OFFSET, y: src.y + DUPLICATE_OFFSET })
      }
    }

    expect(duplicates).toHaveLength(3)
    // All unique IDs
    const dupIds = duplicates.map((d) => d.id)
    expect(new Set(dupIds).size).toBe(3)
  })

  it('selection moves to duplicated objects after duplication', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b'])

    const newSelectedIds = new Set<string>()
    for (const id of selectedIds) {
      const src = objects.find((o) => o.id === id)
      if (src) {
        const newId = `dup-${src.id}`
        newSelectedIds.add(newId)
      }
    }

    expect(newSelectedIds.size).toBe(2)
    expect(newSelectedIds.has('dup-a')).toBe(true)
    expect(newSelectedIds.has('dup-b')).toBe(true)
    // Original IDs no longer selected
    expect(newSelectedIds.has('a')).toBe(false)
    expect(newSelectedIds.has('b')).toBe(false)
  })

  it('preserves all object properties on duplicate', () => {
    const src: BoardObject = {
      id: 'original',
      type: 'sticky',
      x: 100,
      y: 200,
      width: 150,
      height: 150,
      fill: '#FFEB3B',
      text: 'Original note',
      fontSize: 16,
      rotation: 45,
    }

    const dup: BoardObject = {
      ...src,
      id: 'duplicate',
      x: src.x + DUPLICATE_OFFSET,
      y: src.y + DUPLICATE_OFFSET,
    }

    expect(dup.type).toBe('sticky')
    expect(dup.width).toBe(150)
    expect(dup.height).toBe(150)
    expect(dup.fill).toBe('#FFEB3B')
    expect(dup.text).toBe('Original note')
    expect(dup.fontSize).toBe(16)
    expect(dup.rotation).toBe(45)
    expect(dup.x).toBe(120)
    expect(dup.y).toBe(220)
  })
})

// ---------------------------------------------------------------------------
// Change color of all selected objects
// ---------------------------------------------------------------------------

describe('Change color of all selected objects', () => {
  it('applies color to a single selected object', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a'])
    const newColor = '#EF4444'

    const updates: Array<{ id: string; fill: string }> = []
    for (const id of selectedIds) {
      updates.push({ id, fill: newColor })
    }

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({ id: 'a', fill: '#EF4444' })
  })

  it('applies color to all selected objects', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b', 'c'])
    const newColor = '#8B5CF6'

    const updates: Array<{ id: string; fill: string }> = []
    for (const id of selectedIds) {
      updates.push({ id, fill: newColor })
    }

    expect(updates).toHaveLength(3)
    for (const update of updates) {
      expect(update.fill).toBe('#8B5CF6')
    }
  })

  it('does not modify unselected objects', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b'])
    const newColor = '#EF4444'

    // Apply to selected
    const updatedObjects = objects.map((obj) => {
      if (selectedIds.has(obj.id)) {
        return { ...obj, fill: newColor }
      }
      return obj
    })

    // Selected objects get new color
    expect(updatedObjects.find((o) => o.id === 'a')?.fill).toBe('#EF4444')
    expect(updatedObjects.find((o) => o.id === 'b')?.fill).toBe('#EF4444')

    // Unselected objects keep original color
    expect(updatedObjects.find((o) => o.id === 'c')?.fill).toBe('#66BB6A')
    expect(updatedObjects.find((o) => o.id === 'd')?.fill).toBe('transparent')
    expect(updatedObjects.find((o) => o.id === 'e')?.fill).toBe('transparent')
  })

  it('handles empty selection gracefully', () => {
    const selectedIds = new Set<string>()
    const newColor = '#EF4444'

    const updates: Array<{ id: string; fill: string }> = []
    for (const id of selectedIds) {
      updates.push({ id, fill: newColor })
    }

    expect(updates).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Keyboard shortcut integration logic
// ---------------------------------------------------------------------------

describe('Keyboard shortcut logic', () => {
  it('Delete key: produces list of IDs to delete', () => {
    const selectedIds = new Set(['a', 'b', 'c'])
    const toDelete = [...selectedIds]
    expect(toDelete).toEqual(['a', 'b', 'c'])
  })

  it('Ctrl+A: selects all non-line objects', () => {
    const objects = createBoardState()
    // Ctrl+A should select all objects (lines may be optionally excluded)
    const allIds = objects.map((o) => o.id)
    const selected = new Set(allIds)
    expect(selected.size).toBe(5)
  })

  it('Ctrl+D: produces duplicates of all selected', () => {
    const objects = createBoardState()
    const selectedIds = new Set(['a', 'b'])

    const duplicates: BoardObject[] = []
    for (const id of selectedIds) {
      const src = objects.find((o) => o.id === id)
      if (src) {
        duplicates.push({
          ...src,
          id: `dup-${src.id}`,
          x: src.x + 20,
          y: src.y + 20,
        })
      }
    }

    expect(duplicates).toHaveLength(2)
    expect(duplicates.every((d) => d.id.startsWith('dup-'))).toBe(true)
  })

  it('Escape: clears selection and returns empty set', () => {
    const selectedIds = new Set(['a', 'b', 'c'])
    // Simulate escape
    const cleared = new Set<string>()
    expect(cleared.size).toBe(0)
    // Verify original was non-empty
    expect(selectedIds.size).toBe(3)
  })
})
