/**
 * Command Cache Tests (TDD)
 *
 * Tests the command learning system that caches successful Claude API
 * responses and replays them for similar future commands.
 *
 * Functions tested:
 *  - learn(): stores a recipe from a command + actions
 *  - match(): finds a matching recipe for a new command
 *  - replay(): executes cached tool calls with substituted params
 *  - normalizeIntent(): extracts command intent from user message
 *  - templatizeActions(): converts literal tool inputs to templates
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import {
  CommandCache,
  normalizeIntent,
  templatizeActions,
  extractParamsFromCommand,
} from '../commandCache.js'
import type { ToolAction } from '../../../shared/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDoc(): Y.Doc {
  const doc = new Y.Doc()
  return doc
}

function createTestMap(): Y.Map<any> {
  const doc = new Y.Doc()
  return doc.getMap('objects')
}

// ---------------------------------------------------------------------------
// normalizeIntent tests
// ---------------------------------------------------------------------------

describe('normalizeIntent', () => {
  it('extracts create_sticky intent from create sticky command', () => {
    expect(normalizeIntent('Create a yellow sticky note that says Hello')).toBe('create_sticky')
  })

  it('extracts create_sticky intent regardless of color or text', () => {
    expect(normalizeIntent('Add a blue sticky that says World')).toBe('create_sticky')
    expect(normalizeIntent('Create a green sticky note saying Test')).toBe('create_sticky')
  })

  it('extracts create_rect intent from rectangle commands', () => {
    expect(normalizeIntent('Create a blue rectangle at position 100, 200')).toBe('create_rect')
  })

  it('extracts create_grid intent with dimensions', () => {
    expect(normalizeIntent('Create a 2x3 grid of sticky notes')).toBe('create_grid_2x3')
    expect(normalizeIntent('Make a 3x2 grid of sticky notes about testing')).toBe('create_grid_3x2')
  })

  it('extracts template intents', () => {
    expect(normalizeIntent('Set up a retrospective board')).toBe('template_retro')
    expect(normalizeIntent('Create a SWOT analysis')).toBe('template_swot')
    expect(normalizeIntent('Build a user journey map with 5 stages')).toBe('template_journey')
  })

  it('extracts update_color intent', () => {
    expect(normalizeIntent('Change the sticky note color to green')).toBe('update_color')
  })

  it('extracts create_frame intent', () => {
    expect(normalizeIntent("Add a frame called 'Sprint Planning'")).toBe('create_frame')
  })

  it('returns generic intent for unrecognized commands', () => {
    expect(normalizeIntent('Do something complex with the board')).toBe('generic')
  })
})

// ---------------------------------------------------------------------------
// extractParamsFromCommand tests
// ---------------------------------------------------------------------------

describe('extractParamsFromCommand', () => {
  it('extracts color and text from create sticky command', () => {
    const params = extractParamsFromCommand('Create a yellow sticky note that says Hello World')
    expect(params.color).toBe('yellow')
    expect(params.colorHex).toBe('#FFD700')
    expect(params.text).toBe('Hello World')
  })

  it('extracts position from "at position X, Y"', () => {
    const params = extractParamsFromCommand('Create a blue rectangle at position 100, 200')
    expect(params.x).toBe(100)
    expect(params.y).toBe(200)
  })

  it('extracts grid dimensions', () => {
    const params = extractParamsFromCommand('Create a 2x3 grid of sticky notes about testing')
    expect(params.gridCols).toBe(2)
    expect(params.gridRows).toBe(3)
    expect(params.topic).toBe('testing')
  })

  it('returns empty object for commands with no extractable params', () => {
    const params = extractParamsFromCommand('Do something')
    expect(Object.keys(params).length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// templatizeActions tests
// ---------------------------------------------------------------------------

describe('templatizeActions', () => {
  it('replaces literal color hex with ${colorHex} placeholder', () => {
    const actions: ToolAction[] = [
      {
        tool: 'createObject',
        input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
        result: '{"success":true,"id":"ai-123"}',
      },
    ]
    const params = { color: 'yellow', colorHex: '#FFD700', text: 'Hello' }
    const templates = templatizeActions(actions, params)

    expect(templates[0].inputTemplate.fill).toBe('${colorHex}')
    expect(templates[0].inputTemplate.text).toBe('${text}')
    expect(templates[0].inputTemplate.type).toBe('sticky') // type is not parameterized
  })

  it('replaces literal position with ${x} and ${y} placeholders', () => {
    const actions: ToolAction[] = [
      {
        tool: 'createObject',
        input: { type: 'rect', x: 300, y: 400, fill: '#87CEEB' },
        result: '{"success":true}',
      },
    ]
    const params = { x: 300, y: 400, color: 'blue', colorHex: '#87CEEB' }
    const templates = templatizeActions(actions, params)

    expect(templates[0].inputTemplate.x).toBe('${x}')
    expect(templates[0].inputTemplate.y).toBe('${y}')
    expect(templates[0].inputTemplate.fill).toBe('${colorHex}')
  })

  it('handles multi-action sequences (grid creation)', () => {
    const actions: ToolAction[] = [
      {
        tool: 'createObject',
        input: { type: 'sticky', x: 100, y: 100, text: 'Item 1', fill: '#FFD700' },
        result: '{"success":true}',
      },
      {
        tool: 'createObject',
        input: { type: 'sticky', x: 320, y: 100, text: 'Item 2', fill: '#FFD700' },
        result: '{"success":true}',
      },
    ]
    const params = { colorHex: '#FFD700' }
    const templates = templatizeActions(actions, params)

    expect(templates).toHaveLength(2)
    expect(templates[0].inputTemplate.fill).toBe('${colorHex}')
    expect(templates[1].inputTemplate.fill).toBe('${colorHex}')
  })

  it('preserves non-parameterizable values', () => {
    const actions: ToolAction[] = [
      {
        tool: 'createObject',
        input: { type: 'frame', x: 50, y: 50, width: 400, height: 300, text: 'My Frame' },
        result: '{"success":true}',
      },
    ]
    const params = { text: 'My Frame' }
    const templates = templatizeActions(actions, params)

    expect(templates[0].inputTemplate.width).toBe(400)
    expect(templates[0].inputTemplate.height).toBe(300)
    expect(templates[0].inputTemplate.text).toBe('${text}')
  })
})

// ---------------------------------------------------------------------------
// CommandCache tests
// ---------------------------------------------------------------------------

describe('CommandCache', () => {
  let cache: CommandCache

  beforeEach(() => {
    cache = new CommandCache()
  })

  describe('learn()', () => {
    it('stores a recipe from a simple create sticky command', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true,"id":"ai-123","type":"sticky"}',
        },
      ]

      cache.learn(
        'Create a yellow sticky note that says Hello',
        actions,
        "Created a yellow sticky note 'Hello'."
      )

      expect(cache.size).toBe(1)
    })

    it('stores a recipe with correct intent key', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#98FB98', text: 'Test' },
          result: '{"success":true}',
        },
      ]

      cache.learn('Add a green sticky that says Test', actions, 'Created.')

      const recipe = cache.getRecipes()[0]
      expect(recipe.intentKey).toBe('create_sticky')
    })

    it('does not store recipes with 0 actions', () => {
      cache.learn('Do nothing', [], 'Nothing happened.')
      expect(cache.size).toBe(0)
    })

    it('does not store recipes with more than 20 actions', () => {
      const manyActions = Array.from({ length: 21 }, (_, i) => ({
        tool: 'createObject',
        input: { type: 'sticky' as const, x: i * 100, y: 100 },
        result: '{"success":true}',
      }))

      cache.learn('Create tons of stickies', manyActions, 'Created.')
      expect(cache.size).toBe(0)
    })

    it('correctly templatizes color, text, and position params', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 200, y: 300, fill: '#FFB6C1', text: 'My Note' },
          result: '{"success":true}',
        },
      ]

      cache.learn('Create a pink sticky that says My Note', actions, 'Done.')

      const recipe = cache.getRecipes()[0]
      expect(recipe.actionTemplates[0].inputTemplate.fill).toBe('${colorHex}')
      expect(recipe.actionTemplates[0].inputTemplate.text).toBe('${text}')
    })
  })

  describe('match()', () => {
    it('returns null for unknown commands when cache is empty', () => {
      expect(cache.match('Create something new')).toBeNull()
    })

    it('returns a recipe for a similar create sticky command', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true}',
        },
      ]
      cache.learn('Create a yellow sticky note that says Hello', actions, 'Created.')

      // Similar command with different color and text
      const match = cache.match('Create a blue sticky note that says World')
      expect(match).not.toBeNull()
      expect(match!.intentKey).toBe('create_sticky')
    })

    it('handles case-insensitive matching', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Test' },
          result: '{"success":true}',
        },
      ]
      cache.learn('CREATE A YELLOW STICKY THAT SAYS Test', actions, 'Created.')

      const match = cache.match('create a green sticky that says Hello')
      expect(match).not.toBeNull()
    })

    it('returns null when intent does not match any recipe', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true}',
        },
      ]
      cache.learn('Create a yellow sticky that says Hello', actions, 'Created.')

      // Different intent — this is a grid command, not a simple create
      expect(cache.match('Create a 2x3 grid of sticky notes')).toBeNull()
    })

    it('increments hit count on match', () => {
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true}',
        },
      ]
      cache.learn('Create a yellow sticky that says Hello', actions, 'Created.')

      cache.match('Create a blue sticky that says World')
      cache.match('Create a green sticky that says Test')

      const recipe = cache.getRecipes()[0]
      expect(recipe.hitCount).toBe(2)
    })
  })

  describe('replay()', () => {
    it('executes tool calls with substituted parameters', () => {
      const objects = createTestMap()
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true,"id":"ai-123","type":"sticky","text":"Hello"}',
        },
      ]
      cache.learn('Create a yellow sticky that says Hello', actions, "Created a yellow sticky 'Hello'.")

      const recipe = cache.match('Create a blue sticky that says World')!
      const result = cache.replay(recipe, 'Create a blue sticky that says World', objects)

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].tool).toBe('createObject')

      // Check the object was actually created on the map
      expect(objects.size).toBe(1)

      // Check the substituted values
      const input = result.actions[0].input
      expect(input.fill).toBe('#87CEEB') // blue
      expect(input.text).toBe('World')
      expect(input.type).toBe('sticky')
    })

    it('adjusts positions using findOpenPosition when objects exist', () => {
      const objects = createTestMap()

      // Pre-populate with an existing object at 100, 100
      objects.set('existing-1', {
        id: 'existing-1', type: 'sticky', x: 100, y: 100, width: 200, height: 150,
        fill: '#FFD700', rotation: 0,
      })

      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Test' },
          result: '{"success":true}',
        },
      ]
      cache.learn('Create a yellow sticky that says Test', actions, 'Created.')

      const recipe = cache.match('Create a green sticky that says New')!
      const result = cache.replay(recipe, 'Create a green sticky that says New', objects)

      // Should have created the object (now 2 total)
      expect(objects.size).toBe(2)

      // The new object should NOT be at 100,100 (that's occupied)
      const newInput = result.actions[0].input
      const createdId = JSON.parse(result.actions[0].result).id
      const created = objects.get(createdId)
      expect(created).toBeDefined()
      // Position should differ from the occupied spot
      expect(created.x !== 100 || created.y !== 100).toBe(true)
    })

    it('returns a templated response message', () => {
      const objects = createTestMap()
      const actions: ToolAction[] = [
        {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
          result: '{"success":true}',
        },
      ]
      cache.learn(
        'Create a yellow sticky that says Hello',
        actions,
        "Created a yellow sticky 'Hello'."
      )

      const recipe = cache.match('Create a blue sticky that says World')!
      const result = cache.replay(recipe, 'Create a blue sticky that says World', objects)

      expect(result.message).toContain('World')
    })
  })

  describe('cache limits', () => {
    it('respects max 50 recipe limit with LRU eviction', () => {
      // Create 50 recipes with unique intents by using different grid dimensions
      for (let i = 0; i < 50; i++) {
        const cols = (i % 9) + 1
        const rows = Math.floor(i / 9) + 1
        cache.learn(
          `Create a ${cols}x${rows} grid of sticky notes`,
          [{
            tool: 'createObject',
            input: { type: 'sticky', x: i * 10, y: 100, text: `Note ${i}` },
            result: '{"success":true}',
          }],
          `Created grid ${i}.`
        )
      }
      expect(cache.size).toBe(50)

      // Add one more with a unique intent — should evict the oldest
      cache.learn(
        'Create a SWOT analysis template',
        [{
          tool: 'createObject',
          input: { type: 'frame', x: 0, y: 0, text: 'SWOT' },
          result: '{"success":true}',
        }],
        'Created SWOT.'
      )
      expect(cache.size).toBe(50) // still 50, not 51
    })

    it('deduplicates recipes with the same intent', () => {
      cache.learn(
        'Create a yellow sticky that says Hello',
        [{ tool: 'createObject', input: { type: 'sticky', fill: '#FFD700', text: 'Hello' }, result: '{"success":true}' }],
        'Created.'
      )
      cache.learn(
        'Add a green sticky that says World',
        [{ tool: 'createObject', input: { type: 'sticky', fill: '#98FB98', text: 'World' }, result: '{"success":true}' }],
        'Created.'
      )

      // Both are create_sticky intent — only 1 stored
      expect(cache.size).toBe(1)
    })
  })
})
