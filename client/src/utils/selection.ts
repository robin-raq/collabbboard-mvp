/**
 * Selection utilities for multi-select operations.
 */

import type { BoardObject } from '../types'

export interface SelectionRect {
  x: number
  y: number
  w: number
  h: number
}

/** Check if a board object's bounding box intersects with a selection rectangle. */
export function intersects(obj: BoardObject, rect: SelectionRect): boolean {
  return (
    obj.x < rect.x + rect.w &&
    obj.x + obj.width > rect.x &&
    obj.y < rect.y + rect.h &&
    obj.y + obj.height > rect.y
  )
}

/** Normalize a selection rect (handle negative width/height from right-to-left drag). */
export function normalizeRect(
  startX: number, startY: number,
  endX: number, endY: number,
): SelectionRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.abs(endY - startY),
  }
}

/** Calculate bounding box around multiple objects. */
export function getSelectionBounds(objects: BoardObject[]): SelectionRect | null {
  if (objects.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const obj of objects) {
    minX = Math.min(minX, obj.x)
    minY = Math.min(minY, obj.y)
    maxX = Math.max(maxX, obj.x + obj.width)
    maxY = Math.max(maxY, obj.y + obj.height)
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
