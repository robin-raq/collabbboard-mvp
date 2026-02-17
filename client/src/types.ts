export type BoardObject = {
  id: string
  type: 'sticky' | 'rect'
  x: number
  y: number
  width: number
  height: number
  text?: string
  fill: string
}
