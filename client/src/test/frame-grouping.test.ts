/**
 * Frame Grouping Tests (TDD)
 *
 * Tests the client-side detectParentFrame helper that auto-sets parentId
 * when a user drags an object into a frame, and clears it when dragged out.
 */

import { describe, it, expect } from 'vitest'
import type { BoardObject } from '../types'
import { detectParentFrame } from '../Board'

// ---------------------------------------------------------------------------
// Helpers
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

function makeFrame(
  id: string, x: number, y: number,
  width = 400, height = 300,
): BoardObject {
  return {
    id,
    type: 'frame',
    x,
    y,
    width,
    height,
    fill: 'transparent',
    text: 'Frame',
  }
}

// ---------------------------------------------------------------------------
// detectParentFrame tests
// ---------------------------------------------------------------------------

describe('detectParentFrame', () => {
  it('returns frame ID when object is fully inside a frame', () => {
    const frame = makeFrame('frame-1', 50, 50, 400, 300)
    const objects = [frame, makeObj('sticky-1', 200, 200)]

    const result = detectParentFrame(
      'sticky-1',
      { x: 100, y: 100, width: 100, height: 100, type: 'rect' },
      objects
    )

    expect(result).toBe('frame-1')
  })

  it('returns undefined when object is outside all frames', () => {
    const frame = makeFrame('frame-1', 50, 50, 400, 300)
    const objects = [frame, makeObj('sticky-1', 600, 600)]

    const result = detectParentFrame(
      'sticky-1',
      { x: 600, y: 600, width: 100, height: 100, type: 'rect' },
      objects
    )

    expect(result).toBeUndefined()
  })

  it('returns undefined when object only partially overlaps a frame', () => {
    const frame = makeFrame('frame-1', 50, 50, 400, 300)
    const objects = [frame, makeObj('sticky-1', 400, 100)]

    // Object at x:400, width:100 → right edge at 500, but frame right edge is 450
    const result = detectParentFrame(
      'sticky-1',
      { x: 400, y: 100, width: 100, height: 100, type: 'rect' },
      objects
    )

    expect(result).toBeUndefined()
  })

  it('returns undefined for frame objects (frames do not nest)', () => {
    const outerFrame = makeFrame('outer', 0, 0, 1000, 1000)
    const innerFrame = makeFrame('inner', 100, 100, 200, 200)
    const objects = [outerFrame, innerFrame]

    const result = detectParentFrame(
      'inner',
      { x: 100, y: 100, width: 200, height: 200, type: 'frame' },
      objects
    )

    expect(result).toBeUndefined()
  })

  it('picks the smallest enclosing frame when multiple frames overlap', () => {
    const bigFrame = makeFrame('big', 0, 0, 800, 600)
    const smallFrame = makeFrame('small', 100, 100, 300, 200)
    const objects = [bigFrame, smallFrame, makeObj('sticky-1', 150, 150)]

    const result = detectParentFrame(
      'sticky-1',
      { x: 150, y: 150, width: 100, height: 100, type: 'rect' },
      objects
    )

    expect(result).toBe('small')
  })

  it('returns undefined when object is dragged out of its parent frame', () => {
    const frame = makeFrame('frame-1', 50, 50, 400, 300)
    const sticky = makeObj('sticky-1', 100, 100, { parentId: 'frame-1' })
    const objects = [frame, sticky]

    // Dragged to position outside the frame
    const result = detectParentFrame(
      'sticky-1',
      { x: 700, y: 700, width: 100, height: 100, type: 'rect' },
      objects
    )

    expect(result).toBeUndefined()
  })

  it('does not match the object against itself', () => {
    // Edge case: a frame-sized rect shouldn't match itself
    const frame = makeFrame('frame-1', 50, 50, 400, 300)
    const objects = [frame]

    const result = detectParentFrame(
      'frame-1',
      { x: 50, y: 50, width: 400, height: 300, type: 'frame' },
      objects
    )

    expect(result).toBeUndefined()
  })
})
