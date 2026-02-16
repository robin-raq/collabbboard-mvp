import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'

interface ShapeRectProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export function ShapeRect({ object, onUpdate }: ShapeRectProps) {
  const { selectedIds, setSelectedIds } = useUiStore()
  const isSelected = selectedIds.has(object.id)

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate({ x: e.target.x(), y: e.target.y() })
  }

  return (
    <Rect
      x={object.x}
      y={object.y}
      width={object.width ?? 150}
      height={object.height ?? 100}
      fill={object.fill ?? '#3B82F6'}
      stroke={isSelected ? '#2563EB' : object.stroke ?? '#1E293B'}
      strokeWidth={isSelected ? 2 : object.strokeWidth ?? 1}
      cornerRadius={4}
      draggable
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.cancelBubble = true
        setSelectedIds(new Set([object.id]))
      }}
    />
  )
}
