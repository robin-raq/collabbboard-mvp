/**
 * Shared constants for the CollabBoard client.
 *
 * Centralizes magic values that were previously scattered across Board.tsx,
 * useYjs.ts, and ChatPanel.tsx. Change them here, change them everywhere.
 */

// ---------------------------------------------------------------------------
// User Presence Colors (assigned to users based on name hash)
// ---------------------------------------------------------------------------

export const USER_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
]

// ---------------------------------------------------------------------------
// Shape Fill Colors (color picker palette)
// ---------------------------------------------------------------------------

export const SHAPE_COLORS = [
  '#FFEB3B', '#FFA726', '#EF5350', '#AB47BC',
  '#42A5F5', '#26C6DA', '#66BB6A', '#8D6E63',
  '#78909C', '#FFFFFF',
]

// ---------------------------------------------------------------------------
// Zoom & Pan
// ---------------------------------------------------------------------------

export const ZOOM_SCALE_FACTOR = 1.08
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 5
export const ZOOM_STEP = 1.2 // For zoom button clicks (coarser than scroll)

// ---------------------------------------------------------------------------
// Grid Background
// ---------------------------------------------------------------------------

export const GRID_SIZE = 20

// ---------------------------------------------------------------------------
// Render Budget — max Konva shapes drawn per frame
// ---------------------------------------------------------------------------

/** Maximum objects rendered when zoomed out. Keeps frame time <50ms.
 *  Objects beyond this cap are culled; closest to viewport center kept. */
export const MAX_RENDERED_OBJECTS = 150

// ---------------------------------------------------------------------------
// Shape Defaults (used when clicking canvas to create a shape)
// ---------------------------------------------------------------------------

export const SHAPE_DEFAULTS: Record<string, { width: number; height: number; fill: string; text?: string; fontSize?: number }> = {
  sticky: { width: 150, height: 150, fill: '#FFEB3B', text: 'New note' },
  rect:   { width: 120, height: 80,  fill: '#42A5F5' },
  circle: { width: 100, height: 100, fill: '#66BB6A' },
  text:   { width: 200, height: 40,  fill: 'transparent', text: 'Text', fontSize: 18 },
  frame:  { width: 300, height: 200, fill: 'transparent', text: 'Frame' },
}

// ---------------------------------------------------------------------------
// Line / Connector Defaults
// ---------------------------------------------------------------------------

export const LINE_COLOR = '#374151'

// ---------------------------------------------------------------------------
// Production Server URL
// ---------------------------------------------------------------------------

export const PRODUCTION_HOST = 'raqdrobinson.com'

// ---------------------------------------------------------------------------
// WebSocket Protocol (re-exported from shared)
// ---------------------------------------------------------------------------

export { MSG_YJS, MSG_AWARENESS, DEFAULT_BOARD_ID } from '../../shared/constants'
