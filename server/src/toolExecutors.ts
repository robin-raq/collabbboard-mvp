/**
 * Tool Executors for CollabBoard AI Agent
 *
 * Pure functions that execute AI tool calls against a Y.Doc objects map.
 * Extracted into a separate module to avoid circular dependencies between
 * aiHandler.ts and commandCache.ts.
 *
 * Both modules import from here:
 *  - aiHandler.ts uses these for Claude API tool calls
 *  - commandCache.ts uses these for cached recipe replay
 */

import * as Y from 'yjs'
import type { ObjectType, BoardObject } from '../../shared/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const defaultSizes: Record<string, { width: number; height: number }> = {
  sticky: { width: 200, height: 150 },
  rect: { width: 150, height: 100 },
  circle: { width: 100, height: 100 },
  text: { width: 200, height: 50 },
  frame: { width: 400, height: 300 },
  line: { width: 2, height: 2 },
}

export const defaultColors: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tool Executors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Board Snapshot for System Prompt
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

/**
 * Execute a tool by name. Dispatches to the appropriate executor.
 */
export function executeTool(
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
      return buildBoardContext(objectsMap)
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` })
  }
}
