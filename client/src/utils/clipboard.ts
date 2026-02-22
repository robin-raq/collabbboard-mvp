/**
 * Clipboard utilities for copy/paste operations.
 *
 * Pure functions — no React, no side effects.
 * Used by Board.tsx keyboard handler for Ctrl+C / Ctrl+V.
 */

import type { BoardObject } from '../types'

/**
 * State held by the clipboard ref in Board.tsx.
 * Stores copied objects (snapshots) and tracks paste count for offset stacking.
 */
export interface ClipboardState {
  /** Copied objects, stored with their original positions from copy-time. */
  objects: BoardObject[]
  /** Number of times paste has been invoked since last copy. Starts at 0. */
  pasteCount: number
}

/** Fixed pixel offset per paste operation (matches Ctrl+D duplicate offset). */
export const PASTE_OFFSET = 20

/**
 * Copy: snapshot the selected objects into a ClipboardState.
 * Returns null if no objects match the selected IDs.
 */
export function copyObjects(
  allObjects: BoardObject[],
  selectedIds: Set<string>,
): ClipboardState | null {
  if (selectedIds.size === 0) return null

  const copied = allObjects.filter((o) => selectedIds.has(o.id))
  if (copied.length === 0) return null

  // Deep-clone via spread so mutations to board state don't affect clipboard
  return {
    objects: copied.map((o) => ({ ...o })),
    pasteCount: 0,
  }
}

/**
 * Paste: produce new BoardObject[] from the clipboard with fresh IDs
 * and stacked offset.
 *
 * @param clipboard - The current clipboard state
 * @param idGenerator - Function to generate unique IDs (injectable for testing)
 * @returns New objects and the updated paste count
 */
export function pasteObjects(
  clipboard: ClipboardState,
  idGenerator: () => string = () => crypto.randomUUID(),
): { objects: BoardObject[]; newPasteCount: number } {
  const offset = (clipboard.pasteCount + 1) * PASTE_OFFSET

  const newObjects = clipboard.objects.map((src) => ({
    ...src,
    id: idGenerator(),
    x: src.x + offset,
    y: src.y + offset,
  }))

  return {
    objects: newObjects,
    newPasteCount: clipboard.pasteCount + 1,
  }
}
