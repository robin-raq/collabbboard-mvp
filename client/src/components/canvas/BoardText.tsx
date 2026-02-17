import { Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'

interface BoardTextProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export function BoardText({ object, onUpdate }: BoardTextProps) {
  const { setSelectedIds } = useUiStore()

  return (
    <Text
      x={object.x}
      y={object.y}
      text={object.text ?? 'Text'}
      fontSize={object.fontSize ?? 18}
      fontFamily="system-ui, sans-serif"
      fill={object.fill ?? '#1E293B'}
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
