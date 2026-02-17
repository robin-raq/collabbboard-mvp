import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'

interface Props {
  obj: BoardObject
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
}

export default function Rectangle({ obj, onUpdate }: Props) {
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const pos = { x: e.target.x(), y: e.target.y() }
    console.log('[DRAG RECT]', obj.id, pos)
    onUpdate(obj.id, pos)
  }

  return (
    <Rect
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      fill={obj.fill}
      stroke="#1E293B"
      strokeWidth={1}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}
