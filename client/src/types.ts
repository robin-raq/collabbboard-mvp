/** Supported shape types on the board. */
export type ObjectType = 'sticky' | 'rect' | 'circle' | 'text' | 'frame'

/** A single object on the collaborative board. */
export type BoardObject = {
  id: string
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  text?: string   // Used by sticky, text, and frame (label)
  fill: string    // CSS color string
  fontSize?: number // Used by text objects (default 14)
}

/** Active tool selected in the toolbar. */
export type ToolType = 'select' | 'sticky' | 'rect' | 'circle' | 'text' | 'frame'
