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
import type { ObjectType, BoardObject, ToolAction } from '../../shared/types.js'

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
// Tool Execution (exported for testing)
// ---------------------------------------------------------------------------

// ToolAction imported from shared/types

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const defaultSizes: Record<string, { width: number; height: number }> = {
  sticky: { width: 200, height: 150 },
  rect: { width: 150, height: 100 },
  circle: { width: 100, height: 100 },
  text: { width: 200, height: 50 },
  frame: { width: 400, height: 300 },
  line: { width: 2, height: 2 },
}

const defaultColors: Record<string, string> = {
  sticky: '#FFD700',
  rect: '#87CEEB',
  circle: '#DDA0DD',
  text: '#333333',
  frame: '#E8E8E8',
  line: '#333333',
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

  // Find non-overlapping position (skip for lines, frames/layouts with skipCollisionCheck)
  const skipCollision = input.skipCollisionCheck || type === 'line'
  const pos = skipCollision
    ? { x: requestedX, y: requestedY }
    : findOpenPosition(requestedX, requestedY, width, height, objectsMap)

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
  if (input.parentId !== undefined) obj.parentId = input.parentId as string

  // Line/connector-specific fields
  if (input.points !== undefined) obj.points = input.points as number[]
  if (input.fromId !== undefined) obj.fromId = input.fromId as string
  if (input.toId !== undefined) obj.toId = input.toId as string
  // Default arrowEnd to true for lines, allow explicit override
  if (type === 'line') {
    obj.arrowEnd = input.arrowEnd !== undefined ? input.arrowEnd as boolean : true
  }

  // Auto-detect parent frame: if no explicit parentId and this isn't a frame,
  // check if the object is fully contained inside an existing frame
  if (!obj.parentId && obj.type !== 'frame') {
    for (const [frameId, frameObj] of objectsMap.entries()) {
      if (frameObj.type === 'frame') {
        const insideX = obj.x >= frameObj.x && obj.x + obj.width <= frameObj.x + frameObj.width
        const insideY = obj.y >= frameObj.y && obj.y + obj.height <= frameObj.y + frameObj.height
        if (insideX && insideY) {
          obj.parentId = frameId
          break
        }
      }
    }
  }

  objectsMap.set(id, obj)
  const result: Record<string, unknown> = {
    success: true, id, type: obj.type, text: obj.text || '',
    x: pos.x, y: pos.y, width, height,
  }
  if (obj.parentId) result.parentId = obj.parentId
  return JSON.stringify(result)
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

export function executeGetBoardState(
  objectsMap: Y.Map<BoardObject>
): string {
  return buildBoardContext(objectsMap)
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
    case 'getBoardState':
      return executeGetBoardState(objectsMap)
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` })
  }
}

// ---------------------------------------------------------------------------
// Board Snapshot for System Prompt (exported for testing)
// ---------------------------------------------------------------------------

export function buildBoardContext(objectsMap: Y.Map<BoardObject>): string {
  const allObjects: BoardObject[] = []
  objectsMap.forEach((obj) => {
    allObjects.push(obj)
  })

  if (allObjects.length === 0) {
    return 'The board is currently empty. No objects exist yet.'
  }

  // Compute bounding box from ALL objects so the AI knows where free space starts
  const maxRight = Math.max(...allObjects.map((o) => o.x + o.width))
  const maxBottom = Math.max(...allObjects.map((o) => o.y + o.height))

  // Cap to nearest 30 objects (by proximity to center of occupied area) to reduce token usage
  const totalCount = allObjects.length
  let objects = allObjects
  if (objects.length > 30) {
    const cx = objects.reduce((s, o) => s + o.x, 0) / objects.length
    const cy = objects.reduce((s, o) => s + o.y, 0) / objects.length
    objects = [...objects].sort((a, b) => {
      const da = (a.x - cx) ** 2 + (a.y - cy) ** 2
      const db = (b.x - cx) ** 2 + (b.y - cy) ** 2
      return da - db
    })
    objects.length = 30
  }

  const truncationNote = totalCount > 30 ? ` (showing nearest 30 of ${totalCount} total)` : ''

  const summary = objects.map((obj) => {
    let desc = `- ID: "${obj.id}" | Type: ${obj.type} | Position: (${obj.x}, ${obj.y}) | Size: ${obj.width}x${obj.height} | Color: ${obj.fill}`
    if (obj.text) desc += ` | Text: "${obj.text}"`
    if (obj.parentId) desc += ` | Parent: "${obj.parentId}"`
    if (obj.fromId) desc += ` | From: "${obj.fromId}"`
    if (obj.toId) desc += ` | To: "${obj.toId}"`
    if (obj.points) desc += ` | Points: [${obj.points.join(', ')}]`
    return desc
  })

  return `Current board objects (${totalCount} total)${truncationNote}:\n${summary.join('\n')}\n\nOccupied area bounding box: x:0-${maxRight}, y:0-${maxBottom}. Place new objects AFTER x:${maxRight + 30} (to the right) or AFTER y:${maxBottom + 30} (below) to avoid overlaps.`
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI assistant that helps users work with a collaborative whiteboard called CollabBoard. You can create, update, move objects, and inspect the board state.

CRITICAL — NEVER OVERLAP EXISTING OBJECTS:
Before placing ANY new objects, you MUST look at the board context provided with the user's message. Calculate the bounding box of all existing objects (find the max x+width and max y+height). Place new objects OUTSIDE that bounding box — either to the right of or below existing content. NEVER place new objects at coordinates that overlap with existing ones.

Example: If the board has objects spanning x:50-600, y:50-700, place new objects starting at x:650 (to the right) or y:750 (below).

IMPORTANT RULES:

**Board awareness:**
1. The board context is provided with every command. ALWAYS read it carefully before placing objects.
2. Use getBoardState to refresh your view after placing multiple objects.
3. The createObject tool returns the ACTUAL position (x, y) of each object — check these values to confirm placement.

**Object placement:**
4. Use the provided tools to make changes to the board. Always use tools — never just describe what you would do.
5. Keep positions within the visible area (x: 50-1200, y: 50-900). The canvas is scrollable so going beyond 1200x900 is OK.
6. For "sticky note" requests, use type "sticky" with default size 200x150.
7. Common sticky note colors: #FFD700 (yellow), #98FB98 (green), #87CEEB (blue), #FFB6C1 (pink), #DDA0DD (purple), #FFA07A (orange).
8. When asked to change a property of "the sticky note" or similar, look at the board context to find the matching object by type or text.

**Structured layouts (SWOT, retro, kanban, grids, pros/cons):**
9. For structured layouts, ALWAYS use skipCollisionCheck: true on each createObject call. This prevents the auto-nudger from pushing objects outside their intended container. Plan your coordinates carefully first.
10. When creating grids, calculate positions carefully. For a 2x3 grid with 200x150 sticky notes and 20px gaps: row spacing = 150 + 20 = 170px, column spacing = 200 + 20 = 220px.
11. For SWOT analysis: create 4 frames in a 2x2 grid (Strengths top-left, Weaknesses top-right, Opportunities bottom-left, Threats bottom-right), then place sticky notes inside each frame using skipCollisionCheck: true.
12. For retrospective boards: create 3 column frames ("What Went Well", "What Didn't Go Well", "Action Items"), then add sticky notes inside each using skipCollisionCheck: true.
13. When arranging existing objects in a grid, use the moveObject tool to reposition them.

**Placing objects INSIDE frames (critical for proper containment):**
14. Frame labels render ABOVE the frame at y:-20, so the usable interior starts at the frame's y coordinate.
15. ALWAYS inset objects by at least 15px from frame edges. Use this formula:
    - Object x = frame.x + 15
    - Object y = frame.y + 35 (extra top padding to clear the frame label)
    - Max object width = frame.width - 30 (15px padding on each side)
    - Max columns = floor((frame.width - 30) / (sticky_width + 10))
16. ALWAYS set parentId to the frame's ID when placing objects inside a frame. This groups them so they move together when the frame is dragged.
17. Example: Frame at (50, 50) size 400x300 → place stickies starting at (65, 85) with 200px wide stickies in 1 column, or use 170px wide stickies for 2 columns at x=65 and x=245.
18. For SWOT with stickies: use frames of at least 450x350, place 180x120 stickies starting at frame.x+15, frame.y+35, with 10px gaps.

**Lines, arrows, and connectors (flowcharts/diagrams):**
19. Use type "line" to draw arrows/connectors between objects. The "points" array is [x1, y1, x2, y2] RELATIVE to the line's (x, y) position.
20. For a horizontal arrow from point A to point B: set x = A.x + A.width, y = A.y + A.height/2, points = [0, 0, gapX, 0] where gapX = B.x - (A.x + A.width).
21. For a vertical arrow: set x = A.x + A.width/2, y = A.y + A.height, points = [0, 0, 0, gapY] where gapY = B.y - (A.y + A.height).
22. ALWAYS set fromId and toId to the IDs of the connected objects. This creates a semantic connector.
23. arrowEnd defaults to true (shows arrowhead). Set to false for plain lines.
24. Lines always skip collision check — place them at exact coordinates.
25. For flowcharts: first create all boxes (rect or sticky), then create lines connecting them. Calculate line start/end from box positions and sizes.
26. Example flowchart step: Box A at (100, 100) size 150x100, Box B at (100, 300) size 150x100. Arrow: x=175, y=200, points=[0, 0, 0, 100], fromId=A.id, toId=B.id.

**Response:**
27. Always respond with a brief, friendly message describing what you did after using tools.`

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
