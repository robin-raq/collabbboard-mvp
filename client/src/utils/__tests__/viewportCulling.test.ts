import { describe, it, expect } from 'vitest'
import { getVisibleBounds, isObjectVisible, cullObjects } from '../viewportCulling'
import type { Viewport } from '../viewportCulling'
import type { BoardObject } from '../../types'

// Helper to create a minimal board object at a given position
function makeObj(x: number, y: number, width = 100, height = 100): BoardObject {
  return { id: `obj-${x}-${y}`, type: 'sticky', x, y, width, height, fill: '#fff' }
}

// Standard 1920x1080 viewport at 1x zoom, no pan
const DEFAULT_VIEWPORT: Viewport = {
  stageX: 0,
  stageY: 0,
  scale: 1,
  width: 1920,
  height: 1080,
}

describe('getVisibleBounds', () => {
  it('returns correct bounds at 1x zoom with no pan', () => {
    const bounds = getVisibleBounds(DEFAULT_VIEWPORT)

    expect(bounds.left).toBeCloseTo(0)
    expect(bounds.top).toBeCloseTo(0)
    expect(bounds.right).toBe(1920)
    expect(bounds.bottom).toBe(1080)
  })

  it('accounts for pan offset', () => {
    const viewport: Viewport = { ...DEFAULT_VIEWPORT, stageX: -500, stageY: -300 }
    const bounds = getVisibleBounds(viewport)

    expect(bounds.left).toBe(500)
    expect(bounds.top).toBe(300)
    expect(bounds.right).toBe(500 + 1920)
    expect(bounds.bottom).toBe(300 + 1080)
  })

  it('accounts for zoom — zoomed out sees more area', () => {
    const viewport: Viewport = { ...DEFAULT_VIEWPORT, scale: 0.5 }
    const bounds = getVisibleBounds(viewport)

    // At 0.5x zoom, visible area in world coords is doubled
    expect(bounds.right).toBe(1920 / 0.5) // 3840
    expect(bounds.bottom).toBe(1080 / 0.5) // 2160
  })

  it('accounts for zoom — zoomed in sees less area', () => {
    const viewport: Viewport = { ...DEFAULT_VIEWPORT, scale: 2 }
    const bounds = getVisibleBounds(viewport)

    // At 2x zoom, visible area in world coords is halved
    expect(bounds.right).toBe(1920 / 2) // 960
    expect(bounds.bottom).toBe(1080 / 2) // 540
  })

  it('handles combined pan and zoom', () => {
    const viewport: Viewport = {
      stageX: -200,
      stageY: -100,
      scale: 2,
      width: 1920,
      height: 1080,
    }
    const bounds = getVisibleBounds(viewport)

    expect(bounds.left).toBe(200 / 2)     // 100
    expect(bounds.top).toBe(100 / 2)      // 50
    expect(bounds.right).toBe((200 + 1920) / 2)  // 1060
    expect(bounds.bottom).toBe((100 + 1080) / 2) // 590
  })
})

describe('isObjectVisible', () => {
  it('returns true for object fully inside viewport', () => {
    const obj = makeObj(500, 500, 100, 100)
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(true)
  })

  it('returns true for object partially overlapping left edge', () => {
    const obj = makeObj(-50, 500, 100, 100)
    // obj spans x: -50 to 50, viewport starts at 0 → overlaps
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(true)
  })

  it('returns false for object completely off-screen to the left', () => {
    const obj = makeObj(-200, 500, 100, 100)
    // obj spans x: -200 to -100, viewport starts at 0 → no overlap
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(false)
  })

  it('returns false for object completely off-screen to the right', () => {
    const obj = makeObj(2000, 500, 100, 100)
    // obj starts at x: 2000, viewport ends at 1920 → no overlap
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(false)
  })

  it('returns false for object completely above viewport', () => {
    const obj = makeObj(500, -200, 100, 100)
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(false)
  })

  it('returns false for object completely below viewport', () => {
    const obj = makeObj(500, 1200, 100, 100)
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(false)
  })

  it('padding extends the visible area', () => {
    // Object is 10px off-screen to the right
    const obj = makeObj(1930, 500, 100, 100)
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 0)).toBe(false)
    // With 50px padding, it should be included
    expect(isObjectVisible(obj, DEFAULT_VIEWPORT, 50)).toBe(true)
  })

  it('works correctly when panned and zoomed', () => {
    const viewport: Viewport = {
      stageX: -1000,
      stageY: -1000,
      scale: 2,
      width: 800,
      height: 600,
    }
    // Visible bounds: left=500, top=500, right=900, bottom=800

    const insideObj = makeObj(600, 600, 50, 50)
    expect(isObjectVisible(insideObj, viewport, 0)).toBe(true)

    const outsideObj = makeObj(100, 100, 50, 50)
    expect(isObjectVisible(outsideObj, viewport, 0)).toBe(false)
  })
})

describe('cullObjects', () => {
  it('returns only visible objects from a large set', () => {
    const objects: BoardObject[] = []

    // Create a 10x10 grid of objects, each 100x100, spaced 200px apart
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        objects.push(makeObj(col * 200, row * 200, 100, 100))
      }
    }

    expect(objects).toHaveLength(100)

    // Viewport shows 0-1920 x 0-1080 at 1x zoom
    const visible = cullObjects(objects, DEFAULT_VIEWPORT, 0)

    // Objects in the visible range:
    // X: cols 0-9 span 0-1900 → all 10 cols fit in 1920px
    // Y: rows 0-5 span 0-1100 → rows 0-4 fully visible (0-900),
    //    row 5 at y=1000 with height 100 → bottom at 1100 > 1080... still overlaps
    //    row 6 at y=1200 → starts past 1080, not visible
    // So: 10 cols × 6 rows = 60 visible
    expect(visible).toHaveLength(60)
  })

  it('returns empty array when no objects are visible', () => {
    const objects = [
      makeObj(-500, -500, 100, 100),
      makeObj(3000, 3000, 100, 100),
    ]
    const visible = cullObjects(objects, DEFAULT_VIEWPORT, 0)
    expect(visible).toHaveLength(0)
  })

  it('returns all objects when all are visible', () => {
    const objects = [
      makeObj(100, 100, 50, 50),
      makeObj(500, 500, 50, 50),
      makeObj(900, 900, 50, 50),
    ]
    const visible = cullObjects(objects, DEFAULT_VIEWPORT, 0)
    expect(visible).toHaveLength(3)
  })
})
