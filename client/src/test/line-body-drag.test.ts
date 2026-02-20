/**
 * Line Body Drag Tests (TDD — Red Phase)
 *
 * Tests the logic for dragging a line/arrow by its body (not endpoints).
 * When body-dragging, both endpoints move by the same delta, preserving
 * the line's length and angle. Connected endpoints (fromId/toId) detach.
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Pure helper: compute body drag update
// ---------------------------------------------------------------------------

/**
 * Given a drag delta and the current line state, compute the Partial<BoardObject>
 * update needed to move the entire line by (dx, dy).
 *
 * This is the core logic that Connector.tsx will use in handleBodyDragEnd.
 */
interface LineDragInput {
  objX: number
  objY: number
  points: number[] // [relX1, relY1, relX2, relY2]
  dx: number
  dy: number
  fromId?: string
  toId?: string
}

interface LineDragResult {
  x: number
  y: number
  width: number
  height: number
  points: number[]
  fromId: undefined
  toId: undefined
}

function computeBodyDragUpdate(input: LineDragInput): LineDragResult {
  const { objX, objY, points, dx, dy } = input

  // Absolute positions of endpoints
  const absX1 = objX + points[0] + dx
  const absY1 = objY + points[1] + dy
  const absX2 = objX + points[2] + dx
  const absY2 = objY + points[3] + dy

  // New obj.x / obj.y = min of the two endpoints
  const newX = Math.min(absX1, absX2)
  const newY = Math.min(absY1, absY2)

  return {
    x: newX,
    y: newY,
    width: Math.abs(absX2 - absX1) || 1,
    height: Math.abs(absY2 - absY1) || 1,
    points: [
      absX1 - newX,
      absY1 - newY,
      absX2 - newX,
      absY2 - newY,
    ],
    fromId: undefined,
    toId: undefined,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeBodyDragUpdate', () => {
  it('moves both endpoints by the drag delta', () => {
    const result = computeBodyDragUpdate({
      objX: 100, objY: 100,
      points: [0, 0, 200, 100],
      dx: 50, dy: 30,
      fromId: undefined, toId: undefined,
    })

    // Original abs endpoints: (100, 100) and (300, 200)
    // After drag: (150, 130) and (350, 230)
    // New obj position: min = (150, 130)
    expect(result.x).toBe(150)
    expect(result.y).toBe(130)
    // Points relative to new obj position
    expect(result.points).toEqual([0, 0, 200, 100])
  })

  it('preserves line length and angle', () => {
    const result = computeBodyDragUpdate({
      objX: 50, objY: 50,
      points: [0, 0, 100, 0], // horizontal line
      dx: 200, dy: 150,
      fromId: undefined, toId: undefined,
    })

    // Width should remain 100 (length of horizontal line)
    expect(result.width).toBe(100)
    // Height is 0, so should be clamped to 1
    expect(result.height).toBe(1)
    // Relative points stay the same
    expect(result.points).toEqual([0, 0, 100, 0])
  })

  it('detaches fromId and toId connections', () => {
    const result = computeBodyDragUpdate({
      objX: 100, objY: 100,
      points: [0, 0, 150, 80],
      dx: 10, dy: 10,
      fromId: 'shape-1',
      toId: 'shape-2',
    })

    expect(result.fromId).toBeUndefined()
    expect(result.toId).toBeUndefined()
  })

  it('handles negative drag deltas', () => {
    const result = computeBodyDragUpdate({
      objX: 300, objY: 300,
      points: [0, 0, 100, 50],
      dx: -100, dy: -50,
      fromId: undefined, toId: undefined,
    })

    // Original abs: (300, 300) and (400, 350)
    // After drag: (200, 250) and (300, 300)
    expect(result.x).toBe(200)
    expect(result.y).toBe(250)
  })

  it('handles lines where start is below/right of end', () => {
    const result = computeBodyDragUpdate({
      objX: 100, objY: 100,
      points: [200, 150, 0, 0], // start is bottom-right, end is top-left
      dx: 50, dy: 50,
      fromId: undefined, toId: undefined,
    })

    // Original abs: start=(300, 250), end=(100, 100)
    // After drag: start=(350, 300), end=(150, 150)
    // New obj = min(150, 350), min(150, 300) = (150, 150)
    expect(result.x).toBe(150)
    expect(result.y).toBe(150)
    expect(result.points).toEqual([200, 150, 0, 0])
  })

  it('handles zero-length drag (no-op)', () => {
    const result = computeBodyDragUpdate({
      objX: 100, objY: 200,
      points: [0, 0, 50, 50],
      dx: 0, dy: 0,
      fromId: undefined, toId: undefined,
    })

    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
    expect(result.points).toEqual([0, 0, 50, 50])
  })
})
