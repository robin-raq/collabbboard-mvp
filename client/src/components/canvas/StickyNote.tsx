import { useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'

interface StickyNoteProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export function StickyNote({ object, onUpdate }: StickyNoteProps) {
  const groupRef = useRef<Konva.Group>(null)
  const { selectedIds, setSelectedIds } = useUiStore()
  const isSelected = selectedIds.has(object.id)

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate({ x: e.target.x(), y: e.target.y() })
  }

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (e.evt.shiftKey) {
      const next = new Set(selectedIds)
      if (next.has(object.id)) {
        next.delete(object.id)
      } else {
        next.add(object.id)
      }
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set([object.id]))
    }
  }

  return (
    <Group
      ref={groupRef}
      x={object.x}
      y={object.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {/* Shadow */}
      <Rect
        x={3}
        y={3}
        width={object.width ?? 200}
        height={object.height ?? 200}
        fill="rgba(0,0,0,0.1)"
        cornerRadius={4}
      />
      {/* Card */}
      <Rect
        width={object.width ?? 200}
        height={object.height ?? 200}
        fill={object.fill ?? '#FBBF24'}
        cornerRadius={4}
        stroke={isSelected ? '#2563EB' : '#00000020'}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* Text */}
      <Text
        x={12}
        y={12}
        width={(object.width ?? 200) - 24}
        height={(object.height ?? 200) - 24}
        text={object.text ?? ''}
        fontSize={14}
        fontFamily="system-ui, sans-serif"
        fill="#1E293B"
        wrap="word"
      />
    </Group>
  )
}
