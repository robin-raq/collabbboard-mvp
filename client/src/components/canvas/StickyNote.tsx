import { useRef, useState, useEffect } from 'react'
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
  const textRef = useRef<Konva.Text>(null)
  const { selectedIds, setSelectedIds } = useUiStore()
  const isSelected = selectedIds.has(object.id)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(object.text ?? '')

  useEffect(() => {
    // Update editing text when object text changes from external sources
    if (!isEditing) {
      setEditText(object.text ?? '')
    }
  }, [object.text, isEditing])

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

  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    setIsEditing(true)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value)
  }

  const saveEdit = () => {
    onUpdate({ text: editText })
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setEditText(object.text ?? '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  if (isEditing) {
    return (
      <div
        style={{
          position: 'fixed',
          left: groupRef.current?.getAbsolutePosition().x ?? 0,
          top: groupRef.current?.getAbsolutePosition().y ?? 0,
          width: (object.width ?? 200),
          height: (object.height ?? 200),
          zIndex: 1000,
        }}
      >
        <textarea
          autoFocus
          value={editText}
          onChange={handleEditChange}
          onKeyDown={handleKeyDown}
          onBlur={saveEdit}
          style={{
            width: '100%',
            height: '100%',
            padding: '12px',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            border: '2px solid #2563EB',
            borderRadius: '4px',
            boxSizing: 'border-box',
            resize: 'none',
          }}
        />
      </div>
    )
  }

  return (
    <Group
      ref={groupRef}
      x={object.x}
      y={object.y}
      draggable={!isEditing}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
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
        ref={textRef}
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
