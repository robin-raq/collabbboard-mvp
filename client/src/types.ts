/** A single object on the collaborative board. */
export type BoardObject = {
  id: string
  type: 'sticky' | 'rect'
  x: number
  y: number
  width: number
  height: number
  text?: string // Only used by sticky notes
  fill: string  // CSS color string
}
