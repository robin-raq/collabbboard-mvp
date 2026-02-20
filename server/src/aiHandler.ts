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
import type { ObjectType, BoardObject } from '../../shared/types.js'

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
      'Create a new object on the whiteboard. Supported types: sticky (sticky note), rect (rectangle), circle, text, frame. Returns the created object ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['sticky', 'rect', 'circle', 'text', 'frame'],
          description: 'The type of object to create',
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
          description: 'Width of the object. Defaults: sticky=200, rect=150, circle=100, text=200, frame=400',
        },
        height: {
          type: 'number',
          description: 'Height of the object. Defaults: sticky=150, rect=100, circle=100, text=50, frame=300',
        },
        text: {
          type: 'string',
          description: 'Text content (used by sticky, text, frame label)',
        },
        fill: {
          type: 'string',
          description: 'CSS color string. Common sticky note colors: #FFD700 (yellow), #98FB98 (green), #87CEEB (blue), #FFB6C1 (pink), #DDA0DD (purple), #FFA07A (orange)',
        },
        fontSize: {
          type: 'number',
          description: 'Font size for text objects (default 14)',
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
  },
]

// ---------------------------------------------------------------------------
// Tool Execution (exported for testing)
// ---------------------------------------------------------------------------

interface ToolAction {
  tool: string
  input: Record<string, unknown>
  result: string
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const defaultSizes: Record<string, { width: number; height: number }> = {
  sticky: { width: 200, height: 150 },
  rect: { width: 150, height: 100 },
  circle: { width: 100, height: 100 },
  text: { width: 200, height: 50 },
  frame: { width: 400, height: 300 },
}

const defaultColors: Record<string, string> = {
  sticky: '#FFD700',
  rect: '#87CEEB',
  circle: '#DDA0DD',
  text: '#333333',
  frame: '#E8E8E8',
}

/**
 * Check if two rectangles overlap (with optional padding).
 */
function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  padding = 0,
): boolean {
  return (
    ax < bx + bw + padding &&
    ax + aw + padding > bx &&
    ay < by + bh + padding &&
    ay + ah + padding > by
  )
}

/**
 * Find a non-overlapping position for a new object.
 * Scans right then down until a clear spot is found.
 */
export function findOpenPosition(
  x: number, y: number, width: number, height: number,
  objectsMap: Y.Map<BoardObject>,
  padding = 20,
): { x: number; y: number } {
  const existing: Array<{ x: number; y: number; width: number; height: number }> = []
  objectsMap.forEach((obj) => {
    existing.push({ x: obj.x, y: obj.y, width: obj.width, height: obj.height })
  })

  // If no existing objects, return as-is
  if (existing.length === 0) return { x, y }

  // Check if the proposed position is clear
  const hasOverlap = (px: number, py: number) =>
    existing.some((e) => rectsOverlap(px, py, width, height, e.x, e.y, e.width, e.height, padding))

  // If no overlap, return original position
  if (!hasOverlap(x, y)) return { x, y }

  // Try shifting right, then wrapping to next row
  const stepX = width + padding
  const stepY = height + padding
  const maxX = 1100
  const maxY = 700

  let tryX = x
  let tryY = y

  for (let row = 0; row < 20; row++) {
    tryX = x + (row === 0 ? stepX : 0)
    if (row > 0) tryY = y + row * stepY

    for (let col = 0; col < 20; col++) {
      if (!hasOverlap(tryX, tryY)) {
        return { x: Math.min(tryX, maxX), y: Math.min(tryY, maxY) }
      }
      tryX += stepX
      if (tryX + width > maxX + 200) {
        break // wrap to next row
      }
    }
    tryX = 50 // reset to left edge for next row
  }

  // Fallback: place below all existing objects
  const maxBottom = Math.max(...existing.map((e) => e.y + e.height))
  return { x, y: maxBottom + padding }
}

export function executeCreateObject(
  input: Record<string, unknown>,
  objectsMap: Y.Map<BoardObject>
): string {
  const type = input.type as ObjectType
  const defaults = defaultSizes[type] || { width: 150, height: 100 }
  const id = generateId()

  const requestedX = (input.x as number) || 100
  const requestedY = (input.y as number) || 100
  const width = (input.width as number) || defaults.width
  const height = (input.height as number) || defaults.height

  // Find non-overlapping position
  const pos = findOpenPosition(requestedX, requestedY, width, height, objectsMap)

  const obj: BoardObject = {
    id,
    type,
    x: pos.x,
    y: pos.y,
    width,
    height,
    fill: (input.fill as string) || defaultColors[type] || '#FFD700',
    rotation: 0,
  }

  if (input.text !== undefined) obj.text = input.text as string
  if (input.fontSize !== undefined) obj.fontSize = input.fontSize as number

  objectsMap.set(id, obj)
  return JSON.stringify({ success: true, id, type: obj.type, text: obj.text || '' })
}

export function executeUpdateObject(
  input: Record<string, unknown>,
  objectsMap: Y.Map<BoardObject>
): string {
  const id = input.id as string
  const existing = objectsMap.get(id)

  if (!existing) {
    return JSON.stringify({ success: false, error: `Object ${id} not found` })
  }

  const updated: BoardObject = { ...existing }
  if (input.text !== undefined) updated.text = input.text as string
  if (input.fill !== undefined) updated.fill = input.fill as string
  if (input.width !== undefined) updated.width = input.width as number
  if (input.height !== undefined) updated.height = input.height as number
  if (input.fontSize !== undefined) updated.fontSize = input.fontSize as number

  objectsMap.set(id, updated)
  return JSON.stringify({ success: true, id, updated: Object.keys(input).filter(k => k !== 'id') })
}

export function executeMoveObject(
  input: Record<string, unknown>,
  objectsMap: Y.Map<BoardObject>
): string {
  const id = input.id as string
  const existing = objectsMap.get(id)

  if (!existing) {
    return JSON.stringify({ success: false, error: `Object ${id} not found` })
  }

  const updated: BoardObject = {
    ...existing,
    x: input.x as number,
    y: input.y as number,
  }

  objectsMap.set(id, updated)
  return JSON.stringify({ success: true, id, x: updated.x, y: updated.y })
}

function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  objectsMap: Y.Map<BoardObject>
): string {
  switch (toolName) {
    case 'createObject':
      return executeCreateObject(input, objectsMap)
    case 'updateObject':
      return executeUpdateObject(input, objectsMap)
    case 'moveObject':
      return executeMoveObject(input, objectsMap)
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` })
  }
}

// ---------------------------------------------------------------------------
// Board Snapshot for System Prompt (exported for testing)
// ---------------------------------------------------------------------------

export function buildBoardContext(objectsMap: Y.Map<BoardObject>): string {
  const objects: BoardObject[] = []
  objectsMap.forEach((obj) => {
    objects.push(obj)
  })

  if (objects.length === 0) {
    return 'The board is currently empty. No objects exist yet.'
  }

  const summary = objects.map((obj) => {
    let desc = `- ID: "${obj.id}" | Type: ${obj.type} | Position: (${obj.x}, ${obj.y}) | Size: ${obj.width}x${obj.height} | Color: ${obj.fill}`
    if (obj.text) desc += ` | Text: "${obj.text}"`
    return desc
  })

  return `Current board objects (${objects.length} total):\n${summary.join('\n')}`
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI assistant that helps users work with a collaborative whiteboard called CollabBoard. You can create, update, and move objects on the board.

IMPORTANT RULES:
1. Use the provided tools to make changes to the board. Always use tools — never just describe what you would do.
2. For creating objects, keep positions within the visible area (x: 50-1100, y: 50-700).
3. AVOID OVERLAPPING: Before placing new objects, check the board context for existing object positions. Choose coordinates that do not overlap with existing objects. Leave at least 20px gap between objects. The server will auto-nudge overlapping objects, but you should try to pick clear spots first.
4. When creating grids or layouts, space objects evenly with ~20-30px gaps.
4. For "sticky note" requests, use type "sticky" with default size 200x150.
5. For retrospective or template boards, create frames as containers first, then add sticky notes inside them.
6. Common sticky note colors: #FFD700 (yellow), #98FB98 (green), #87CEEB (blue), #FFB6C1 (pink), #DDA0DD (purple), #FFA07A (orange).
7. When asked to change a property of "the sticky note" or similar, look at the board context to find the matching object by type or text.
8. When creating grids, calculate positions carefully. For a 2x3 grid with 200x150 sticky notes and 20px gaps: row spacing = 150 + 20 = 170px, column spacing = 200 + 20 = 220px.
9. For retrospective boards, create 3 columns with frame containers labeled "What Went Well", "What Didn't Go Well", and "Action Items", each containing 2-3 empty sticky notes.
10. When arranging existing objects in a grid, use the moveObject tool to reposition them.
11. Always respond with a brief, friendly message describing what you did after using tools.`

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

const MODEL_FAST = 'claude-sonnet-4-20250514'
const MODEL_POWERFUL = 'claude-sonnet-4-20250514'

/**
 * Classify command complexity for token budget and turn limits.
 * Complex = grids, layouts, templates, multi-step, or long/ambiguous prompts.
 * Returns the model name (currently same model, but allows easy swap to Haiku
 * when available on the API plan).
 */
const COMPLEX_PATTERNS = /\b(grid|layout|arrange|template|retrospective|swot|journey|kanban|columns?|rows?|organiz|section|multiple|plan(ning)?|chart|diagram|visuali[sz]e|bar\s*chart|pie\s*chart|map|board)\b/i

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
  const maxTokens = complex ? 2048 : 1024

  console.log(`[AI] Using ${complex ? 'complex' : 'simple'} budget for: "${userMessage.slice(0, 60)}"`)

  // Build initial messages
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `${boardContext}\n\nUser command: ${userMessage}`,
    },
  ]

  // Multi-turn tool-use loop (cap at 3 for simple, 10 for complex)
  let maxTurns = complex ? 10 : 3
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
      system: SYSTEM_PROMPT,
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
