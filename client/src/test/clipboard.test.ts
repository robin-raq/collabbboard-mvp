/**
 * Clipboard Copy/Paste Tests (TDD — Red Phase)
 *
 * Tests the pure clipboard utility functions:
 *  - copyObjects: snapshot selected objects into a clipboard
 *  - pasteObjects: produce new objects with fresh IDs and stacked offset
 */

import { describe, it, expect } from 'vitest'
import type { BoardObject } from '../types'
import {
  copyObjects,
  pasteObjects,
  PASTE_OFFSET,
  type ClipboardState,
} from '../utils/clipboard'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeObj(
  id: string,
  x: number,
  y: number,
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
// copyObjects
// ---------------------------------------------------------------------------

describe('copyObjects', () => {
  it('copies a single selected object', () => {
    const objects = createBoardState()
    const result = copyObjects(objects, new Set(['a']))

    expect(result).not.toBeNull()
    expect(result!.objects).toHaveLength(1)
    expect(result!.objects[0].id).toBe('a')
    expect(result!.objects[0].type).toBe('sticky')
    expect(result!.objects[0].text).toBe('Note A')
    expect(result!.pasteCount).toBe(0)
  })

  it('copies multiple selected objects', () => {
    const objects = createBoardState()
    const result = copyObjects(objects, new Set(['a', 'b', 'c']))

    expect(result).not.toBeNull()
    expect(result!.objects).toHaveLength(3)

    const ids = result!.objects.map((o) => o.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    expect(result!.pasteCount).toBe(0)
  })

  it('returns null for empty selection', () => {
    const objects = createBoardState()
    const result = copyObjects(objects, new Set<string>())
    expect(result).toBeNull()
  })

  it('returns null when no selected IDs match any objects', () => {
    const objects = createBoardState()
    const result = copyObjects(objects, new Set(['nonexistent', 'also-missing']))
    expect(result).toBeNull()
  })

  it('preserves all BoardObject fields', () => {
    const fullObj = makeObj('full', 50, 75, {
      type: 'line',
      text: 'label',
      fill: '#FF0000',
      fontSize: 24,
      points: [0, 0, 100, 50],
      fromId: 'obj-1',
      toId: 'obj-2',
      arrowEnd: true,
      rotation: 45,
    })
    const result = copyObjects([fullObj], new Set(['full']))

    expect(result).not.toBeNull()
    const copied = result!.objects[0]
    expect(copied.type).toBe('line')
    expect(copied.text).toBe('label')
    expect(copied.fill).toBe('#FF0000')
    expect(copied.fontSize).toBe(24)
    expect(copied.points).toEqual([0, 0, 100, 50])
    expect(copied.fromId).toBe('obj-1')
    expect(copied.toId).toBe('obj-2')
    expect(copied.arrowEnd).toBe(true)
    expect(copied.rotation).toBe(45)
    expect(copied.width).toBe(100)
    expect(copied.height).toBe(100)
  })

  it('deep-clones objects so mutations do not affect clipboard', () => {
    const objects = createBoardState()
    const result = copyObjects(objects, new Set(['a']))
    expect(result).not.toBeNull()

    // Mutate the original object
    objects[0].x = 9999
    objects[0].text = 'MUTATED'

    // Clipboard should still have original values
    expect(result!.objects[0].x).toBe(100)
    expect(result!.objects[0].text).toBe('Note A')
  })
})

// ---------------------------------------------------------------------------
// pasteObjects
// ---------------------------------------------------------------------------

describe('pasteObjects', () => {
  let counter: number

  function deterministicId(): string {
    return `paste-${counter++}`
  }

  beforeEach(() => {
    counter = 0
  })

  it('pastes a single object with +20px offset', () => {
    const clipboard: ClipboardState = {
      objects: [makeObj('a', 100, 100)],
      pasteCount: 0,
    }
    const { objects, newPasteCount } = pasteObjects(clipboard, deterministicId)

    expect(objects).toHaveLength(1)
    expect(objects[0].x).toBe(100 + PASTE_OFFSET)
    expect(objects[0].y).toBe(100 + PASTE_OFFSET)
    expect(newPasteCount).toBe(1)
  })

  it('generates new unique IDs for pasted objects', () => {
    const clipboard: ClipboardState = {
      objects: [makeObj('a', 100, 100), makeObj('b', 200, 200)],
      pasteCount: 0,
    }
    const { objects } = pasteObjects(clipboard, deterministicId)

    expect(objects[0].id).toBe('paste-0')
    expect(objects[1].id).toBe('paste-1')
    expect(objects[0].id).not.toBe('a')
    expect(objects[1].id).not.toBe('b')
  })

  it('preserves relative positions between multiple objects', () => {
    const clipboard: ClipboardState = {
      objects: [
        makeObj('a', 100, 100),
        makeObj('b', 300, 100), // 200px to the right of a
      ],
      pasteCount: 0,
    }
    const { objects } = pasteObjects(clipboard, deterministicId)

    // Relative offset should be preserved: b.x - a.x === 200
    expect(objects[1].x - objects[0].x).toBe(200)
    // Both shifted by PASTE_OFFSET
    expect(objects[0].x).toBe(100 + PASTE_OFFSET)
    expect(objects[1].x).toBe(300 + PASTE_OFFSET)
  })

  it('stacks offset: second paste offsets by +40', () => {
    const clipboard: ClipboardState = {
      objects: [makeObj('a', 100, 100)],
      pasteCount: 1, // Already pasted once
    }
    const { objects, newPasteCount } = pasteObjects(clipboard, deterministicId)

    expect(objects[0].x).toBe(100 + 2 * PASTE_OFFSET) // +40
    expect(objects[0].y).toBe(100 + 2 * PASTE_OFFSET)
    expect(newPasteCount).toBe(2)
  })

  it('stacks offset: third paste offsets by +60', () => {
    const clipboard: ClipboardState = {
      objects: [makeObj('a', 100, 100)],
      pasteCount: 2,
    }
    const { objects, newPasteCount } = pasteObjects(clipboard, deterministicId)

    expect(objects[0].x).toBe(100 + 3 * PASTE_OFFSET) // +60
    expect(objects[0].y).toBe(100 + 3 * PASTE_OFFSET)
    expect(newPasteCount).toBe(3)
  })

  it('preserves all properties except id, x, y', () => {
    const clipboard: ClipboardState = {
      objects: [
        makeObj('original', 50, 75, {
          type: 'sticky',
          text: 'Hello World',
          fill: '#FFEB3B',
          fontSize: 18,
          rotation: 90,
          width: 200,
          height: 150,
        }),
      ],
      pasteCount: 0,
    }
    const { objects } = pasteObjects(clipboard, deterministicId)
    const pasted = objects[0]

    // Changed
    expect(pasted.id).not.toBe('original')
    expect(pasted.x).not.toBe(50)
    expect(pasted.y).not.toBe(75)

    // Preserved
    expect(pasted.type).toBe('sticky')
    expect(pasted.text).toBe('Hello World')
    expect(pasted.fill).toBe('#FFEB3B')
    expect(pasted.fontSize).toBe(18)
    expect(pasted.rotation).toBe(90)
    expect(pasted.width).toBe(200)
    expect(pasted.height).toBe(150)
  })

  it('handles line objects with points/fromId/toId', () => {
    const clipboard: ClipboardState = {
      objects: [
        makeObj('line-1', 50, 50, {
          type: 'line',
          points: [0, 0, 100, 50],
          fromId: 'obj-1',
          toId: 'obj-2',
          arrowEnd: true,
        }),
      ],
      pasteCount: 0,
    }
    const { objects } = pasteObjects(clipboard, deterministicId)
    const pasted = objects[0]

    expect(pasted.type).toBe('line')
    expect(pasted.points).toEqual([0, 0, 100, 50])
    expect(pasted.fromId).toBe('obj-1') // Kept as-is (connector may be broken)
    expect(pasted.toId).toBe('obj-2')
    expect(pasted.arrowEnd).toBe(true)
    expect(pasted.x).toBe(50 + PASTE_OFFSET)
    expect(pasted.y).toBe(50 + PASTE_OFFSET)
  })
})

// ---------------------------------------------------------------------------
// Integration: copy → paste flows
// ---------------------------------------------------------------------------

describe('copy then paste integration', () => {
  it('new copy resets paste offset', () => {
    const objects = createBoardState()

    // First copy
    const clip1 = copyObjects(objects, new Set(['a']))!
    expect(clip1.pasteCount).toBe(0)

    // Paste once → pasteCount becomes 1
    const { newPasteCount } = pasteObjects(clip1, () => 'id-1')
    expect(newPasteCount).toBe(1)

    // New copy → pasteCount resets to 0
    const clip2 = copyObjects(objects, new Set(['b']))!
    expect(clip2.pasteCount).toBe(0)

    // Next paste uses offset +20 (not +40)
    const { objects: pasted } = pasteObjects(clip2, () => 'id-2')
    expect(pasted[0].x).toBe(300 + PASTE_OFFSET) // b starts at x=300
  })

  it('paste returns valid BoardObject array', () => {
    const objects = createBoardState()
    const clip = copyObjects(objects, new Set(['a', 'b']))!
    const { objects: pasted } = pasteObjects(clip, () => crypto.randomUUID())

    for (const obj of pasted) {
      // Every required field is present
      expect(obj.id).toBeDefined()
      expect(obj.type).toBeDefined()
      expect(typeof obj.x).toBe('number')
      expect(typeof obj.y).toBe('number')
      expect(typeof obj.width).toBe('number')
      expect(typeof obj.height).toBe('number')
      expect(typeof obj.fill).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
// PASTE_OFFSET constant
// ---------------------------------------------------------------------------

describe('PASTE_OFFSET', () => {
  it('equals 20 (matches Ctrl+D duplicate offset)', () => {
    expect(PASTE_OFFSET).toBe(20)
  })
})
