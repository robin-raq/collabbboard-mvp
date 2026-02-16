import { Line } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'

interface BoardLineProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export function BoardLine({ object, onUpdate }: BoardLineProps) {
  const { selectedIds, setSelectedIds } = useUiStore()
  const isSelected = selectedIds.has(object.id)

  return (
    <Line
      x={object.x}
      y={object.y}
      points={object.points ?? [0, 0, 100, 100]}
      stroke={isSelected ? '#2563EB' : object.stroke ?? '#1E293B'}
      strokeWidth={isSelected ? 3 : object.strokeWidth ?? 2}
      lineCap="round"
      lineJoin="round"
      draggable
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        onUpdate({ x: e.target.x(), y: e.target.y() })
      }}
      onClick={(e) => {
        e.cancelBubble = true
        setSelectedIds(new Set([object.id]))
      }}
    />
  )
}
