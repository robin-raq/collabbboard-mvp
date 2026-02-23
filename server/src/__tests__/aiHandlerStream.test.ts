/**
 * AI Handler Stream Tests (TDD)
 *
 * Tests the streaming async generator that yields AIStreamEvent objects.
 * These test the event protocol without hitting the Claude API.
 *
 * Tests:
 *  - Generator yields tool_result events for local parser actions
 *  - Generator yields done event with final message
 *  - Generator yields error event when signal is aborted
 *  - Generator handles cache hits with instant results
 *  - Event sequence is valid (status → tool_results → done)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'

import { processAICommandStream, commandCache } from '../aiHandler.js'
import type { AIStreamEvent } from '../../../shared/aiStreamTypes.js'
import type { ToolAction } from '../../../shared/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(
  gen: AsyncGenerator<AIStreamEvent>
): Promise<AIStreamEvent[]> {
  const events: AIStreamEvent[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processAICommandStream', () => {
  beforeEach(() => {
    commandCache.clear()
  })

  it('yields tool_result events for each local parser action', async () => {
    const doc = new Y.Doc()

    // Without API key, falls to local parser. "Create a yellow sticky" should work.
    const gen = processAICommandStream('Create a yellow sticky note that says Hello', doc)
    const events = await collectEvents(gen)

    // Should have at least a tool_result and a done event
    const toolResults = events.filter((e) => e.type === 'tool_result')
    expect(toolResults.length).toBeGreaterThanOrEqual(1)

    // Each tool_result should have an action
    for (const event of toolResults) {
      if (event.type === 'tool_result') {
        expect(event.action.tool).toBe('createObject')
        expect(event.action.input).toBeDefined()
        expect(event.action.result).toBeDefined()
      }
    }
  })

  it('yields done event with final message and all actions', async () => {
    const doc = new Y.Doc()

    const gen = processAICommandStream('Add a blue sticky note that says Test', doc)
    const events = await collectEvents(gen)

    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()
    if (doneEvent?.type === 'done') {
      expect(doneEvent.message).toBeDefined()
      expect(doneEvent.message.length).toBeGreaterThan(0)
      expect(doneEvent.actions).toBeInstanceOf(Array)
      expect(doneEvent.actions.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('yields error event when signal is aborted', async () => {
    const doc = new Y.Doc()
    const controller = new AbortController()

    // Abort immediately
    controller.abort()

    const gen = processAICommandStream(
      'Create a yellow sticky note that says Cancelled',
      doc,
      undefined,
      controller.signal
    )
    const events = await collectEvents(gen)

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    if (errorEvent?.type === 'error') {
      expect(errorEvent.error).toContain('abort')
    }
  })

  it('handles cache hits with instant results and cached flag', async () => {
    const doc = new Y.Doc()

    // Pre-populate the cache
    const actions: ToolAction[] = [{
      tool: 'createObject',
      input: { type: 'sticky', x: 100, y: 100, fill: '#FFD700', text: 'Hello' },
      result: '{"success":true,"id":"ai-123","type":"sticky","text":"Hello"}',
    }]
    commandCache.learn(
      'Create a yellow sticky note that says Hello',
      actions,
      "Created a yellow sticky 'Hello'."
    )

    // Process a similar command — should hit cache
    const gen = processAICommandStream('Create a blue sticky note that says World', doc)
    const events = await collectEvents(gen)

    // Should have tool_result and done events
    const toolResults = events.filter((e) => e.type === 'tool_result')
    expect(toolResults.length).toBe(1)

    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()
    if (doneEvent?.type === 'done') {
      expect(doneEvent.cached).toBe(true)
      expect(doneEvent.actions).toHaveLength(1)
    }
  })

  it('event sequence is valid: tool_results come before done', async () => {
    const doc = new Y.Doc()

    const gen = processAICommandStream('Create a green sticky note that says Sequence', doc)
    const events = await collectEvents(gen)

    // Find indices
    const doneIndex = events.findIndex((e) => e.type === 'done')
    expect(doneIndex).toBeGreaterThan(-1) // done event exists

    // All tool_results should come before done
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === 'tool_result') {
        expect(i).toBeLessThan(doneIndex)
      }
    }
  })

  it('done event never appears more than once', async () => {
    const doc = new Y.Doc()

    const gen = processAICommandStream('Create a sticky note', doc)
    const events = await collectEvents(gen)

    const doneEvents = events.filter((e) => e.type === 'done')
    expect(doneEvents.length).toBe(1)
  })

  it('creates objects on the Y.Doc during streaming', async () => {
    const doc = new Y.Doc()
    const objectsMap = doc.getMap('objects')

    const gen = processAICommandStream('Add a yellow sticky that says Streamed', doc)
    await collectEvents(gen) // consume all events

    expect(objectsMap.size).toBe(1)
  })
})
