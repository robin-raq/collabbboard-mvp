/**
 * Viewport Culling — determines which objects are visible on screen.
 *
 * Instead of rendering all 500+ objects every frame, we calculate the
 * visible area (based on pan position, zoom level, and window size)
 * and only render objects that overlap with it.
 *
 * This reduces React component mounts and Konva draw calls from N to
 * roughly ~30 visible objects, keeping 60 FPS even at high object counts.
 */

import type { BoardObject } from '../types'

export interface Viewport {
  stageX: number   // Stage pan offset X (pixels)
  stageY: number   // Stage pan offset Y (pixels)
  scale: number    // Zoom level (1 = 100%)
  width: number    // Window width (pixels)
  height: number   // Window height (pixels)
}

/**
 * Calculate the visible area in board (world) coordinates.
 *
 * The viewport is defined by stagePos, scale, and window dimensions.
 * We convert screen-space bounds to world-space bounds by dividing
 * by scale and offsetting by the inverse of stagePos.
 */
export function getVisibleBounds(viewport: Viewport) {
  const { stageX, stageY, scale, width, height } = viewport
  return {
    left: -stageX / scale,
    top: -stageY / scale,
    right: (-stageX + width) / scale,
    bottom: (-stageY + height) / scale,
  }
}

/**
 * Check if a single object overlaps the visible area.
 *
 * Uses axis-aligned bounding box (AABB) intersection test:
 * two rectangles overlap if and only if they overlap on BOTH axes.
 *
 * @param padding  Extra pixels (in world coords) around viewport to
 *                 prevent objects from popping in/out at edges
 */
export function isObjectVisible(
  obj: BoardObject,
  viewport: Viewport,
  padding = 50,
): boolean {
  const bounds = getVisibleBounds(viewport)

  return (
    obj.x + obj.width > bounds.left - padding &&
    obj.x < bounds.right + padding &&
    obj.y + obj.height > bounds.top - padding &&
    obj.y < bounds.bottom + padding
  )
}

/**
 * Filter an array of objects to only those visible in the viewport.
 *
 * @param objects   All board objects
 * @param viewport  Current viewport state
 * @param padding   Extra padding around viewport bounds (world coords)
 * @returns         Only the objects that overlap the visible area
 */
export function cullObjects(
  objects: BoardObject[],
  viewport: Viewport,
  padding = 50,
): BoardObject[] {
  return objects.filter((obj) => isObjectVisible(obj, viewport, padding))
}
