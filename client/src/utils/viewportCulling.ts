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
 * When `maxRendered` > 0 and the visible count exceeds the budget,
 * objects are sorted by distance to viewport center and only the
 * closest `maxRendered` are returned. This keeps Konva draw calls
 * bounded even when zoomed out to see all 500+ objects.
 *
 * Selected objects are always included regardless of budget — they
 * must remain visible so the user can interact with their selection.
 *
 * @param objects       All board objects
 * @param viewport      Current viewport state
 * @param padding       Extra padding around viewport bounds (world coords)
 * @param maxRendered   Maximum objects to render (0 = unlimited)
 * @param selectedIds   IDs of selected objects (always included)
 * @returns             Only the objects that overlap the visible area (capped)
 */
export function cullObjects(
  objects: BoardObject[],
  viewport: Viewport,
  padding = 50,
  maxRendered = 0,
  selectedIds?: Set<string>,
): BoardObject[] {
  const visible = objects.filter((obj) => isObjectVisible(obj, viewport, padding))

  // No budget or within budget — return as-is
  if (maxRendered <= 0 || visible.length <= maxRendered) return visible

  // Compute viewport center in world coordinates
  const bounds = getVisibleBounds(viewport)
  const cx = (bounds.left + bounds.right) / 2
  const cy = (bounds.top + bounds.bottom) / 2

  // Partition: selected objects are always included
  const selected: BoardObject[] = []
  const unselected: BoardObject[] = []
  for (const obj of visible) {
    if (selectedIds && selectedIds.has(obj.id)) {
      selected.push(obj)
    } else {
      unselected.push(obj)
    }
  }

  // Budget remaining after reserving slots for selected objects
  const remaining = Math.max(0, maxRendered - selected.length)

  // Sort unselected by squared distance to viewport center (closest first)
  unselected.sort((a, b) => {
    const aCx = a.x + a.width / 2
    const aCy = a.y + a.height / 2
    const bCx = b.x + b.width / 2
    const bCy = b.y + b.height / 2
    const aDist = (aCx - cx) ** 2 + (aCy - cy) ** 2
    const bDist = (bCx - cx) ** 2 + (bCy - cy) ** 2
    return aDist - bDist
  })

  return [...selected, ...unselected.slice(0, remaining)]
}
