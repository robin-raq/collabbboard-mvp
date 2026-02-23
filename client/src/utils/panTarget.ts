/**
 * Extract the center point of all AI-created/moved objects from an AI response's actions.
 * Used to auto-pan the viewport to where the AI made changes.
 */

interface ActionLike {
  tool: string
  input: Record<string, unknown>
  result: string
}

/** Default object dimensions when width/height not provided in the action */
const DEFAULT_WIDTH = 100
const DEFAULT_HEIGHT = 75

/**
 * Given an array of AI tool actions, compute the centroid of all objects
 * that have position data (x, y). Returns null if no actions have positions.
 */
export function extractPanTarget(actions: ActionLike[]): { x: number; y: number } | null {
  const positions = actions
    .filter((a) => a.input?.x != null && a.input?.y != null)
    .map((a) => ({
      x: Number(a.input.x) + (Number(a.input.width) || DEFAULT_WIDTH) / 2,
      y: Number(a.input.y) + (Number(a.input.height) || DEFAULT_HEIGHT) / 2,
    }))

  if (positions.length === 0) return null

  return {
    x: positions.reduce((s, p) => s + p.x, 0) / positions.length,
    y: positions.reduce((s, p) => s + p.y, 0) / positions.length,
  }
}
