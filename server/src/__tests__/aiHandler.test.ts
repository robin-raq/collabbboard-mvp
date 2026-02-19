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
  buildBoardContext,
} from '../aiHandler.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BoardObject {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  fill: string
  fontSize?: number
  rotation?: number
}

function createTestMap(): Y.Map<BoardObject> {
  const doc = new Y.Doc()
  return doc.getMap('objects') as Y.Map<BoardObject>
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
