/**
 * Local AI Command Parser Tests
 *
 * Tests the fallback parser that handles the 6 required commands
 * without calling the Anthropic API.
 *
 * The 6 commands:
 *  1. "Add a yellow sticky note that says User Research"
 *  2. "Create a blue rectangle at position 100, 200"
 *  3. "Change the sticky note color to green"
 *  4. "Create a 2x3 grid of sticky notes for pros and cons"
 *  5. "Arrange these sticky notes in a grid"
 *  6. "Set up a retrospective board"
 */

import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { parseCommand, ParsedCommand } from '../localParser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDoc(): Y.Doc {
  return new Y.Doc()
}

function createDocWithObjects(objects: Record<string, any>): Y.Doc {
  const doc = new Y.Doc()
  const map = doc.getMap('objects')
  for (const [id, obj] of Object.entries(objects)) {
    map.set(id, { id, ...obj })
  }
  return doc
}

// ---------------------------------------------------------------------------
// Command 1: Create a sticky note with text
// ---------------------------------------------------------------------------

describe('Command 1: Create sticky note', () => {
  it('parses "Add a yellow sticky note that says User Research"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Add a yellow sticky note that says User Research', doc)
    expect(result.actions.length).toBeGreaterThanOrEqual(1)
    expect(result.actions[0].tool).toBe('createObject')
    expect(result.actions[0].input.type).toBe('sticky')
    expect(result.actions[0].input.text).toBe('User Research')
    expect(result.actions[0].input.fill).toBe('#FFD700') // yellow
  })

  it('parses "Create a sticky note saying Hello World"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a sticky note saying Hello World', doc)
    expect(result.actions.length).toBe(1)
    expect(result.actions[0].input.type).toBe('sticky')
    expect(result.actions[0].input.text).toBe('Hello World')
  })

  it('parses "Add a pink sticky note that says Design Review"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Add a pink sticky note that says Design Review', doc)
    expect(result.actions[0].input.fill).toBe('#FFB6C1') // pink
    expect(result.actions[0].input.text).toBe('Design Review')
  })

  it('parses "Add a green sticky note"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Add a green sticky note', doc)
    expect(result.actions[0].input.type).toBe('sticky')
    expect(result.actions[0].input.fill).toBe('#98FB98') // green
  })

  it('parses "Create a blue sticky that says Sprint Planning"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a blue sticky that says Sprint Planning', doc)
    expect(result.actions[0].input.fill).toBe('#87CEEB')
    expect(result.actions[0].input.text).toBe('Sprint Planning')
  })

  it('parses "Add a sticky note with text Todo Items"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Add a sticky note with text Todo Items', doc)
    expect(result.actions[0].input.text).toBe('Todo Items')
  })
})

// ---------------------------------------------------------------------------
// Command 2: Create a colored rectangle at a position
// ---------------------------------------------------------------------------

describe('Command 2: Create rectangle at position', () => {
  it('parses "Create a blue rectangle at position 100, 200"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a blue rectangle at position 100, 200', doc)
    expect(result.actions.length).toBe(1)
    expect(result.actions[0].tool).toBe('createObject')
    expect(result.actions[0].input.type).toBe('rect')
    expect(result.actions[0].input.fill).toBe('#87CEEB') // blue
    expect(result.actions[0].input.x).toBe(100)
    expect(result.actions[0].input.y).toBe(200)
  })

  it('parses "Add a red rectangle at 300, 400"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Add a red rectangle at 300, 400', doc)
    expect(result.actions[0].input.type).toBe('rect')
    expect(result.actions[0].input.x).toBe(300)
    expect(result.actions[0].input.y).toBe(400)
  })

  it('parses "Create a circle at position 500, 300"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a circle at position 500, 300', doc)
    expect(result.actions[0].input.type).toBe('circle')
    expect(result.actions[0].input.x).toBe(500)
    expect(result.actions[0].input.y).toBe(300)
  })

  it('defaults to a reasonable position when none specified', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a rectangle', doc)
    expect(result.actions[0].input.x).toBeGreaterThan(0)
    expect(result.actions[0].input.y).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Command 3: Change an object's color
// ---------------------------------------------------------------------------

describe('Command 3: Change object color', () => {
  it('parses "Change the sticky note color to green"', () => {
    const doc = createDocWithObjects({
      's1': { type: 'sticky', x: 100, y: 100, width: 200, height: 150, fill: '#FFD700', text: 'Note 1' },
    })
    const result = parseCommand('Change the sticky note color to green', doc)
    expect(result.actions.length).toBe(1)
    expect(result.actions[0].tool).toBe('updateObject')
    expect(result.actions[0].input.id).toBe('s1')
    expect(result.actions[0].input.fill).toBe('#98FB98') // green
  })

  it('parses "Make the rectangle blue"', () => {
    const doc = createDocWithObjects({
      'r1': { type: 'rect', x: 100, y: 100, width: 150, height: 100, fill: '#FF0000' },
    })
    const result = parseCommand('Make the rectangle blue', doc)
    expect(result.actions[0].tool).toBe('updateObject')
    expect(result.actions[0].input.fill).toBe('#87CEEB')
  })

  it('finds object by text content when multiple exist', () => {
    const doc = createDocWithObjects({
      's1': { type: 'sticky', x: 100, y: 100, width: 200, height: 150, fill: '#FFD700', text: 'Research' },
      's2': { type: 'sticky', x: 300, y: 100, width: 200, height: 150, fill: '#FFD700', text: 'Design' },
    })
    const result = parseCommand('Change the Design sticky note to pink', doc)
    expect(result.actions[0].input.id).toBe('s2')
    expect(result.actions[0].input.fill).toBe('#FFB6C1')
  })

  it('returns error when no matching object found', () => {
    const doc = createTestDoc()
    const result = parseCommand('Change the sticky note color to green', doc)
    expect(result.message).toContain('find')
  })
})

// ---------------------------------------------------------------------------
// Command 4: Create a grid of sticky notes
// ---------------------------------------------------------------------------

describe('Command 4: Create a grid of sticky notes', () => {
  it('parses "Create a 2x3 grid of sticky notes for pros and cons"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a 2x3 grid of sticky notes for pros and cons', doc)
    // 2 columns x 3 rows = 6 sticky notes
    expect(result.actions.length).toBe(6)
    result.actions.forEach((action) => {
      expect(action.tool).toBe('createObject')
      expect(action.input.type).toBe('sticky')
    })
  })

  it('parses "Make a 3x2 grid of sticky notes"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Make a 3x2 grid of sticky notes', doc)
    // 3 columns x 2 rows = 6 sticky notes
    expect(result.actions.length).toBe(6)
  })

  it('spaces grid items evenly with gaps', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a 2x2 grid of sticky notes', doc)
    expect(result.actions.length).toBe(4)

    // Check that positions differ (spaced out)
    const positions = result.actions.map((a) => ({ x: a.input.x, y: a.input.y }))
    const uniqueX = new Set(positions.map((p) => p.x))
    const uniqueY = new Set(positions.map((p) => p.y))
    expect(uniqueX.size).toBe(2) // 2 columns
    expect(uniqueY.size).toBe(2) // 2 rows
  })

  it('labels grid items with provided text context', () => {
    const doc = createTestDoc()
    const result = parseCommand('Create a 2x3 grid of sticky notes for pros and cons', doc)
    // Should have some text on the notes (at least labels like "Pros 1", "Cons 1", etc.)
    const hasText = result.actions.some((a) => a.input.text)
    expect(hasText).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Command 5: Arrange existing sticky notes in a grid
// ---------------------------------------------------------------------------

describe('Command 5: Arrange sticky notes in a grid', () => {
  it('parses "Arrange these sticky notes in a grid"', () => {
    const doc = createDocWithObjects({
      's1': { type: 'sticky', x: 500, y: 500, width: 200, height: 150, fill: '#FFD700', text: 'A' },
      's2': { type: 'sticky', x: 100, y: 700, width: 200, height: 150, fill: '#FFD700', text: 'B' },
      's3': { type: 'sticky', x: 800, y: 200, width: 200, height: 150, fill: '#FFD700', text: 'C' },
      's4': { type: 'sticky', x: 300, y: 900, width: 200, height: 150, fill: '#FFD700', text: 'D' },
    })
    const result = parseCommand('Arrange these sticky notes in a grid', doc)
    expect(result.actions.length).toBe(4)
    result.actions.forEach((action) => {
      expect(action.tool).toBe('moveObject')
    })
  })

  it('positions objects in a reasonable grid layout', () => {
    const doc = createDocWithObjects({
      's1': { type: 'sticky', x: 999, y: 999, width: 200, height: 150, fill: '#FFD700', text: 'A' },
      's2': { type: 'sticky', x: 0, y: 0, width: 200, height: 150, fill: '#FFD700', text: 'B' },
    })
    const result = parseCommand('Arrange the sticky notes in a grid', doc)
    expect(result.actions.length).toBe(2)

    // All positions should be in the visible area
    result.actions.forEach((action) => {
      expect(action.input.x).toBeGreaterThanOrEqual(50)
      expect(action.input.y).toBeGreaterThanOrEqual(50)
    })
  })

  it('returns a message when no sticky notes to arrange', () => {
    const doc = createTestDoc()
    const result = parseCommand('Arrange these sticky notes in a grid', doc)
    expect(result.message).toContain('no')
  })
})

// ---------------------------------------------------------------------------
// Command 6: Set up a retrospective board
// ---------------------------------------------------------------------------

describe('Command 6: Set up a retrospective board', () => {
  it('parses "Set up a retrospective board"', () => {
    const doc = createTestDoc()
    const result = parseCommand('Set up a retrospective board', doc)
    // Should create: 3 frames + 6-9 sticky notes inside them
    expect(result.actions.length).toBeGreaterThanOrEqual(9) // 3 frames + 6 stickies minimum

    const frames = result.actions.filter((a) => a.input.type === 'frame')
    const stickies = result.actions.filter((a) => a.input.type === 'sticky')

    expect(frames.length).toBe(3)
    expect(stickies.length).toBeGreaterThanOrEqual(6)
  })

  it('creates frames with correct retro labels', () => {
    const doc = createTestDoc()
    const result = parseCommand('Set up a retrospective board', doc)

    const frameTexts = result.actions
      .filter((a) => a.input.type === 'frame')
      .map((a) => a.input.text as string)

    expect(frameTexts).toContain('What Went Well')
    expect(frameTexts).toContain("What Didn't Go Well")
    expect(frameTexts).toContain('Action Items')
  })

  it('also matches "Create a retro board" and similar variations', () => {
    const doc = createTestDoc()
    const result1 = parseCommand('Create a retro board', doc)
    expect(result1.actions.length).toBeGreaterThanOrEqual(9)

    const result2 = parseCommand('Set up a retrospective board with What Went Well, What Didn\'t, and Action Items', doc)
    expect(result2.actions.length).toBeGreaterThanOrEqual(9)
  })

  it('spaces columns evenly across the visible area', () => {
    const doc = createTestDoc()
    const result = parseCommand('Set up a retrospective board', doc)

    const frames = result.actions.filter((a) => a.input.type === 'frame')
    const xPositions = frames.map((f) => f.input.x as number)

    // Frames should be at different x positions (columns)
    const uniqueX = new Set(xPositions)
    expect(uniqueX.size).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('returns a helpful message for unrecognized commands', () => {
    const doc = createTestDoc()
    const result = parseCommand('What is the meaning of life?', doc)
    expect(result.actions.length).toBe(0)
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('is case-insensitive', () => {
    const doc = createTestDoc()
    const result = parseCommand('ADD A YELLOW STICKY NOTE THAT SAYS HELLO', doc)
    expect(result.actions.length).toBe(1)
    expect(result.actions[0].input.type).toBe('sticky')
  })

  it('actually mutates the Y.Doc when creating objects', () => {
    const doc = createTestDoc()
    const objectsMap = doc.getMap('objects')
    expect(objectsMap.size).toBe(0)

    parseCommand('Add a yellow sticky note that says Test', doc)
    expect(objectsMap.size).toBe(1)
  })

  it('actually mutates the Y.Doc when moving objects', () => {
    const doc = createDocWithObjects({
      's1': { type: 'sticky', x: 999, y: 999, width: 200, height: 150, fill: '#FFD700', text: 'Move me' },
    })
    const objectsMap = doc.getMap('objects')

    parseCommand('Arrange the sticky notes in a grid', doc)
    const obj = objectsMap.get('s1') as any
    // Position should have changed from 999,999
    expect(obj.x).not.toBe(999)
    expect(obj.y).not.toBe(999)
  })
})
