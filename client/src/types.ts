/** Supported shape types on the board. */
export type ObjectType = 'sticky' | 'rect' | 'circle' | 'text' | 'frame' | 'line'

/** A single object on the collaborative board. */
export type BoardObject = {
  id: string
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  text?: string      // Used by sticky, text, and frame (label)
  fill: string       // CSS color string
  fontSize?: number  // Used by text objects (default 14)
  // Line/connector fields
  points?: number[]  // [x1, y1, x2, y2] relative to (x, y) — used by line type
  fromId?: string    // Object ID this line starts from (connector)
  toId?: string      // Object ID this line ends at (connector)
  arrowEnd?: boolean // Show arrowhead at end (default true for lines)
}

/** Active tool selected in the toolbar. */
export type ToolType = 'select' | 'sticky' | 'rect' | 'circle' | 'text' | 'frame' | 'line' | 'arrow'
