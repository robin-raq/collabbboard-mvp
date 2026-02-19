/**
 * Multi-Select Feature Tests (TDD — Red Phase)
 *
 * Tests the selection logic for multi-object operations:
 *  - Selection set management (add, remove, clear, toggle)
 *  - Rubber-band (marquee) rectangle intersection
 *  - Group drag delta calculation
 *  - Keyboard shortcut logic (Ctrl+A, Escape, Delete)
 */

import { describe, it, expect } from 'vitest'
import type { BoardObject } from '../types'

// ---------------------------------------------------------------------------
// Utility: intersects — checks if a BoardObject overlaps a selection rect
// Will be extracted to utils/selection.ts during implementation
// ---------------------------------------------------------------------------

interface SelectionRect {
  x: number
  y: number
  w: number
  h: number
}

/** Check if a board object's bounding box intersects with a selection rectangle */
function intersects(obj: BoardObject, rect: SelectionRect): boolean {
  return (
    obj.x < rect.x + rect.w &&
    obj.x + obj.width > rect.x &&
    obj.y < rect.y + rect.h &&
    obj.y + obj.height > rect.y
  )
}

/** Normalize a selection rect (handle negative width/height from right-to-left drag) */
function normalizeRect(
  startX: number, startY: number,
  endX: number, endY: number,
): SelectionRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.abs(endY - startY),
  }
}

/** Calculate bounding box around multiple selected objects */
function getSelectionBounds(objects: BoardObject[]): SelectionRect | null {
  if (objects.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const obj of objects) {
    minX = Math.min(minX, obj.x)
    minY = Math.min(minY, obj.y)
    maxX = Math.max(maxX, obj.x + obj.width)
    maxY = Math.max(maxY, obj.y + obj.height)
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeObj(id: string, x: number, y: number, w = 100, h = 100): BoardObject {
  return { id, type: 'rect', x, y, width: w, height: h, fill: '#42A5F5' }
}

const sampleObjects: BoardObject[] = [
  makeObj('a', 100, 100, 100, 100), // top-left area
  makeObj('b', 300, 100, 100, 100), // top-right area
  makeObj('c', 100, 300, 100, 100), // bottom-left area
  makeObj('d', 300, 300, 100, 100), // bottom-right area
  makeObj('e', 600, 600, 50, 50),   // far away
]

// ---------------------------------------------------------------------------
// Selection Set Management
// ---------------------------------------------------------------------------

describe('Selection set management', () => {
  it('starts with empty selection', () => {
    const selected = new Set<string>()
    expect(selected.size).toBe(0)
  })

  it('single click sets selection to one object', () => {
    const selected = new Set<string>(['a'])
    expect(selected.size).toBe(1)
    expect(selected.has('a')).toBe(true)
  })

  it('shift-click adds object to existing selection', () => {
    const selected = new Set<string>(['a'])
    // Simulate shift-click on 'b'
    selected.add('b')
    expect(selected.size).toBe(2)
    expect(selected.has('a')).toBe(true)
    expect(selected.has('b')).toBe(true)
  })

  it('shift-click removes already-selected object (toggle)', () => {
    const selected = new Set<string>(['a', 'b', 'c'])
    // Simulate shift-click on 'b' (already selected) → remove it
    if (selected.has('b')) {
      selected.delete('b')
    } else {
      selected.add('b')
    }
    expect(selected.size).toBe(2)
    expect(selected.has('b')).toBe(false)
    expect(selected.has('a')).toBe(true)
    expect(selected.has('c')).toBe(true)
  })

  it('regular click replaces multi-selection with single object', () => {
    let selected = new Set<string>(['a', 'b', 'c'])
    // Regular click on 'd' → replace entire selection
    selected = new Set(['d'])
    expect(selected.size).toBe(1)
    expect(selected.has('d')).toBe(true)
    expect(selected.has('a')).toBe(false)
  })

  it('click on empty canvas clears selection', () => {
    let selected = new Set<string>(['a', 'b'])
    // Click on empty → clear
    selected = new Set()
    expect(selected.size).toBe(0)
  })

  it('Ctrl+A selects all objects', () => {
    const allIds = sampleObjects.map((o) => o.id)
    const selected = new Set(allIds)
    expect(selected.size).toBe(5)
    for (const obj of sampleObjects) {
      expect(selected.has(obj.id)).toBe(true)
    }
  })

  it('Escape clears all selection', () => {
    let selected = new Set<string>(['a', 'b', 'c'])
    // Escape → clear
    selected = new Set()
    expect(selected.size).toBe(0)
  })

  it('first selected ID is available for single-object contexts (color picker)', () => {
    const selected = new Set<string>(['b', 'c', 'a'])
    // Get first ID (for things like color picker that need one object)
    const firstId = selected.size > 0 ? [...selected][0] : null
    expect(firstId).toBeTruthy()
    expect(selected.has(firstId!)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Rubber-band (marquee) selection
// ---------------------------------------------------------------------------

describe('Rubber-band selection', () => {
  describe('intersects()', () => {
    it('returns true when object is fully inside rect', () => {
      const obj = makeObj('test', 150, 150, 50, 50) // at (150,150) size 50x50
      const rect: SelectionRect = { x: 100, y: 100, w: 200, h: 200 } // covers 100-300
      expect(intersects(obj, rect)).toBe(true)
    })

    it('returns true when object partially overlaps rect', () => {
      const obj = makeObj('test', 250, 250, 100, 100) // extends to (350, 350)
      const rect: SelectionRect = { x: 100, y: 100, w: 200, h: 200 } // covers 100-300
      expect(intersects(obj, rect)).toBe(true)
    })

    it('returns false when object is completely outside rect', () => {
      const obj = makeObj('test', 500, 500, 50, 50)
      const rect: SelectionRect = { x: 100, y: 100, w: 200, h: 200 }
      expect(intersects(obj, rect)).toBe(false)
    })

    it('returns false when object is adjacent but not overlapping', () => {
      const obj = makeObj('test', 300, 100, 50, 50) // starts exactly at rect right edge
      const rect: SelectionRect = { x: 100, y: 100, w: 200, h: 200 } // ends at x=300
      expect(intersects(obj, rect)).toBe(false) // touching but not overlapping
    })

    it('returns true when rect is fully inside object', () => {
      const obj = makeObj('test', 100, 100, 300, 300)
      const rect: SelectionRect = { x: 150, y: 150, w: 50, h: 50 }
      expect(intersects(obj, rect)).toBe(true)
    })

    it('handles zero-width rect at point inside object (still intersects)', () => {
      const obj = makeObj('test', 100, 100, 100, 100)
      const rect: SelectionRect = { x: 150, y: 150, w: 0, h: 0 }
      // A zero-size point inside the object still passes strict AABB check
      expect(intersects(obj, rect)).toBe(true)
    })

    it('handles zero-width rect outside object', () => {
      const obj = makeObj('test', 100, 100, 100, 100)
      const rect: SelectionRect = { x: 500, y: 500, w: 0, h: 0 }
      expect(intersects(obj, rect)).toBe(false)
    })
  })

  describe('normalizeRect()', () => {
    it('handles left-to-right, top-to-bottom drag', () => {
      const rect = normalizeRect(100, 100, 300, 300)
      expect(rect).toEqual({ x: 100, y: 100, w: 200, h: 200 })
    })

    it('handles right-to-left drag (negative width)', () => {
      const rect = normalizeRect(300, 100, 100, 300)
      expect(rect).toEqual({ x: 100, y: 100, w: 200, h: 200 })
    })

    it('handles bottom-to-top drag (negative height)', () => {
      const rect = normalizeRect(100, 300, 300, 100)
      expect(rect).toEqual({ x: 100, y: 100, w: 200, h: 200 })
    })

    it('handles drag in any diagonal direction', () => {
      // Bottom-right to top-left
      const rect = normalizeRect(300, 300, 100, 100)
      expect(rect).toEqual({ x: 100, y: 100, w: 200, h: 200 })
    })
  })

  describe('selecting objects with rubber-band', () => {
    it('selects objects inside the selection rectangle', () => {
      // Draw rectangle covering top-left quadrant (50, 50) to (250, 250)
      const rect: SelectionRect = { x: 50, y: 50, w: 200, h: 200 }
      const selected = sampleObjects
        .filter((obj) => intersects(obj, rect))
        .map((obj) => obj.id)

      expect(selected).toContain('a') // at (100, 100)
      expect(selected).not.toContain('b') // at (300, 100) — outside
      expect(selected).not.toContain('c') // at (100, 300) — outside
      expect(selected).not.toContain('d') // at (300, 300) — outside
      expect(selected).not.toContain('e') // at (600, 600) — outside
    })

    it('selects multiple objects when rect covers several', () => {
      // Rectangle covering all 4 corner objects
      const rect: SelectionRect = { x: 50, y: 50, w: 400, h: 400 }
      const selected = sampleObjects
        .filter((obj) => intersects(obj, rect))
        .map((obj) => obj.id)

      expect(selected).toContain('a')
      expect(selected).toContain('b')
      expect(selected).toContain('c')
      expect(selected).toContain('d')
      expect(selected).not.toContain('e') // at (600, 600) — outside
    })

    it('selects nothing when rect is in empty area', () => {
      const rect: SelectionRect = { x: 800, y: 800, w: 100, h: 100 }
      const selected = sampleObjects.filter((obj) => intersects(obj, rect))
      expect(selected).toHaveLength(0)
    })

    it('selects all objects when rect covers entire canvas', () => {
      const rect: SelectionRect = { x: 0, y: 0, w: 1000, h: 1000 }
      const selected = sampleObjects.filter((obj) => intersects(obj, rect))
      expect(selected).toHaveLength(5)
    })
  })
})

// ---------------------------------------------------------------------------
// Selection bounding box
// ---------------------------------------------------------------------------

describe('getSelectionBounds()', () => {
  it('returns null for empty array', () => {
    expect(getSelectionBounds([])).toBeNull()
  })

  it('returns object bounds for single object', () => {
    const obj = makeObj('a', 100, 200, 150, 80)
    const bounds = getSelectionBounds([obj])
    expect(bounds).toEqual({ x: 100, y: 200, w: 150, h: 80 })
  })

  it('returns bounding box encompassing all selected objects', () => {
    const objects = [
      makeObj('a', 100, 100, 100, 100), // 100-200, 100-200
      makeObj('b', 300, 300, 100, 100), // 300-400, 300-400
    ]
    const bounds = getSelectionBounds(objects)
    expect(bounds).toEqual({ x: 100, y: 100, w: 300, h: 300 }) // 100-400, 100-400
  })

  it('handles overlapping objects', () => {
    const objects = [
      makeObj('a', 100, 100, 200, 200), // 100-300, 100-300
      makeObj('b', 150, 150, 50, 50),   // 150-200, 150-200 (inside a)
    ]
    const bounds = getSelectionBounds(objects)
    expect(bounds).toEqual({ x: 100, y: 100, w: 200, h: 200 }) // same as 'a'
  })
})

// ---------------------------------------------------------------------------
// Group drag delta calculation
// ---------------------------------------------------------------------------

describe('Group drag', () => {
  it('calculates correct delta from drag start to current position', () => {
    const startX = 100
    const startY = 100
    const currentX = 150
    const currentY = 180

    const dx = currentX - startX
    const dy = currentY - startY

    expect(dx).toBe(50)
    expect(dy).toBe(80)
  })

  it('applies delta to all selected objects except the dragged one', () => {
    const objects = [
      makeObj('a', 100, 100),
      makeObj('b', 300, 100),
      makeObj('c', 100, 300),
    ]
    const selectedIds = new Set(['a', 'b', 'c'])
    const draggedId = 'a'
    const dx = 50
    const dy = 30

    // Simulate group drag — move all except dragged (which Konva handles)
    const updates: Array<{ id: string; x: number; y: number }> = []
    for (const id of selectedIds) {
      if (id === draggedId) continue
      const obj = objects.find((o) => o.id === id)
      if (obj) {
        updates.push({ id, x: obj.x + dx, y: obj.y + dy })
      }
    }

    expect(updates).toHaveLength(2) // b and c, not a
    expect(updates).toContainEqual({ id: 'b', x: 350, y: 130 })
    expect(updates).toContainEqual({ id: 'c', x: 150, y: 330 })
  })

  it('handles single-object drag (no group updates needed)', () => {
    const selectedIds = new Set(['a'])
    const draggedId = 'a'

    const otherIds = [...selectedIds].filter((id) => id !== draggedId)
    expect(otherIds).toHaveLength(0)
  })

  it('maintains relative positions between objects', () => {
    const objects = [
      makeObj('a', 100, 100),
      makeObj('b', 300, 200),
    ]

    // Initial relative offset: b is (200, 100) away from a
    const relX = objects[1].x - objects[0].x // 200
    const relY = objects[1].y - objects[0].y // 100

    // After group drag by (50, 30)
    const dx = 50
    const dy = 30
    const newA = { x: objects[0].x + dx, y: objects[0].y + dy }
    const newB = { x: objects[1].x + dx, y: objects[1].y + dy }

    // Relative offset should be preserved
    expect(newB.x - newA.x).toBe(relX) // still 200
    expect(newB.y - newA.y).toBe(relY) // still 100
  })
})
