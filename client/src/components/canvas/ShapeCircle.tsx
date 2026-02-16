import { Circle } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'

interface ShapeCircleProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export function ShapeCircle({ object, onUpdate }: ShapeCircleProps) {
  const { selectedIds, setSelectedIds } = useUiStore()
  const isSelected = selectedIds.has(object.id)
  const radius = (object.width ?? 100) / 2

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate({ x: e.target.x(), y: e.target.y() })
  }

  return (
    <Circle
      x={object.x + radius}
      y={object.y + radius}
      radius={radius}
      fill={object.fill ?? '#10B981'}
      stroke={isSelected ? '#2563EB' : object.stroke ?? '#1E293B'}
      strokeWidth={isSelected ? 2 : object.strokeWidth ?? 1}
      draggable
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.cancelBubble = true
        setSelectedIds(new Set([object.id]))
      }}
    />
  )
}
