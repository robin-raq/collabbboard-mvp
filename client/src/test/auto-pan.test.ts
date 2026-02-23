import { describe, it, expect } from 'vitest'
import { extractPanTarget } from '../utils/panTarget'

// ---------------------------------------------------------------------------
// extractPanTarget — computes the center of all AI-created objects
// ---------------------------------------------------------------------------

describe('extractPanTarget', () => {
  it('returns center of a single action with default size', () => {
    const actions = [
      { tool: 'createObject', input: { x: 200, y: 300 }, result: '{}' },
    ]
    const target = extractPanTarget(actions)
    // Default width=100, height=75 → center at (200+50, 300+37.5)
    expect(target).toEqual({ x: 250, y: 337.5 })
  })

  it('returns center accounting for explicit width and height', () => {
    const actions = [
      { tool: 'createObject', input: { x: 100, y: 100, width: 200, height: 150 }, result: '{}' },
    ]
    const target = extractPanTarget(actions)
    // center at (100+100, 100+75)
    expect(target).toEqual({ x: 200, y: 175 })
  })

  it('returns bounding box center for multiple actions', () => {
    const actions = [
      { tool: 'createObject', input: { x: 0, y: 0, width: 100, height: 100 }, result: '{}' },
      { tool: 'createObject', input: { x: 200, y: 200, width: 100, height: 100 }, result: '{}' },
    ]
    const target = extractPanTarget(actions)
    // Object 1 center: (50, 50), Object 2 center: (250, 250) → avg (150, 150)
    expect(target).toEqual({ x: 150, y: 150 })
  })

  it('returns null when no actions have positions', () => {
    const actions = [
      { tool: 'getBoardState', input: {}, result: '{}' },
    ]
    expect(extractPanTarget(actions)).toBeNull()
  })

  it('returns null for empty actions array', () => {
    expect(extractPanTarget([])).toBeNull()
  })

  it('ignores actions without x/y coordinates', () => {
    const actions = [
      { tool: 'getBoardState', input: {}, result: '{}' },
      { tool: 'createObject', input: { x: 400, y: 600, width: 200, height: 150 }, result: '{}' },
      { tool: 'updateObject', input: { id: 'abc', fill: '#fff' }, result: '{}' },
    ]
    const target = extractPanTarget(actions)
    // Only the createObject has position → center at (400+100, 600+75)
    expect(target).toEqual({ x: 500, y: 675 })
  })

  it('handles moveObject actions with x/y', () => {
    const actions = [
      { tool: 'moveObject', input: { id: 'abc', x: 500, y: 300 }, result: '{}' },
    ]
    const target = extractPanTarget(actions)
    // moveObject has no width/height → defaults (100, 75) → center (550, 337.5)
    expect(target).toEqual({ x: 550, y: 337.5 })
  })
})

// ---------------------------------------------------------------------------
// panTo — computes the stagePos to center viewport on a world coordinate
// ---------------------------------------------------------------------------

describe('panTo stagePos calculation', () => {
  // The formula is: stagePos = { x: viewportW/2 - worldX * scale, y: viewportH/2 - worldY * scale }

  it('centers on a point at scale=1 with 1000x800 viewport', () => {
    const worldX = 500, worldY = 300
    const scale = 1, viewportW = 1000, viewportH = 800
    const stagePos = {
      x: viewportW / 2 - worldX * scale,
      y: viewportH / 2 - worldY * scale,
    }
    expect(stagePos).toEqual({ x: 0, y: 100 })
  })

  it('centers correctly at scale=0.5', () => {
    const worldX = 500, worldY = 300
    const scale = 0.5, viewportW = 1000, viewportH = 800
    const stagePos = {
      x: viewportW / 2 - worldX * scale,
      y: viewportH / 2 - worldY * scale,
    }
    expect(stagePos).toEqual({ x: 250, y: 250 })
  })

  it('centers correctly at scale=2', () => {
    const worldX = 200, worldY = 150
    const scale = 2, viewportW = 1000, viewportH = 800
    const stagePos = {
      x: viewportW / 2 - worldX * scale,
      y: viewportH / 2 - worldY * scale,
    }
    expect(stagePos).toEqual({ x: 100, y: 100 })
  })

  it('handles origin (0,0) target', () => {
    const worldX = 0, worldY = 0
    const scale = 1, viewportW = 1000, viewportH = 800
    const stagePos = {
      x: viewportW / 2 - worldX * scale,
      y: viewportH / 2 - worldY * scale,
    }
    expect(stagePos).toEqual({ x: 500, y: 400 })
  })
})
