/**
 * AI Agent for CollabBoard
 *
 * Processes natural language commands using Claude Sonnet with tool calling.
 * Mutates the server-side Y.Doc so changes auto-sync to all connected clients.
 *
 * 3 tools: createObject, updateObject, moveObject
 * 6 supported commands:
 *  1. Create a sticky note with text
 *  2. Create a colored rectangle at a position
 *  3. Change an object's color
 *  4. Create a grid of sticky notes
 *  5. Arrange existing sticky notes in a grid
 *  6. Set up a template board (e.g., retrospective)
 */

import Anthropic from '@anthropic-ai/sdk'
import * as Y from 'yjs'
import { parseCommand } from './localParser.js'
import { createTrace } from './langfuse.js'
import { CommandCache } from './commandCache.js'
import {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
  buildBoardContext,
  executeTool,
  findOpenPosition,
} from './toolExecutors.js'
import type { BoardObject, ToolAction } from '../../shared/types.js'

// Re-export tool executors for backward compatibility (existing tests + localParser)
export {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
  buildBoardContext,
  findOpenPosition,
}

// Re-export executeGetBoardState for backward compatibility
export function executeGetBoardState(objectsMap: Y.Map<BoardObject>): string {
  return buildBoardContext(objectsMap)
}

// ---------------------------------------------------------------------------
// Command Cache Singleton
// ---------------------------------------------------------------------------

export const commandCache = new CommandCache()

// ---------------------------------------------------------------------------
// Anthropic Client (conditional — null when API key is not set)
// ---------------------------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY
const anthropic = apiKey ? new Anthropic({ apiKey }) : null

if (!anthropic) {
  console.log('[AI] No ANTHROPIC_API_KEY — using local command parser (fallback mode)')
} else {
  console.log('[AI] Anthropic API key configured — using Claude for AI commands')
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  {
    name: 'createObject',
    description:
      'Create a new object on the whiteboard. Supported types: sticky (sticky note), rect (rectangle), circle, text, frame, line (line/arrow connector). Returns the created object ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['sticky', 'rect', 'circle', 'text', 'frame', 'line'],
          description: 'The type of object to create. Use "line" for arrows/connectors between objects.',
        },
        x: {
          type: 'number',
          description: 'X position on the canvas (0-1200 recommended for visible area)',
        },
        y: {
          type: 'number',
          description: 'Y position on the canvas (0-800 recommended for visible area)',
        },
        width: {
          type: 'number',
          description: 'Width of the object. Defaults: sticky=200, rect=150, circle=100, text=200, frame=400, line=2',
        },
        height: {
          type: 'number',
          description: 'Height of the object. Defaults: sticky=150, rect=100, circle=100, text=50, frame=300, line=2',
        },
        text: {
          type: 'string',
          description: 'Text content (used by sticky, text, frame label)',
        },
        fill: {
          type: 'string',
          description: 'CSS color string. Common sticky note colors: #FFD700 (yellow), #98FB98 (green), #87CEEB (blue), #FFB6C1 (pink), #DDA0DD (purple), #FFA07A (orange). Lines default to #333333.',
        },
        fontSize: {
          type: 'number',
          description: 'Font size for text objects (default 14)',
        },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'For line type only. Array of [x1, y1, x2, y2] relative to (x, y). E.g., [0, 0, 200, 0] draws a horizontal line 200px to the right from (x, y).',
        },
        fromId: {
          type: 'string',
          description: 'For line type only. ID of the object this line starts from (connector source).',
        },
        toId: {
          type: 'string',
          description: 'For line type only. ID of the object this line ends at (connector target).',
        },
        arrowEnd: {
          type: 'boolean',
          description: 'For line type only. Show arrowhead at the end of the line. Default true.',
        },
        skipCollisionCheck: {
          type: 'boolean',
          description: 'Set to true when placing objects intentionally inside frames or in a pre-calculated layout (e.g., SWOT, retro, kanban). Skips auto-repositioning so objects land at the exact requested coordinates. Lines always skip collision check automatically.',
        },
        parentId: {
          type: 'string',
          description: 'ID of the parent frame this object belongs to. When set, the object will move together with the frame when the frame is dragged. Always set this when placing objects inside a frame.',
        },
      },
      required: ['type', 'x', 'y'],
    },
  },
  {
    name: 'updateObject',
    description:
      'Update properties of an existing object on the whiteboard. Use this to change color, text, size, or other properties.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the object to update',
        },
        text: {
          type: 'string',
          description: 'New text content',
        },
        fill: {
          type: 'string',
          description: 'New CSS color string',
        },
        width: {
          type: 'number',
          description: 'New width',
        },
        height: {
          type: 'number',
          description: 'New height',
        },
        fontSize: {
          type: 'number',
          description: 'New font size',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'getBoardState',
    description:
      'Get a snapshot of all current objects on the board with their positions, sizes, colors, and text. Call this BEFORE creating complex layouts (SWOT, retro, kanban) to see what already exists and avoid overlaps. Call this AFTER placing multiple objects to verify they landed in the right positions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position on the whiteboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the object to move',
        },
        x: {
          type: 'number',
          description: 'New X position',
        },
        y: {
          type: 'number',
          description: 'New Y position',
        },
      },
      required: ['id', 'x', 'y'],
    },
    cache_control: { type: 'ephemeral' as const },
  },
]

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are an AI assistant for CollabBoard, a collaborative whiteboard. You create, update, and move objects using tools.

CRITICAL — AVOID OVERLAPS:
Read the board context provided with each command. Calculate the bounding box of existing objects (max x+width, max y+height). Place new objects OUTSIDE it. Use getBoardState after placing multiple objects to verify.

RULES:
1. Always use tools — never just describe actions. Check createObject return values for actual positions.
2. Keep positions in visible area (x:50-1200, y:50-900). Canvas scrolls beyond.
3. For "sticky note" requests, use type "sticky" (200x150 default). Colors are in tool schema.
4. To change a property of "the sticky note", find it in board context by type/text.
5. For structured layouts (SWOT, retro, kanban, grids): use skipCollisionCheck:true on every createObject. Plan coordinates first. Grid spacing: col=width+20, row=height+20.
6. Objects inside frames: inset 15px from edges (x=frame.x+15, y=frame.y+35 for label clearance). ALWAYS set parentId to the frame's ID.
7. Lines/connectors: use type "line" with points=[x1,y1,x2,y2] relative to (x,y). Set fromId and toId for semantic connections. For flowcharts: create boxes first, then connect with lines.
8. Respond with a brief, friendly message after using tools.`

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export interface AIResponse {
  message: string
  actions: ToolAction[]
}

export interface AICommandMetadata {
  boardId?: string
  userId?: string
  sessionId?: string
}

const MODEL_FAST = 'claude-haiku-4-5-20250514'
const MODEL_POWERFUL = 'claude-sonnet-4-20250514'

/**
 * Classify command complexity for token budget and turn limits.
 * Complex = grids, layouts, templates, multi-step, or long/ambiguous prompts.
 * Returns the model name (currently same model, but allows easy swap to Haiku
 * when available on the API plan).
 */
const COMPLEX_PATTERNS = /\b(grid|layout|arrange|template|retrospective|swot|journey|kanban|columns?|rows?|organiz|section|multiple|plan(ning)?|flow\s*chart|chart|diagram|visuali[sz]e|bar\s*chart|pie\s*chart|map|board|pros?\s*(and|&)\s*cons?|compare|comparison|list\s+of|brainstorm|matrix|timeline|roadmap|workflow|priorit|categor|connect|arrow)\b/i

export function selectModel(userMessage: string): string {
  if (COMPLEX_PATTERNS.test(userMessage) || userMessage.length > 120) {
    return MODEL_POWERFUL
  }
  return MODEL_FAST
}

export function isComplexCommand(userMessage: string): boolean {
  return COMPLEX_PATTERNS.test(userMessage) || userMessage.length > 120
}

export async function processAICommand(
  userMessage: string,
  doc: Y.Doc,
  metadata?: AICommandMetadata
): Promise<AIResponse> {
  const objectsMap = doc.getMap('objects') as Y.Map<BoardObject>
  const objectCount = objectsMap.size

  // Create a trace for this entire AI command
  const trace = createTrace({
    name: 'ai-command',
    userId: metadata?.userId,
    sessionId: metadata?.sessionId,
    input: userMessage,
    metadata: {
      boardId: metadata?.boardId ?? 'unknown',
      objectCount: String(objectCount),
    },
  })

  // -----------------------------------------------------------------------
  // Fast path: check command cache for a learned recipe
  // -----------------------------------------------------------------------
  const cachedRecipe = commandCache.match(userMessage)
  if (cachedRecipe) {
    console.log(`[AI] Cache hit (intent: ${cachedRecipe.intentKey}, hits: ${cachedRecipe.hitCount}) for: "${userMessage.slice(0, 60)}"`)

    const cacheSpan = trace.span({
      name: 'cache-replay',
      input: { message: userMessage, intentKey: cachedRecipe.intentKey },
    })

    const result = commandCache.replay(cachedRecipe, userMessage, objectsMap)

    cacheSpan.update({
      output: { message: result.message, actionCount: result.actions.length },
    })
    cacheSpan.end()

    trace.update({
      output: { message: result.message, actionCount: result.actions.length },
      metadata: {
        path: 'cache-hit',
        intentKey: cachedRecipe.intentKey,
        hitCount: String(cachedRecipe.hitCount),
        boardId: metadata?.boardId ?? 'unknown',
        objectCount: String(objectCount),
      },
    })

    return result
  }

  // Fallback: use local parser when Anthropic API is not available
  if (!anthropic) {
    console.log('[AI] Using local parser for command:', userMessage.slice(0, 80))

    const parserSpan = trace.span({
      name: 'local-parser',
      input: { message: userMessage },
    })

    const result = parseCommand(userMessage, doc)

    parserSpan.update({
      output: { message: result.message, actionCount: result.actions.length },
    })
    parserSpan.end()

    trace.update({
      output: { message: result.message, actionCount: result.actions.length },
      metadata: {
        path: 'local-parser',
        boardId: metadata?.boardId ?? 'unknown',
        objectCount: String(objectCount),
      },
    })

    return result
  }

  try {
  // Full Claude-powered path
  const boardContext = buildBoardContext(objectsMap)
  const actions: ToolAction[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Route model and set token/turn budgets based on command complexity
  const modelName = selectModel(userMessage)
  const complex = isComplexCommand(userMessage)
  const maxTokens = complex ? 2048 : 512

  console.log(`[AI] Using ${complex ? 'complex' : 'simple'} budget for: "${userMessage.slice(0, 60)}"`)

  // Build initial messages
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `${boardContext}\n\nUser command: ${userMessage}`,
    },
  ]

  // Multi-turn tool-use loop (cap at 3 for simple, 8 for complex to allow getBoardState checks)
  let maxTurns = complex ? 8 : 3
  let turnNumber = 0
  while (maxTurns-- > 0) {
    turnNumber++

    // Trace this LLM generation
    const generation = trace.generation({
      name: `claude-call-${turnNumber}`,
      model: modelName,
      input: messages,
      modelParameters: { max_tokens: maxTokens },
    })

    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: maxTokens,
      temperature: 0,
      system: [{
        type: 'text' as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      }],
      tools,
      messages,
    })

    // Track token usage
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    totalInputTokens += inputTokens
    totalOutputTokens += outputTokens

    // Update generation with response data
    generation.update({
      output: response.content,
      usage: { input: inputTokens, output: outputTokens },
      metadata: { stopReason: response.stop_reason },
    })
    generation.end()

    // Collect text response parts
    let textResponse = ''
    const toolResultBlocks: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text
      } else if (block.type === 'tool_use') {
        // Trace tool execution
        const toolSpan = trace.span({
          name: `tool-${block.name}`,
          input: block.input,
        })

        // Execute the tool
        const result = executeTool(
          block.name,
          block.input as Record<string, unknown>,
          objectsMap
        )

        toolSpan.update({ output: JSON.parse(result) })
        toolSpan.end()

        actions.push({
          tool: block.name,
          input: block.input as Record<string, unknown>,
          result,
        })

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
    }

    // If no tool calls, we're done
    if (response.stop_reason === 'end_turn' || toolResultBlocks.length === 0) {
      const aiResponse = {
        message: textResponse || 'Done! The board has been updated.',
        actions,
      }

      // Learn from this successful API call for future cache hits
      commandCache.learn(userMessage, actions, aiResponse.message)

      trace.update({
        output: { message: aiResponse.message, actionCount: actions.length },
        metadata: {
          path: 'claude-api',
          boardId: metadata?.boardId ?? 'unknown',
          objectCount: String(objectCount),
          totalInputTokens: String(totalInputTokens),
          totalOutputTokens: String(totalOutputTokens),
          totalTurns: String(turnNumber),
          toolCallCount: String(actions.length),
        },
      })

      return aiResponse
    }

    // Continue the conversation with tool results
    messages.push({
      role: 'assistant',
      content: response.content,
    })
    messages.push({
      role: 'user',
      content: toolResultBlocks as unknown as Anthropic.MessageParam['content'],
    })
  }

  const aiResponse = {
    message: 'Completed the requested changes.',
    actions,
  }

  // Learn from this successful API call for future cache hits
  commandCache.learn(userMessage, actions, aiResponse.message)

  trace.update({
    output: { message: aiResponse.message, actionCount: actions.length },
    metadata: {
      path: 'claude-api',
      boardId: metadata?.boardId ?? 'unknown',
      objectCount: String(objectCount),
      totalInputTokens: String(totalInputTokens),
      totalOutputTokens: String(totalOutputTokens),
      totalTurns: String(turnNumber),
      toolCallCount: String(actions.length),
      maxTurnsReached: 'true',
    },
  })

  return aiResponse
  } catch (err) {
    // Update trace with error info before falling back
    trace.update({
      output: { error: String(err).slice(0, 200) },
      metadata: {
        path: 'claude-api-fallback',
        boardId: metadata?.boardId ?? 'unknown',
        objectCount: String(objectCount),
        error: String(err).slice(0, 200),
      },
    })

    // Fallback to local parser on any API error (e.g., no credits, rate limit)
    console.log('[AI] Claude API error, falling back to local parser:', String(err).slice(0, 120))
    return parseCommand(userMessage, doc)
  }
}

// ---------------------------------------------------------------------------
// Streaming Entry Point (async generator)
// ---------------------------------------------------------------------------

import type { AIStreamEvent } from '../../shared/aiStreamTypes.js'

/**
 * Process an AI command and yield stream events incrementally.
 *
 * Yields AIStreamEvent objects as processing progresses:
 *  - tool_result for each tool call executed
 *  - done when complete (with cached flag for cache hits)
 *  - error if aborted or failed
 *
 * For cache hits and local parser results, tool_results are yielded
 * one at a time followed by done — giving the client incremental feedback.
 *
 * For Claude API calls (when API key is set), the same pattern applies
 * but with additional status events.
 */
export async function* processAICommandStream(
  userMessage: string,
  doc: Y.Doc,
  metadata?: AICommandMetadata,
  signal?: AbortSignal
): AsyncGenerator<AIStreamEvent> {
  // Check for abort before starting
  if (signal?.aborted) {
    yield { type: 'error', error: 'Request aborted before processing started.' }
    return
  }

  const objectsMap = doc.getMap('objects') as Y.Map<BoardObject>

  // -----------------------------------------------------------------------
  // Fast path: check command cache for a learned recipe
  // -----------------------------------------------------------------------
  const cachedRecipe = commandCache.match(userMessage)
  if (cachedRecipe) {
    console.log(`[AI][stream] Cache hit (intent: ${cachedRecipe.intentKey}) for: "${userMessage.slice(0, 60)}"`)

    const result = commandCache.replay(cachedRecipe, userMessage, objectsMap)

    // Yield each action incrementally
    for (const action of result.actions) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Request aborted during cache replay.' }
        return
      }
      yield { type: 'tool_result', action }
    }

    yield {
      type: 'done',
      message: result.message,
      actions: result.actions,
      cached: true,
    }
    return
  }

  // -----------------------------------------------------------------------
  // Local parser fallback (no API key)
  // -----------------------------------------------------------------------
  if (!anthropic) {
    console.log(`[AI][stream] Local parser for: "${userMessage.slice(0, 60)}"`)

    const result = parseCommand(userMessage, doc)

    // Yield each action incrementally
    for (const action of result.actions) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Request aborted during local parsing.' }
        return
      }
      yield { type: 'tool_result', action }
    }

    yield {
      type: 'done',
      message: result.message,
      actions: result.actions,
    }
    return
  }

  // -----------------------------------------------------------------------
  // Claude API path (streaming)
  // -----------------------------------------------------------------------
  try {
    yield { type: 'status', status: 'thinking' }

    const boardContext = buildBoardContext(objectsMap)
    const actions: ToolAction[] = []

    const modelName = selectModel(userMessage)
    const complex = isComplexCommand(userMessage)
    const maxTokens = complex ? 2048 : 512

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `${boardContext}\n\nUser command: ${userMessage}` },
    ]

    let maxTurns = complex ? 8 : 3
    while (maxTurns-- > 0) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Request aborted during Claude API call.' }
        return
      }

      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature: 0,
        system: [{
          type: 'text' as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        }],
        tools,
        messages,
      })

      let textResponse = ''
      const toolResultBlocks: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []

      for (const block of response.content) {
        if (block.type === 'text') {
          textResponse += block.text
          if (block.text) {
            yield { type: 'text_delta', content: block.text }
          }
        } else if (block.type === 'tool_use') {
          yield { type: 'status', status: 'executing' }

          const result = executeTool(
            block.name,
            block.input as Record<string, unknown>,
            objectsMap
          )

          const action: ToolAction = {
            tool: block.name,
            input: block.input as Record<string, unknown>,
            result,
          }
          actions.push(action)

          yield { type: 'tool_result', action }

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          })
        }
      }

      if (response.stop_reason === 'end_turn' || toolResultBlocks.length === 0) {
        const message = textResponse || 'Done! The board has been updated.'

        // Learn for future cache hits
        commandCache.learn(userMessage, actions, message)

        yield {
          type: 'done',
          message,
          actions,
        }
        return
      }

      // Continue multi-turn conversation
      messages.push({ role: 'assistant', content: response.content })
      messages.push({
        role: 'user',
        content: toolResultBlocks as unknown as Anthropic.MessageParam['content'],
      })

      yield { type: 'status', status: 'thinking' }
    }

    // Max turns reached
    const message = 'Completed the requested changes.'
    commandCache.learn(userMessage, actions, message)

    yield {
      type: 'done',
      message,
      actions,
    }
  } catch (err) {
    if (signal?.aborted) {
      yield { type: 'error', error: 'Request aborted.' }
      return
    }

    console.log('[AI][stream] Claude API error, falling back to local parser:', String(err).slice(0, 120))

    // Fallback to local parser
    const result = parseCommand(userMessage, doc)
    for (const action of result.actions) {
      yield { type: 'tool_result', action }
    }
    yield {
      type: 'done',
      message: result.message,
      actions: result.actions,
    }
  }
}
