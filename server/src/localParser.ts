/**
 * Local AI Command Parser
 *
 * A regex/keyword-based fallback that handles the 6 required AI commands
 * without calling the Anthropic API. Used when ANTHROPIC_API_KEY is not set.
 *
 * When the API key is available, the full Claude-powered handler is used instead.
 *
 * 6 supported commands:
 *  1. "Add a yellow sticky note that says User Research" → createObject
 *  2. "Create a blue rectangle at position 100, 200" → createObject
 *  3. "Change the sticky note color to green" → updateObject
 *  4. "Create a 2x3 grid of sticky notes for pros and cons" → createObject × N
 *  5. "Arrange these sticky notes in a grid" → moveObject × N
 *  6. "Set up a retrospective board" → createObject × 9+
 */

import * as Y from 'yjs'
import {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
} from './aiHandler.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolAction {
  tool: string
  input: Record<string, unknown>
  result: string
}

export interface ParsedCommand {
  message: string
  actions: ToolAction[]
}

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  yellow: '#FFD700',
  gold: '#FFD700',
  green: '#98FB98',
  blue: '#87CEEB',
  pink: '#FFB6C1',
  purple: '#DDA0DD',
  orange: '#FFA07A',
  red: '#FF6B6B',
  white: '#FFFFFF',
  gray: '#D1D5DB',
  grey: '#D1D5DB',
}

/**
 * Extract a color from the message text.
 */
function extractColor(msg: string): string | null {
  const lower = msg.toLowerCase()
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(name)) return hex
  }
  // Try hex color
  const hexMatch = lower.match(/#[0-9a-f]{6}/i)
  if (hexMatch) return hexMatch[0]
  return null
}

/**
 * Extract text content from quoted strings or "says/saying/with text" patterns.
 */
function extractText(msg: string): string | null {
  // "that says X", "saying X", "with text X"
  const sayMatch = msg.match(/(?:that\s+says|saying|with\s+text)\s+(.+?)$/i)
  if (sayMatch) return sayMatch[1].trim().replace(/["']+$/, '').replace(/^["']+/, '')

  // Quoted text: "..." or '...'
  const quoteMatch = msg.match(/["']([^"']+)["']/)
  if (quoteMatch) return quoteMatch[1]

  return null
}

/**
 * Extract position from "at position X, Y" or "at X, Y".
 */
function extractPosition(msg: string): { x: number; y: number } | null {
  const posMatch = msg.match(/at\s+(?:position\s+)?(\d+)\s*,\s*(\d+)/i)
  if (posMatch) {
    return { x: parseInt(posMatch[1], 10), y: parseInt(posMatch[2], 10) }
  }
  return null
}

/**
 * Extract grid dimensions from "NxM grid".
 */
function extractGridDimensions(msg: string): { cols: number; rows: number } | null {
  const gridMatch = msg.match(/(\d+)\s*[xX×]\s*(\d+)\s+grid/i)
  if (gridMatch) {
    return { cols: parseInt(gridMatch[1], 10), rows: parseInt(gridMatch[2], 10) }
  }
  return null
}

/**
 * Detect the object type requested.
 */
function extractObjectType(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('sticky') || lower.includes('sticky note')) return 'sticky'
  if (lower.includes('rectangle') || lower.includes('rect')) return 'rect'
  if (lower.includes('circle')) return 'circle'
  if (lower.includes('text')) return 'text'
  if (lower.includes('frame')) return 'frame'
  return 'sticky' // default
}

// ---------------------------------------------------------------------------
// Command Matchers
// ---------------------------------------------------------------------------

/**
 * Check if this is a retrospective/retro board setup command.
 */
function isRetroCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    (lower.includes('retro') && (lower.includes('board') || lower.includes('set up') || lower.includes('create'))) ||
    (lower.includes('retrospective') && (lower.includes('board') || lower.includes('set up') || lower.includes('create')))
  )
}

/**
 * Check if this is a "create grid" command.
 */
function isCreateGridCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return extractGridDimensions(msg) !== null && (lower.includes('create') || lower.includes('make') || lower.includes('add'))
}

/**
 * Check if this is an "arrange in grid" command.
 */
function isArrangeCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('arrange') && lower.includes('grid')
}

/**
 * Check if this is a color change / update command.
 */
function isUpdateColorCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    (lower.includes('change') && lower.includes('color')) ||
    (lower.includes('make') && !lower.includes('grid') && !lower.includes('create')) ||
    lower.includes('update') ||
    (lower.includes('change') && extractColor(msg) !== null)
  )
}

/**
 * Check if this is a create object command.
 */
function isCreateCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('create') || lower.includes('add') || lower.includes('make') || lower.includes('put')
}

// ---------------------------------------------------------------------------
// Command Handlers
// ---------------------------------------------------------------------------

function handleRetroBoard(
  objectsMap: Y.Map<any>
): ParsedCommand {
  const actions: ToolAction[] = []
  const gap = 20
  const frameWidth = 350
  const frameHeight = 500
  const stickyWidth = 200
  const stickyHeight = 150
  const startX = 50
  const startY = 50

  const columns = [
    { label: 'What Went Well', color: '#98FB98' },
    { label: "What Didn't Go Well", color: '#FFB6C1' },
    { label: 'Action Items', color: '#87CEEB' },
  ]

  for (let col = 0; col < columns.length; col++) {
    const frameX = startX + col * (frameWidth + gap)
    const frameY = startY

    // Create frame
    const frameResult = executeCreateObject(
      { type: 'frame', x: frameX, y: frameY, width: frameWidth, height: frameHeight, text: columns[col].label, fill: '#E8E8E8' },
      objectsMap
    )
    actions.push({
      tool: 'createObject',
      input: { type: 'frame', x: frameX, y: frameY, width: frameWidth, height: frameHeight, text: columns[col].label, fill: '#E8E8E8' },
      result: frameResult,
    })

    // Create 2 sticky notes inside each frame
    for (let row = 0; row < 2; row++) {
      const stickyX = frameX + (frameWidth - stickyWidth) / 2
      const stickyY = frameY + 60 + row * (stickyHeight + gap)
      const stickyResult = executeCreateObject(
        { type: 'sticky', x: stickyX, y: stickyY, width: stickyWidth, height: stickyHeight, fill: columns[col].color },
        objectsMap
      )
      actions.push({
        tool: 'createObject',
        input: { type: 'sticky', x: stickyX, y: stickyY, width: stickyWidth, height: stickyHeight, fill: columns[col].color },
        result: stickyResult,
      })
    }
  }

  return {
    message: 'I\'ve set up a retrospective board with three columns: "What Went Well", "What Didn\'t Go Well", and "Action Items". Each column has a frame container with empty sticky notes ready to fill in.',
    actions,
  }
}

function handleCreateGrid(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const dims = extractGridDimensions(msg)!
  const { cols, rows } = dims
  const actions: ToolAction[] = []
  const color = extractColor(msg) || '#FFD700'
  const stickyWidth = 200
  const stickyHeight = 150
  const gap = 20
  const startX = 100
  const startY = 100

  // Extract context for labeling (e.g., "pros and cons")
  const contextMatch = msg.match(/for\s+(.+?)$/i)
  const context = contextMatch ? contextMatch[1].trim() : null

  // Generate labels for grid items
  const labels: string[] = []
  if (context && context.toLowerCase().includes('pros') && context.toLowerCase().includes('cons')) {
    // Pros and cons layout: first half are Pros, second half are Cons
    const halfRows = Math.ceil(rows / 2)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r < halfRows) {
          labels.push(`Pro ${c * halfRows + r + 1}`)
        } else {
          labels.push(`Con ${c * (rows - halfRows) + (r - halfRows) + 1}`)
        }
      }
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        labels.push(context ? `${context} ${r * cols + c + 1}` : '')
      }
    }
  }

  let idx = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (stickyWidth + gap)
      const y = startY + r * (stickyHeight + gap)
      const text = labels[idx] || ''
      const input: Record<string, unknown> = {
        type: 'sticky',
        x,
        y,
        width: stickyWidth,
        height: stickyHeight,
        fill: color,
        ...(text ? { text } : {}),
      }
      const result = executeCreateObject(input, objectsMap)
      actions.push({ tool: 'createObject', input, result })
      idx++
    }
  }

  return {
    message: `Created a ${cols}x${rows} grid of sticky notes (${cols * rows} total).${context ? ` Labeled for: ${context}.` : ''}`,
    actions,
  }
}

function handleArrangeGrid(
  objectsMap: Y.Map<any>
): ParsedCommand {
  // Find all sticky notes on the board
  const stickies: Array<{ id: string; width: number; height: number }> = []
  objectsMap.forEach((obj: any, id: string) => {
    if (obj.type === 'sticky') {
      stickies.push({ id, width: obj.width || 200, height: obj.height || 150 })
    }
  })

  if (stickies.length === 0) {
    return {
      message: "I couldn't find any sticky notes on the board to arrange. Try creating some first!",
      actions: [],
    }
  }

  const actions: ToolAction[] = []
  const gap = 20
  const startX = 100
  const startY = 100
  const cols = Math.ceil(Math.sqrt(stickies.length))

  for (let i = 0; i < stickies.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = startX + col * (stickies[i].width + gap)
    const y = startY + row * (stickies[i].height + gap)
    const input = { id: stickies[i].id, x, y }
    const result = executeMoveObject(input, objectsMap)
    actions.push({ tool: 'moveObject', input, result })
  }

  return {
    message: `Arranged ${stickies.length} sticky notes in a neat grid layout.`,
    actions,
  }
}

function handleUpdateColor(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const color = extractColor(msg)
  if (!color) {
    return { message: "I couldn't determine the color you want. Try specifying a color like red, blue, green, yellow, etc.", actions: [] }
  }

  // Try to find the target object
  const lower = msg.toLowerCase()
  const objType = extractObjectType(msg)
  let targetId: string | null = null
  let typeMatchId: string | null = null

  // Two-pass: first prioritize text content match, then fall back to type match
  objectsMap.forEach((obj: any, id: string) => {
    // Match by text content mentioned in the command (highest priority)
    if (obj.text && lower.includes(obj.text.toLowerCase())) {
      targetId = id
    }

    // Track first type match as fallback
    if (!typeMatchId && obj.type === objType) {
      typeMatchId = id
    }
  })

  // Fall back to type match if no text match found
  if (!targetId) targetId = typeMatchId

  if (!targetId) {
    return { message: `I couldn't find a matching ${objType} on the board. Make sure the object exists first.`, actions: [] }
  }

  const input = { id: targetId, fill: color }
  const result = executeUpdateObject(input, objectsMap)
  const actions: ToolAction[] = [{ tool: 'updateObject', input, result }]

  return {
    message: `Changed the color to ${Object.entries(COLOR_MAP).find(([, v]) => v === color)?.[0] || color}.`,
    actions,
  }
}

function handleCreateObject(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const objType = extractObjectType(msg)
  const color = extractColor(msg) || (objType === 'sticky' ? '#FFD700' : '#87CEEB')
  const text = extractText(msg)
  const position = extractPosition(msg) || { x: 200, y: 200 }

  const input: Record<string, unknown> = {
    type: objType,
    x: position.x,
    y: position.y,
    fill: color,
    ...(text ? { text } : {}),
  }

  const result = executeCreateObject(input, objectsMap)
  const actions: ToolAction[] = [{ tool: 'createObject', input, result }]

  const desc = text ? `${objType} "${text}"` : objType
  return {
    message: `Created a ${Object.entries(COLOR_MAP).find(([, v]) => v === color)?.[0] || ''} ${desc} at position (${position.x}, ${position.y}).`,
    actions,
  }
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

export function parseCommand(message: string, doc: Y.Doc): ParsedCommand {
  const objectsMap = doc.getMap('objects') as Y.Map<any>

  // Order matters — check most specific patterns first

  // 6. Retrospective board
  if (isRetroCommand(message)) {
    return handleRetroBoard(objectsMap)
  }

  // 4. Create a grid of sticky notes
  if (isCreateGridCommand(message)) {
    return handleCreateGrid(message, objectsMap)
  }

  // 5. Arrange existing sticky notes in a grid
  if (isArrangeCommand(message)) {
    return handleArrangeGrid(objectsMap)
  }

  // 3. Change object color
  if (isUpdateColorCommand(message)) {
    return handleUpdateColor(message, objectsMap)
  }

  // 1 & 2. Create an object (sticky note, rectangle, circle, etc.)
  if (isCreateCommand(message)) {
    return handleCreateObject(message, objectsMap)
  }

  // Unrecognized command
  return {
    message: "I'm not sure what you'd like me to do. Try commands like:\n• \"Add a yellow sticky note that says Hello\"\n• \"Create a blue rectangle at position 100, 200\"\n• \"Change the sticky note color to green\"\n• \"Create a 2x3 grid of sticky notes\"\n• \"Arrange the sticky notes in a grid\"\n• \"Set up a retrospective board\"",
    actions: [],
  }
}
