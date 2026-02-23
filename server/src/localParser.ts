/**
 * Local AI Command Parser
 *
 * A regex/keyword-based fallback that handles all 12 AI commands
 * without calling the Anthropic API. Used when ANTHROPIC_API_KEY is not set.
 *
 * When the API key is available, the full Claude-powered handler is used instead.
 *
 * Creation Commands:
 *  1. "Add a yellow sticky note that says User Research"
 *  2. "Create a blue rectangle at position 100, 200"
 *  7. "Add a frame called 'Sprint Planning'"
 *
 * Manipulation Commands:
 *  3. "Change the sticky note color to green"
 *  8. "Move all the pink sticky notes to the right side"
 *  9. "Resize the frame to fit its contents"
 *
 * Layout Commands:
 *  4. "Create a 2x3 grid of sticky notes for pros and cons"
 *  5. "Arrange these sticky notes in a grid"
 * 10. "Space these elements evenly"
 *
 * Complex/Template Commands:
 *  6. "Set up a retrospective board"
 * 11. "Create a SWOT analysis template with four quadrants"
 * 12. "Build a user journey map with 5 stages"
 */

import * as Y from 'yjs'
import {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
} from './aiHandler.js'
import type { ToolAction } from '../../shared/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
 * Extract frame name from "called X" or "named X" patterns.
 */
function extractFrameName(msg: string): string | null {
  const namedMatch = msg.match(/(?:called|named|titled)\s+['"]?(.+?)['"]?\s*$/i)
  if (namedMatch) return namedMatch[1].trim().replace(/["']+$/, '').replace(/^["']+/, '')
  return null
}

/**
 * Extract a direction from the message.
 */
function extractDirection(msg: string): 'left' | 'right' | 'top' | 'bottom' | null {
  const lower = msg.toLowerCase()
  if (lower.includes('right')) return 'right'
  if (lower.includes('left')) return 'left'
  if (lower.includes('top') || lower.includes('upper')) return 'top'
  if (lower.includes('bottom') || lower.includes('lower')) return 'bottom'
  return null
}

/**
 * Extract stage count from "N stages" pattern.
 */
function extractStageCount(msg: string): number {
  const match = msg.match(/(\d+)\s+stage/i)
  return match ? parseInt(match[1], 10) : 5 // default 5 stages
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
 * Check if this is a SWOT analysis template command.
 */
function isSwotCommand(msg: string): boolean {
  return msg.toLowerCase().includes('swot')
}

/**
 * Check if this is a user journey map command.
 */
function isJourneyMapCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('journey') && lower.includes('map')
}

/**
 * Check if this is a "move objects by color" command.
 */
function isMoveByColorCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('move') && extractColor(msg) !== null && extractDirection(msg) !== null
}

/**
 * Check if this is a "resize frame to fit" command.
 */
function isResizeFrameCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('resize') && lower.includes('frame') && lower.includes('fit')
}

/**
 * Check if this is a "space evenly" command.
 */
function isSpaceEvenlyCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('space') && lower.includes('even')
}

/**
 * Check if this is a "create frame" command (with name).
 */
function isCreateFrameCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('frame') && (lower.includes('called') || lower.includes('named') || lower.includes('titled')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('make'))
}

/**
 * Check if this is a create object command.
 */
function isCreateCommand(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('create') || lower.includes('add') || lower.includes('make') || lower.includes('put') || lower.includes('build')
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

// ---------------------------------------------------------------------------
// Command 7: Create a frame with label
// ---------------------------------------------------------------------------

function handleCreateFrame(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const frameName = extractFrameName(msg) || 'Untitled Frame'
  const position = extractPosition(msg) || { x: 200, y: 100 }
  const input: Record<string, unknown> = {
    type: 'frame',
    x: position.x,
    y: position.y,
    width: 400,
    height: 300,
    fill: '#E8E8E8',
    text: frameName,
  }
  const result = executeCreateObject(input, objectsMap)
  return {
    message: `Created a frame called "${frameName}" at position (${position.x}, ${position.y}).`,
    actions: [{ tool: 'createObject', input, result }],
  }
}

// ---------------------------------------------------------------------------
// Command 8: Move objects by color to a direction
// ---------------------------------------------------------------------------

function handleMoveByColor(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const color = extractColor(msg)
  const direction = extractDirection(msg)
  if (!color || !direction) {
    return { message: "I couldn't determine the color or direction. Try 'Move all pink stickies to the right'.", actions: [] }
  }

  // Find all objects matching that color
  const matching: Array<{ id: string; x: number; y: number }> = []
  objectsMap.forEach((obj: any, id: string) => {
    if (obj.fill === color) {
      matching.push({ id, x: obj.x, y: obj.y })
    }
  })

  if (matching.length === 0) {
    const colorName = Object.entries(COLOR_MAP).find(([, v]) => v === color)?.[0] || color
    return { message: `I couldn't find any ${colorName} objects on the board.`, actions: [] }
  }

  const actions: ToolAction[] = []
  for (const obj of matching) {
    let newX = obj.x
    let newY = obj.y

    switch (direction) {
      case 'right': newX = 800; break
      case 'left': newX = 100; break
      case 'top': newY = 80; break
      case 'bottom': newY = 600; break
    }

    const input = { id: obj.id, x: newX, y: newY }
    const result = executeMoveObject(input, objectsMap)
    actions.push({ tool: 'moveObject', input, result })
  }

  const colorName = Object.entries(COLOR_MAP).find(([, v]) => v === color)?.[0] || color
  return {
    message: `Moved ${matching.length} ${colorName} object(s) to the ${direction}.`,
    actions,
  }
}

// ---------------------------------------------------------------------------
// Command 9: Resize frame to fit contents
// ---------------------------------------------------------------------------

function handleResizeFrame(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const lower = msg.toLowerCase()

  // Find the target frame
  let targetFrameId: string | null = null
  let _targetFrame: any = null

  objectsMap.forEach((obj: any, id: string) => {
    if (obj.type !== 'frame') return

    // Match by text content if mentioned
    if (obj.text && lower.includes(obj.text.toLowerCase())) {
      targetFrameId = id
      _targetFrame = obj
    }

    // Fallback: first frame found
    if (!targetFrameId) {
      targetFrameId = id
      _targetFrame = obj
    }
  })

  if (!targetFrameId || !_targetFrame) {
    return { message: "I couldn't find a frame on the board to resize. Create a frame first!", actions: [] }
  }

  // Find all non-frame objects that overlap with the frame
  const frameX = _targetFrame.x as number
  const frameY = _targetFrame.y as number
  const frameW = _targetFrame.width as number
  const frameH = _targetFrame.height as number

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasContents = false

  objectsMap.forEach((obj: any, id: string) => {
    if (id === targetFrameId || obj.type === 'frame') return

    const objX = obj.x as number
    const objY = obj.y as number
    const objW = (obj.width as number) || 200
    const objH = (obj.height as number) || 150

    // Check if the object is roughly inside (or near) the frame
    const isInside = objX >= frameX - 50 && objX <= frameX + frameW + 50 &&
                     objY >= frameY - 50 && objY <= frameY + frameH + 50

    if (isInside) {
      hasContents = true
      minX = Math.min(minX, objX)
      minY = Math.min(minY, objY)
      maxX = Math.max(maxX, objX + objW)
      maxY = Math.max(maxY, objY + objH)
    }
  })

  if (!hasContents) {
    return { message: `The frame "${_targetFrame.text || 'Untitled'}" appears to be empty. Nothing to resize to.`, actions: [] }
  }

  // Add padding
  const padding = 30
  const newWidth = (maxX - minX) + padding * 2
  const newHeight = (maxY - frameY) + padding + 60 // 60 for title bar

  const input = { id: targetFrameId, width: Math.max(newWidth, 200), height: Math.max(newHeight, 200) }
  const result = executeUpdateObject(input, objectsMap)

  return {
    message: `Resized the frame "${_targetFrame.text || 'Untitled'}" to fit its contents (${Math.round(newWidth)}x${Math.round(newHeight)}).`,
    actions: [{ tool: 'updateObject', input, result }],
  }
}

// ---------------------------------------------------------------------------
// Command 10: Space elements evenly
// ---------------------------------------------------------------------------

function handleSpaceEvenly(
  objectsMap: Y.Map<any>
): ParsedCommand {
  // Collect all non-frame objects
  const objects: Array<{ id: string; x: number; y: number; width: number; height: number }> = []
  objectsMap.forEach((obj: any, id: string) => {
    if (obj.type !== 'frame') {
      objects.push({ id, x: obj.x, y: obj.y, width: obj.width || 200, height: obj.height || 150 })
    }
  })

  if (objects.length < 2) {
    return { message: 'Need at least 2 objects on the board to space evenly. Create some objects first!', actions: [] }
  }

  // Sort by current x position
  objects.sort((a, b) => a.x - b.x)

  // Calculate even spacing across the horizontal range
  const startX = 100
  const endX = startX + (objects.length - 1) * (objects[0].width + 30)
  const spacing = (endX - startX) / (objects.length - 1)

  const actions: ToolAction[] = []
  // Keep the same y position for each object, just redistribute x
  const avgY = objects.reduce((sum, o) => sum + o.y, 0) / objects.length

  for (let i = 0; i < objects.length; i++) {
    const x = Math.round(startX + i * spacing)
    const y = Math.round(avgY)
    const input = { id: objects[i].id, x, y }
    const result = executeMoveObject(input, objectsMap)
    actions.push({ tool: 'moveObject', input, result })
  }

  return {
    message: `Spaced ${objects.length} elements evenly across the board.`,
    actions,
  }
}

// ---------------------------------------------------------------------------
// Command 11: SWOT analysis template
// ---------------------------------------------------------------------------

function handleSwotTemplate(
  objectsMap: Y.Map<any>
): ParsedCommand {
  const actions: ToolAction[] = []
  const gap = 20
  const frameWidth = 350
  const frameHeight = 350
  const stickyWidth = 200
  const stickyHeight = 150
  const startX = 50
  const startY = 50

  const quadrants = [
    { label: 'Strengths', color: '#98FB98', col: 0, row: 0 },
    { label: 'Weaknesses', color: '#FFB6C1', col: 1, row: 0 },
    { label: 'Opportunities', color: '#87CEEB', col: 0, row: 1 },
    { label: 'Threats', color: '#FFA07A', col: 1, row: 1 },
  ]

  for (const q of quadrants) {
    const frameX = startX + q.col * (frameWidth + gap)
    const frameY = startY + q.row * (frameHeight + gap)

    // Create frame
    const frameInput = { type: 'frame', x: frameX, y: frameY, width: frameWidth, height: frameHeight, text: q.label, fill: '#E8E8E8' }
    const frameResult = executeCreateObject(frameInput, objectsMap)
    actions.push({ tool: 'createObject', input: frameInput, result: frameResult })

    // Create 2 stickies inside
    for (let i = 0; i < 2; i++) {
      const stickyX = frameX + (frameWidth - stickyWidth) / 2
      const stickyY = frameY + 60 + i * (stickyHeight + gap)
      const stickyInput = { type: 'sticky', x: stickyX, y: stickyY, width: stickyWidth, height: stickyHeight, fill: q.color }
      const stickyResult = executeCreateObject(stickyInput, objectsMap)
      actions.push({ tool: 'createObject', input: stickyInput, result: stickyResult })
    }
  }

  return {
    message: 'Created a SWOT analysis template with four quadrants: Strengths (green), Weaknesses (pink), Opportunities (blue), and Threats (orange). Each has empty sticky notes ready to fill in.',
    actions,
  }
}

// ---------------------------------------------------------------------------
// Command 12: User journey map
// ---------------------------------------------------------------------------

function handleJourneyMap(
  msg: string,
  objectsMap: Y.Map<any>
): ParsedCommand {
  const stageCount = extractStageCount(msg)
  const actions: ToolAction[] = []
  const gap = 20
  const frameWidth = 220
  const frameHeight = 400
  const stickyWidth = 180
  const stickyHeight = 100
  const startX = 50
  const startY = 50

  const defaultStages = ['Awareness', 'Consideration', 'Decision', 'Onboarding', 'Retention', 'Advocacy']

  for (let i = 0; i < stageCount; i++) {
    const frameX = startX + i * (frameWidth + gap)
    const frameY = startY
    const label = defaultStages[i] || `Stage ${i + 1}`

    // Create frame for this stage
    const frameInput = { type: 'frame', x: frameX, y: frameY, width: frameWidth, height: frameHeight, text: label, fill: '#E8E8E8' }
    const frameResult = executeCreateObject(frameInput, objectsMap)
    actions.push({ tool: 'createObject', input: frameInput, result: frameResult })

    // Add a sticky note inside
    const stickyX = frameX + (frameWidth - stickyWidth) / 2
    const stickyY = frameY + 60
    const stickyInput = { type: 'sticky', x: stickyX, y: stickyY, width: stickyWidth, height: stickyHeight, fill: '#FFD700' }
    const stickyResult = executeCreateObject(stickyInput, objectsMap)
    actions.push({ tool: 'createObject', input: stickyInput, result: stickyResult })
  }

  return {
    message: `Created a user journey map with ${stageCount} stages: ${defaultStages.slice(0, stageCount).join(', ')}. Each stage has a frame with an empty sticky note for your touchpoints.`,
    actions,
  }
}

// ---------------------------------------------------------------------------
// Command 1 & 2: Create a generic object
// ---------------------------------------------------------------------------

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

  // Order matters — check most specific/complex patterns first

  // 12. User journey map
  if (isJourneyMapCommand(message)) {
    return handleJourneyMap(message, objectsMap)
  }

  // 11. SWOT analysis template
  if (isSwotCommand(message)) {
    return handleSwotTemplate(objectsMap)
  }

  // 6. Retrospective board
  if (isRetroCommand(message)) {
    return handleRetroBoard(objectsMap)
  }

  // 4. Create a grid of sticky notes
  if (isCreateGridCommand(message)) {
    return handleCreateGrid(message, objectsMap)
  }

  // 9. Resize frame to fit contents
  if (isResizeFrameCommand(message)) {
    return handleResizeFrame(message, objectsMap)
  }

  // 10. Space elements evenly
  if (isSpaceEvenlyCommand(message)) {
    return handleSpaceEvenly(objectsMap)
  }

  // 8. Move objects by color to a direction
  if (isMoveByColorCommand(message)) {
    return handleMoveByColor(message, objectsMap)
  }

  // 5. Arrange existing sticky notes in a grid
  if (isArrangeCommand(message)) {
    return handleArrangeGrid(objectsMap)
  }

  // 3. Change object color (must come before generic create to avoid "make" false positives)
  if (isUpdateColorCommand(message)) {
    return handleUpdateColor(message, objectsMap)
  }

  // 7. Create a frame with label
  if (isCreateFrameCommand(message)) {
    return handleCreateFrame(message, objectsMap)
  }

  // 1 & 2. Create an object (sticky note, rectangle, circle, etc.)
  if (isCreateCommand(message)) {
    return handleCreateObject(message, objectsMap)
  }

  // Unrecognized command
  return {
    message: "I'm not sure what you'd like me to do. Try commands like:\n• \"Add a yellow sticky note that says Hello\"\n• \"Create a blue rectangle at position 100, 200\"\n• \"Add a frame called 'Sprint Planning'\"\n• \"Move all pink stickies to the right\"\n• \"Resize the frame to fit its contents\"\n• \"Space these elements evenly\"\n• \"Create a 2x3 grid of sticky notes\"\n• \"Arrange the sticky notes in a grid\"\n• \"Set up a retrospective board\"\n• \"Create a SWOT analysis template\"\n• \"Build a user journey map with 5 stages\"",
    actions: [],
  }
}
