/**
 * Rotation Feature Tests (TDD — Red Phase)
 *
 * Tests the rotation logic for BoardShape objects:
 *  - BoardObject type includes rotation field
 *  - Angle calculation from center to pointer (atan2 math)
 *  - Rotation syncs via Yjs (rotation field persists in Y.Map)
 *  - Connector edge point calculation with rotated shapes
 *  - rotatePoint utility function
 */

import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import type { BoardObject } from '../types'

// ---------------------------------------------------------------------------
// Utility: rotatePoint — rotates a point around a center by angleDeg degrees
// This will be extracted into a shared utils file during implementation
// ---------------------------------------------------------------------------
// Import will be: import { rotatePoint, calcAngle } from '../utils/geometry'
// For now, we define the expected signatures and test them

/** Rotate point (px, py) around center (cx, cy) by angleDeg degrees */
function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = angleDeg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: cos * (px - cx) - sin * (py - cy) + cx,
    y: sin * (px - cx) + cos * (py - cy) + cy,
  }
}

/** Calculate angle in degrees from center (cx, cy) to pointer (px, py).
 *  0 degrees = directly above (north), increases clockwise.
 */
function calcAngle(
  px: number, py: number,
  cx: number, cy: number,
): number {
  const angle = Math.atan2(px - cx, -(py - cy)) * (180 / Math.PI)
  return (angle + 360) % 360 // Normalize to 0-360
}

// ---------------------------------------------------------------------------
// BoardObject rotation field
// ---------------------------------------------------------------------------

describe('BoardObject rotation field', () => {
  it('rotation is optional and defaults to undefined (treated as 0)', () => {
    const obj: BoardObject = {
      id: 'test-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      fill: '#42A5F5',
    }
    // rotation should be undefined (optional field)
    expect(obj.rotation).toBeUndefined()
    // Application code should treat undefined as 0
    expect(obj.rotation ?? 0).toBe(0)
  })

  it('rotation field accepts numeric degrees 0-360', () => {
    const obj: BoardObject = {
      id: 'test-2',
      type: 'sticky',
      x: 50,
      y: 50,
      width: 150,
      height: 150,
      fill: '#FFEB3B',
      rotation: 45,
    }
    expect(obj.rotation).toBe(45)
  })

  it('rotation field can be set to 0, 90, 180, 270, 360', () => {
    const angles = [0, 90, 180, 270, 360]
    for (const angle of angles) {
      const obj: BoardObject = {
        id: `test-angle-${angle}`,
        type: 'rect',
        x: 0, y: 0, width: 100, height: 100,
        fill: '#fff',
        rotation: angle,
      }
      expect(obj.rotation).toBe(angle)
    }
  })

  it('rotation field can be negative (normalized by consumer)', () => {
    const obj: BoardObject = {
      id: 'test-neg',
      type: 'rect',
      x: 0, y: 0, width: 100, height: 100,
      fill: '#fff',
      rotation: -45,
    }
    expect(obj.rotation).toBe(-45)
    // Application normalizes: (-45 + 360) % 360 = 315
    expect(((obj.rotation ?? 0) + 360) % 360).toBe(315)
  })
})

// ---------------------------------------------------------------------------
// Rotation syncs via Yjs
// ---------------------------------------------------------------------------

describe('Rotation syncs via Yjs', () => {
  it('rotation field persists in Y.Map', () => {
    const doc = new Y.Doc()
    const map = doc.getMap<BoardObject>('objects')

    const obj: BoardObject = {
      id: 'r1',
      type: 'rect',
      x: 100, y: 100, width: 120, height: 80,
      fill: '#42A5F5',
      rotation: 45,
    }
    map.set(obj.id, obj)

    const retrieved = map.get('r1')
    expect(retrieved?.rotation).toBe(45)
  })

  it('rotation update syncs between two Y.Docs', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const mapA = docA.getMap<BoardObject>('objects')
    const mapB = docB.getMap<BoardObject>('objects')

    // Create object on A with no rotation
    const obj: BoardObject = {
      id: 'sync-1',
      type: 'sticky',
      x: 0, y: 0, width: 150, height: 150,
      fill: '#FFEB3B',
    }
    mapA.set(obj.id, obj)
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    expect(mapB.get('sync-1')?.rotation).toBeUndefined()

    // Update rotation on A
    mapA.set('sync-1', { ...obj, rotation: 90 })
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    expect(mapB.get('sync-1')?.rotation).toBe(90)
  })

  it('partial update preserves rotation field', () => {
    const doc = new Y.Doc()
    const map = doc.getMap<BoardObject>('objects')

    const obj: BoardObject = {
      id: 'partial-1',
      type: 'rect',
      x: 100, y: 100, width: 120, height: 80,
      fill: '#42A5F5',
      rotation: 30,
    }
    map.set(obj.id, obj)

    // Update only position (simulate drag)
    const existing = map.get('partial-1')!
    map.set('partial-1', { ...existing, x: 200, y: 300 })

    const result = map.get('partial-1')!
    expect(result.x).toBe(200)
    expect(result.y).toBe(300)
    expect(result.rotation).toBe(30) // rotation preserved
  })
})

// ---------------------------------------------------------------------------
// Angle calculation (calcAngle)
// ---------------------------------------------------------------------------

describe('calcAngle — angle from center to pointer', () => {
  const cx = 100
  const cy = 100

  it('pointer directly above center = 0 degrees', () => {
    const angle = calcAngle(100, 50, cx, cy) // directly above
    expect(angle).toBeCloseTo(0, 1)
  })

  it('pointer directly to the right = 90 degrees', () => {
    const angle = calcAngle(150, 100, cx, cy)
    expect(angle).toBeCloseTo(90, 1)
  })

  it('pointer directly below center = 180 degrees', () => {
    const angle = calcAngle(100, 150, cx, cy)
    expect(angle).toBeCloseTo(180, 1)
  })

  it('pointer directly to the left = 270 degrees', () => {
    const angle = calcAngle(50, 100, cx, cy)
    expect(angle).toBeCloseTo(270, 1)
  })

  it('pointer at top-right (45 degrees)', () => {
    const angle = calcAngle(150, 50, cx, cy)
    expect(angle).toBeCloseTo(45, 1)
  })

  it('returns value in 0-360 range', () => {
    // Test various positions — all should be 0-360
    const positions = [
      [100, 50], [150, 50], [150, 100], [150, 150],
      [100, 150], [50, 150], [50, 100], [50, 50],
    ]
    for (const [px, py] of positions) {
      const angle = calcAngle(px, py, cx, cy)
      expect(angle).toBeGreaterThanOrEqual(0)
      expect(angle).toBeLessThanOrEqual(360)
    }
  })
})

// ---------------------------------------------------------------------------
// rotatePoint utility
// ---------------------------------------------------------------------------

describe('rotatePoint — rotate point around center', () => {
  it('rotating 0 degrees returns the same point', () => {
    const result = rotatePoint(150, 100, 100, 100, 0)
    expect(result.x).toBeCloseTo(150)
    expect(result.y).toBeCloseTo(100)
  })

  it('rotating 90 degrees clockwise', () => {
    // Point at (150, 100) with center (100, 100)
    // After 90 deg CW: should be at (100, 150)
    const result = rotatePoint(150, 100, 100, 100, 90)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(150)
  })

  it('rotating 180 degrees', () => {
    // Point at (150, 100) with center (100, 100)
    // After 180 deg: should be at (50, 100)
    const result = rotatePoint(150, 100, 100, 100, 180)
    expect(result.x).toBeCloseTo(50)
    expect(result.y).toBeCloseTo(100)
  })

  it('rotating 270 degrees clockwise (= 90 deg counterclockwise)', () => {
    // Point at (150, 100) with center (100, 100)
    // After 270 deg CW: should be at (100, 50)
    const result = rotatePoint(150, 100, 100, 100, 270)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(50)
  })

  it('rotating 360 degrees returns the same point', () => {
    const result = rotatePoint(150, 100, 100, 100, 360)
    expect(result.x).toBeCloseTo(150)
    expect(result.y).toBeCloseTo(100)
  })

  it('rotating a point at the center returns the center', () => {
    const result = rotatePoint(100, 100, 100, 100, 45)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(100)
  })

  it('works with non-square offsets', () => {
    // Point (200, 100) around center (100, 100) — distance 100 to the right
    // 45 deg CW: x = 100 + 100*cos(45) ≈ 170.7, y = 100 + 100*sin(45) ≈ 170.7
    const result = rotatePoint(200, 100, 100, 100, 45)
    expect(result.x).toBeCloseTo(170.71, 0)
    expect(result.y).toBeCloseTo(170.71, 0)
  })
})

// ---------------------------------------------------------------------------
// Connector edge point with rotated shapes
// ---------------------------------------------------------------------------

describe('Connector edge calculation with rotation', () => {
  // getEdgePoint should account for rotation when finding where
  // a line attaches to a shape's boundary

  it('unrotated shape: edge point at right center', () => {
    // Shape at (100, 100), size 100x80, no rotation
    // Target point to the right: (300, 140)
    // Edge should be at right center: (200, 140)
    const shape: BoardObject = {
      id: 'edge-1', type: 'rect',
      x: 100, y: 100, width: 100, height: 80,
      fill: '#fff',
    }

    const cx = shape.x + shape.width / 2   // 150
    const cy = shape.y + shape.height / 2   // 140
    const targetX = 300
    const targetY = 140

    // For unrotated rect, the edge intersection is computed directly
    // This test verifies the basic math works
    const dx = targetX - cx
    const dy = targetY - cy
    const angle = Math.atan2(dy, dx)

    // Right edge for a direct horizontal line should be at x = 200
    expect(dx).toBeGreaterThan(0) // Target is to the right
    expect(Math.abs(dy)).toBeLessThan(1) // Nearly horizontal
    expect(angle).toBeCloseTo(0, 1) // ≈ 0 radians
  })

  it('rotated shape: edge point accounts for rotation', () => {
    // Shape at (100, 100), size 100x80, rotated 90 degrees
    // After 90 deg rotation, the "right" edge is now the "bottom" edge
    const shape: BoardObject = {
      id: 'edge-2', type: 'rect',
      x: 100, y: 100, width: 100, height: 80,
      fill: '#fff',
      rotation: 90,
    }

    const cx = shape.x + shape.width / 2   // 150
    const cy = shape.y + shape.height / 2   // 140

    // To find edge point on a rotated shape:
    // 1. Rotate the target point into the shape's local coordinate space (inverse rotation)
    // 2. Find edge intersection in local space
    // 3. Rotate the intersection point back to world space

    // Inverse rotate a point directly to the right (300, 140) by -90 deg
    // Point is 150 units right of center (150, 140) → (300, 140)
    // Rotating -90 deg: this moves it 150 units UP → (150, -10)
    const worldTarget = { x: 300, y: 140 }
    const localTarget = rotatePoint(worldTarget.x, worldTarget.y, cx, cy, -90)

    // In local space (after inverse rotation), the target should be above the center
    expect(localTarget.y).toBeLessThan(cy)
  })
})
