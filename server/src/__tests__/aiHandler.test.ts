/**
 * AI Handler Tests (TDD)
 *
 * Tests the tool execution logic for the AI agent.
 * These test the pure functions that mutate the Y.Doc — NOT the Claude API calls.
 *
 * Tool functions tested:
 *  - createObject: creates objects with correct defaults and properties
 *  - updateObject: modifies existing object properties
 *  - moveObject: repositions existing objects
 *  - buildBoardContext: generates correct board snapshot for system prompt
 *  - executeGetBoardState: returns current board state as formatted string
 *  - skipCollisionCheck: allows intentional placement without auto-nudging
 */

import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'

// ---------------------------------------------------------------------------
// Import the functions we'll test (these don't exist yet — TDD!)
// ---------------------------------------------------------------------------
import {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
  executeGetBoardState,
  buildBoardContext,
} from '../aiHandler.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Use `any` to avoid duplicating the BoardObject type from aiHandler.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTestMap(): Y.Map<any> {
  const doc = new Y.Doc()
  return doc.getMap('objects')
}

// ---------------------------------------------------------------------------
// createObject tests
// ---------------------------------------------------------------------------

describe('createObject', () => {
  it('creates a sticky note with specified text and color', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 100, y: 200, text: 'User Research', fill: '#FFD700' },
        objects
      )
    )

    expect(result.success).toBe(true)
    expect(result.id).toBeDefined()
    expect(result.type).toBe('sticky')

    const created = objects.get(result.id) as any
    expect(created).toBeDefined()
    expect(created.type).toBe('sticky')
    expect(created.x).toBe(100)
    expect(created.y).toBe(200)
    expect(created.text).toBe('User Research')
    expect(created.fill).toBe('#FFD700')
  })

  it('uses default size for sticky notes (200x150)', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject({ type: 'sticky', x: 0, y: 0 }, objects)
    )

    const created = objects.get(result.id) as any
    expect(created.width).toBe(200)
    expect(created.height).toBe(150)
  })

  it('uses default size for rectangles (150x100)', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject({ type: 'rect', x: 100, y: 200, fill: '#87CEEB' }, objects)
    )

    const created = objects.get(result.id) as any
    expect(created.width).toBe(150)
    expect(created.height).toBe(100)
    expect(created.fill).toBe('#87CEEB')
  })

  it('allows custom width and height', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'rect', x: 0, y: 0, width: 300, height: 250 },
        objects
      )
    )

    const created = objects.get(result.id) as any
    expect(created.width).toBe(300)
    expect(created.height).toBe(250)
  })

  it('uses default fill color per object type', () => {
    const objects = createTestMap()

    const stickyResult = JSON.parse(
      executeCreateObject({ type: 'sticky', x: 0, y: 0 }, objects)
    )
    expect((objects.get(stickyResult.id) as any).fill).toBe('#FFD700')

    const rectResult = JSON.parse(
      executeCreateObject({ type: 'rect', x: 0, y: 0 }, objects)
    )
    expect((objects.get(rectResult.id) as any).fill).toBe('#87CEEB')
  })

  it('sets rotation to 0 by default', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject({ type: 'sticky', x: 0, y: 0 }, objects)
    )

    const created = objects.get(result.id) as any
    expect(created.rotation).toBe(0)
  })

  it('sets fontSize when provided for text objects', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'text', x: 50, y: 50, text: 'Title', fontSize: 24 },
        objects
      )
    )

    const created = objects.get(result.id) as any
    expect(created.fontSize).toBe(24)
    expect(created.text).toBe('Title')
  })

  it('generates unique IDs for each object', () => {
    const objects = createTestMap()
    const r1 = JSON.parse(executeCreateObject({ type: 'sticky', x: 0, y: 0 }, objects))
    const r2 = JSON.parse(executeCreateObject({ type: 'sticky', x: 0, y: 0 }, objects))

    expect(r1.id).not.toBe(r2.id)
    expect(objects.size).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// updateObject tests
// ---------------------------------------------------------------------------

describe('updateObject', () => {
  it('changes the fill color of an existing object', () => {
    const objects = createTestMap()
    objects.set('obj-1', {
      id: 'obj-1', type: 'sticky', x: 100, y: 200,
      width: 200, height: 150, text: 'Note', fill: '#FFD700',
    })

    const result = JSON.parse(
      executeUpdateObject({ id: 'obj-1', fill: '#98FB98' }, objects)
    )

    expect(result.success).toBe(true)
    expect((objects.get('obj-1') as any).fill).toBe('#98FB98')
  })

  it('changes text of an existing object', () => {
    const objects = createTestMap()
    objects.set('obj-2', {
      id: 'obj-2', type: 'sticky', x: 0, y: 0,
      width: 200, height: 150, text: 'Old text', fill: '#FFD700',
    })

    executeUpdateObject({ id: 'obj-2', text: 'New text' }, objects)
    expect((objects.get('obj-2') as any).text).toBe('New text')
  })

  it('preserves unmodified properties', () => {
    const objects = createTestMap()
    objects.set('obj-3', {
      id: 'obj-3', type: 'sticky', x: 50, y: 75,
      width: 200, height: 150, text: 'Keep me', fill: '#FFD700',
    })

    executeUpdateObject({ id: 'obj-3', fill: '#FF0000' }, objects)
    const updated = objects.get('obj-3') as any
    expect(updated.text).toBe('Keep me')
    expect(updated.x).toBe(50)
    expect(updated.y).toBe(75)
    expect(updated.width).toBe(200)
    expect(updated.fill).toBe('#FF0000')
  })

  it('returns error for non-existent object', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeUpdateObject({ id: 'nonexistent', fill: '#FFF' }, objects)
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('can update width and height', () => {
    const objects = createTestMap()
    objects.set('obj-4', {
      id: 'obj-4', type: 'rect', x: 0, y: 0,
      width: 100, height: 50, fill: '#000',
    })

    executeUpdateObject({ id: 'obj-4', width: 300, height: 200 }, objects)
    const updated = objects.get('obj-4') as any
    expect(updated.width).toBe(300)
    expect(updated.height).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// moveObject tests
// ---------------------------------------------------------------------------

describe('moveObject', () => {
  it('moves an object to new coordinates', () => {
    const objects = createTestMap()
    objects.set('m-1', {
      id: 'm-1', type: 'sticky', x: 0, y: 0,
      width: 200, height: 150, fill: '#FFD700',
    })

    const result = JSON.parse(
      executeMoveObject({ id: 'm-1', x: 400, y: 300 }, objects)
    )

    expect(result.success).toBe(true)
    expect(result.x).toBe(400)
    expect(result.y).toBe(300)
    expect((objects.get('m-1') as any).x).toBe(400)
    expect((objects.get('m-1') as any).y).toBe(300)
  })

  it('preserves all other properties when moving', () => {
    const objects = createTestMap()
    objects.set('m-2', {
      id: 'm-2', type: 'sticky', x: 10, y: 20,
      width: 200, height: 150, text: 'Don\'t change me', fill: '#FFD700',
    })

    executeMoveObject({ id: 'm-2', x: 500, y: 600 }, objects)
    const moved = objects.get('m-2') as any
    expect(moved.text).toBe('Don\'t change me')
    expect(moved.fill).toBe('#FFD700')
    expect(moved.width).toBe(200)
  })

  it('returns error for non-existent object', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeMoveObject({ id: 'ghost', x: 0, y: 0 }, objects)
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

// ---------------------------------------------------------------------------
// buildBoardContext tests
// ---------------------------------------------------------------------------

describe('buildBoardContext', () => {
  it('returns empty message for empty board', () => {
    const objects = createTestMap()
    const context = buildBoardContext(objects)
    expect(context).toContain('empty')
  })

  it('includes object IDs and types in the context', () => {
    const objects = createTestMap()
    objects.set('ctx-1', {
      id: 'ctx-1', type: 'sticky', x: 100, y: 200,
      width: 200, height: 150, text: 'Test note', fill: '#FFD700',
    })

    const context = buildBoardContext(objects)
    expect(context).toContain('ctx-1')
    expect(context).toContain('sticky')
    expect(context).toContain('Test note')
    expect(context).toContain('#FFD700')
  })

  it('includes object count', () => {
    const objects = createTestMap()
    objects.set('a', { id: 'a', type: 'sticky', x: 0, y: 0, width: 200, height: 150, fill: '#FFD700' })
    objects.set('b', { id: 'b', type: 'rect', x: 0, y: 0, width: 150, height: 100, fill: '#87CEEB' })

    const context = buildBoardContext(objects)
    expect(context).toContain('2 total')
  })

  it('includes position information', () => {
    const objects = createTestMap()
    objects.set('pos-1', {
      id: 'pos-1', type: 'rect', x: 350, y: 475,
      width: 150, height: 100, fill: '#000',
    })

    const context = buildBoardContext(objects)
    expect(context).toContain('350')
    expect(context).toContain('475')
  })
})

// ---------------------------------------------------------------------------
// selectModel tests — model routing for speed optimization
// ---------------------------------------------------------------------------

import { selectModel, isComplexCommand, findOpenPosition } from '../aiHandler.js'

describe('isComplexCommand', () => {
  it('returns false for simple creation commands', () => {
    expect(isComplexCommand('Add a yellow sticky note')).toBe(false)
    expect(isComplexCommand('Create a blue rectangle at position 100, 200')).toBe(false)
    expect(isComplexCommand('add a circle')).toBe(false)
  })

  it('returns false for simple manipulation commands', () => {
    expect(isComplexCommand('Change the color to green')).toBe(false)
    expect(isComplexCommand('Move it to 300, 400')).toBe(false)
    expect(isComplexCommand('Delete the sticky note')).toBe(false)
  })

  it('returns true for grid/layout commands', () => {
    expect(isComplexCommand('Create a 2x3 grid of sticky notes')).toBe(true)
    expect(isComplexCommand('Arrange these sticky notes in a grid')).toBe(true)
    expect(isComplexCommand('lay out the notes in rows')).toBe(true)
  })

  it('returns true for template/complex commands', () => {
    expect(isComplexCommand('Set up a retrospective board')).toBe(true)
    expect(isComplexCommand('Create a SWOT analysis template')).toBe(true)
    expect(isComplexCommand('Build a user journey map')).toBe(true)
  })

  it('returns true for chart/diagram commands', () => {
    expect(isComplexCommand('draw me a bar chart')).toBe(true)
    expect(isComplexCommand('create a pie chart of sales')).toBe(true)
    expect(isComplexCommand('make a diagram showing the flow')).toBe(true)
    expect(isComplexCommand('visualize the data')).toBe(true)
  })

  it('returns true for long commands (>120 chars)', () => {
    expect(isComplexCommand('I need you to create a board with multiple sections for our team planning session with columns for each team member')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isComplexCommand('ADD A STICKY NOTE')).toBe(false)
    expect(isComplexCommand('CREATE A GRID')).toBe(true)
  })
})

describe('selectModel', () => {
  it('returns Haiku for simple commands (cost optimization)', () => {
    expect(selectModel('Add a sticky note')).toBe('claude-3-5-haiku-20241022')
    expect(selectModel('Create a blue rectangle')).toBe('claude-3-5-haiku-20241022')
    expect(selectModel('Change the color to green')).toBe('claude-3-5-haiku-20241022')
  })

  it('returns Sonnet for complex commands', () => {
    expect(selectModel('Create a 2x3 grid of sticky notes')).toBe('claude-sonnet-4-20250514')
    expect(selectModel('Create a SWOT analysis template')).toBe('claude-sonnet-4-20250514')
  })
})

// ---------------------------------------------------------------------------
// findOpenPosition tests — collision-aware placement for AI objects
// ---------------------------------------------------------------------------

describe('findOpenPosition', () => {
  it('returns original position when board is empty', () => {
    const objects = createTestMap()
    const pos = findOpenPosition(100, 100, 200, 150, objects)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(100)
  })

  it('returns original position when no overlap exists', () => {
    const objects = createTestMap()
    objects.set('existing', {
      id: 'existing', type: 'sticky', x: 500, y: 500,
      width: 200, height: 150, fill: '#FFD700',
    })
    const pos = findOpenPosition(100, 100, 200, 150, objects)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(100)
  })

  it('shifts position when overlapping an existing object', () => {
    const objects = createTestMap()
    objects.set('blocker', {
      id: 'blocker', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })
    // Try to place at same position — should be nudged
    const pos = findOpenPosition(100, 100, 200, 150, objects)
    expect(pos.x).not.toBe(100)
    // New position should not overlap the existing object
    const noOverlap =
      pos.x + 200 <= 100 || pos.x >= 300 ||
      pos.y + 150 <= 100 || pos.y >= 250
    expect(noOverlap).toBe(true)
  })

  it('shifts position when partially overlapping', () => {
    const objects = createTestMap()
    objects.set('blocker', {
      id: 'blocker', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })
    // Place at (200, 150) — overlaps with blocker at (100-300, 100-250)
    const pos = findOpenPosition(200, 150, 200, 150, objects)
    // Should be nudged away
    const noOverlap =
      pos.x + 200 <= 100 || pos.x >= 300 ||
      pos.y + 150 <= 100 || pos.y >= 250
    expect(noOverlap).toBe(true)
  })

  it('handles multiple existing objects', () => {
    const objects = createTestMap()
    objects.set('obj-1', {
      id: 'obj-1', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })
    objects.set('obj-2', {
      id: 'obj-2', type: 'sticky', x: 320, y: 100,
      width: 200, height: 150, fill: '#87CEEB',
    })
    // Place at (100, 100) — should dodge both objects
    const pos = findOpenPosition(100, 100, 200, 150, objects)
    // Verify no overlap with either
    const overlapsObj1 =
      pos.x < 300 && pos.x + 200 > 100 &&
      pos.y < 250 && pos.y + 150 > 100
    const overlapsObj2 =
      pos.x < 520 && pos.x + 200 > 320 &&
      pos.y < 250 && pos.y + 150 > 100
    expect(overlapsObj1 || overlapsObj2).toBe(false)
  })

  it('respects padding between objects', () => {
    const objects = createTestMap()
    objects.set('blocker', {
      id: 'blocker', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })
    const padding = 20
    const pos = findOpenPosition(100, 100, 200, 150, objects, padding)
    // Should have at least `padding` pixels gap from blocker
    const gapX = pos.x >= 300 ? pos.x - 300 : 100 - (pos.x + 200)
    const gapY = pos.y >= 250 ? pos.y - 250 : 100 - (pos.y + 150)
    const hasGap = gapX >= padding || gapY >= padding
    expect(hasGap).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// createObject — returns actual position in result (Bug Fix #1)
// ---------------------------------------------------------------------------

describe('createObject result includes actual position', () => {
  it('returns x, y, width, height in the result JSON', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 100, y: 200, text: 'Test' },
        objects
      )
    )

    expect(result.success).toBe(true)
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
    expect(result.width).toBe(200) // sticky default
    expect(result.height).toBe(150) // sticky default
  })

  it('returns nudged position when auto-repositioned', () => {
    const objects = createTestMap()
    // Place a blocker at (100, 100)
    objects.set('blocker', {
      id: 'blocker', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })

    // Try to place at same position — should be nudged
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 100, y: 100, text: 'Nudged' },
        objects
      )
    )

    expect(result.success).toBe(true)
    // Result should reflect the ACTUAL position, not the requested one
    expect(result.x !== 100 || result.y !== 100).toBe(true)
    // Verify the result matches what's actually in the Y.Map
    const created = objects.get(result.id) as any
    expect(result.x).toBe(created.x)
    expect(result.y).toBe(created.y)
  })
})

// ---------------------------------------------------------------------------
// createObject — skipCollisionCheck (Bug Fix #3)
// ---------------------------------------------------------------------------

describe('createObject with skipCollisionCheck', () => {
  it('places object at exact requested position when skipCollisionCheck is true', () => {
    const objects = createTestMap()
    // Place a frame at (50, 50)
    objects.set('frame-1', {
      id: 'frame-1', type: 'frame', x: 50, y: 50,
      width: 400, height: 300, fill: '#E8E8E8',
    })

    // Place a sticky INSIDE the frame with skipCollisionCheck
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 70, y: 100, text: 'Inside frame', skipCollisionCheck: true },
        objects
      )
    )

    expect(result.success).toBe(true)
    // Should be at the EXACT requested position — no nudging
    expect(result.x).toBe(70)
    expect(result.y).toBe(100)
    const created = objects.get(result.id) as any
    expect(created.x).toBe(70)
    expect(created.y).toBe(100)
  })

  it('still nudges when skipCollisionCheck is false or omitted', () => {
    const objects = createTestMap()
    objects.set('blocker', {
      id: 'blocker', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700',
    })

    // Without skipCollisionCheck — should be nudged
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 100, y: 100, text: 'Should nudge' },
        objects
      )
    )

    expect(result.success).toBe(true)
    expect(result.x !== 100 || result.y !== 100).toBe(true)
  })

  it('allows multiple objects at intentional positions inside a frame', () => {
    const objects = createTestMap()
    objects.set('frame', {
      id: 'frame', type: 'frame', x: 50, y: 50,
      width: 500, height: 400, fill: '#E8E8E8',
    })

    // Place 3 stickies inside the frame in a column
    const r1 = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 70, y: 80, text: 'Item 1', skipCollisionCheck: true },
        objects
      )
    )
    const r2 = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 70, y: 250, text: 'Item 2', skipCollisionCheck: true },
        objects
      )
    )
    const r3 = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 290, y: 80, text: 'Item 3', skipCollisionCheck: true },
        objects
      )
    )

    // All should be at their exact requested positions
    expect(r1.x).toBe(70)
    expect(r1.y).toBe(80)
    expect(r2.x).toBe(70)
    expect(r2.y).toBe(250)
    expect(r3.x).toBe(290)
    expect(r3.y).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// createObject — parentId support (frame grouping)
// ---------------------------------------------------------------------------

describe('createObject with parentId', () => {
  it('stores parentId on the created object when provided', () => {
    const objects = createTestMap()
    // Create a frame first
    const frameResult = JSON.parse(
      executeCreateObject(
        { type: 'frame', x: 50, y: 50, width: 400, height: 300, text: 'Strengths' },
        objects
      )
    )

    // Create a sticky inside the frame with parentId
    const stickyResult = JSON.parse(
      executeCreateObject(
        {
          type: 'sticky', x: 70, y: 90, text: 'Good team',
          skipCollisionCheck: true, parentId: frameResult.id,
        },
        objects
      )
    )

    expect(stickyResult.success).toBe(true)
    expect(stickyResult.parentId).toBe(frameResult.id)
    const created = objects.get(stickyResult.id) as any
    expect(created.parentId).toBe(frameResult.id)
  })

  it('does not set parentId when not provided and object is outside all frames', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 800, y: 800, text: 'Free floating' },
        objects
      )
    )

    const created = objects.get(result.id) as any
    expect(created.parentId).toBeUndefined()
    expect(result.parentId).toBeUndefined()
  })

  it('auto-detects parentId when object is placed inside a frame and no explicit parentId given', () => {
    const objects = createTestMap()

    // Create a frame first
    const frameResult = JSON.parse(
      executeCreateObject(
        { type: 'frame', x: 50, y: 50, width: 400, height: 300, text: 'Strengths' },
        objects
      )
    )

    // Create a sticky fully inside the frame WITHOUT explicit parentId
    const stickyResult = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 70, y: 90, text: 'Auto-detected parent', skipCollisionCheck: true },
        objects
      )
    )

    expect(stickyResult.success).toBe(true)
    expect(stickyResult.parentId).toBe(frameResult.id)
    const created = objects.get(stickyResult.id) as any
    expect(created.parentId).toBe(frameResult.id)
  })

  it('does not auto-detect parentId for frame objects', () => {
    const objects = createTestMap()

    // Create a large frame
    executeCreateObject(
      { type: 'frame', x: 0, y: 0, width: 1000, height: 1000, text: 'Big Frame' },
      objects
    )

    // Create a smaller frame inside — should NOT auto-detect parent
    const innerFrame = JSON.parse(
      executeCreateObject(
        { type: 'frame', x: 50, y: 50, width: 200, height: 200, text: 'Inner Frame', skipCollisionCheck: true },
        objects
      )
    )

    const created = objects.get(innerFrame.id) as any
    expect(created.parentId).toBeUndefined()
  })

  it('does not auto-detect parentId when object is only partially inside a frame', () => {
    const objects = createTestMap()

    // Create a frame
    executeCreateObject(
      { type: 'frame', x: 50, y: 50, width: 400, height: 300, text: 'Frame' },
      objects
    )

    // Create a sticky that overflows the frame boundary (x: 400 + width: 200 = 600 > frame right: 450)
    const stickyResult = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 400, y: 100, width: 200, text: 'Overflows', skipCollisionCheck: true },
        objects
      )
    )

    const created = objects.get(stickyResult.id) as any
    expect(created.parentId).toBeUndefined()
  })

  it('returns parentId in the result JSON', () => {
    const objects = createTestMap()
    const result = JSON.parse(
      executeCreateObject(
        { type: 'sticky', x: 100, y: 100, text: 'Child', parentId: 'some-frame-id' },
        objects
      )
    )

    expect(result.parentId).toBe('some-frame-id')
  })
})

// ---------------------------------------------------------------------------
// buildBoardContext — shows parent-child relationships
// ---------------------------------------------------------------------------

describe('buildBoardContext with parentId', () => {
  it('includes parentId in the context when objects have a parent', () => {
    const objects = createTestMap()
    objects.set('frame-1', {
      id: 'frame-1', type: 'frame', x: 50, y: 50,
      width: 400, height: 300, fill: '#E8E8E8', text: 'My Frame',
    })
    objects.set('child-1', {
      id: 'child-1', type: 'sticky', x: 70, y: 90,
      width: 200, height: 150, fill: '#FFD700', text: 'Inside',
      parentId: 'frame-1',
    })

    const context = buildBoardContext(objects)
    expect(context).toContain('Parent: "frame-1"')
  })

  it('does not include parent info for objects without parentId', () => {
    const objects = createTestMap()
    objects.set('free-1', {
      id: 'free-1', type: 'sticky', x: 100, y: 100,
      width: 200, height: 150, fill: '#FFD700', text: 'Free',
    })

    const context = buildBoardContext(objects)
    expect(context).not.toContain('Parent:')
  })
})

// ---------------------------------------------------------------------------
// getBoardState tool (Bug Fix #2)
// ---------------------------------------------------------------------------

describe('executeGetBoardState', () => {
  it('returns empty board message when no objects exist', () => {
    const objects = createTestMap()
    const result = executeGetBoardState(objects)
    expect(result).toContain('empty')
  })

  it('returns formatted board state with all objects', () => {
    const objects = createTestMap()
    objects.set('s1', {
      id: 's1', type: 'sticky', x: 100, y: 200,
      width: 200, height: 150, text: 'Research', fill: '#FFD700',
    })
    objects.set('r1', {
      id: 'r1', type: 'rect', x: 400, y: 100,
      width: 150, height: 100, fill: '#87CEEB',
    })

    const result = executeGetBoardState(objects)
    expect(result).toContain('2 total')
    expect(result).toContain('s1')
    expect(result).toContain('sticky')
    expect(result).toContain('Research')
    expect(result).toContain('r1')
    expect(result).toContain('rect')
    expect(result).toContain('(100, 200)')
    expect(result).toContain('(400, 100)')
  })

  it('reflects objects created after initial board state', () => {
    const objects = createTestMap()

    // Initially empty
    const before = executeGetBoardState(objects)
    expect(before).toContain('empty')

    // Create an object
    executeCreateObject(
      { type: 'sticky', x: 100, y: 100, text: 'New item' },
      objects
    )

    // Now getBoardState should show the new object
    const after = executeGetBoardState(objects)
    expect(after).toContain('1 total')
    expect(after).toContain('New item')
    expect(after).not.toContain('empty')
  })
})
