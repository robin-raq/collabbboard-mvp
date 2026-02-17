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

  const saveEdit = () => {
    console.log('Saving edit:', editText)
    onUpdate({ text: editText })
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setEditText(object.text ?? '')
    setIsEditing(false)
  }

  // Only render the Konva group, not the textarea
  // The textarea is handled by useEffect to avoid Konva issues
  useEffect(() => {
    if (isEditing) {
      // Create a container for the edit modal
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '0'
      container.style.left = '0'
      container.style.right = '0'
      container.style.bottom = '0'
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.justifyContent = 'center'
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'
      container.style.zIndex = '1000'

      // Create textarea
      const textarea = document.createElement('textarea')
      textarea.value = editText
      textarea.placeholder = 'Type your note here... (Ctrl+Enter to save, Escape to cancel)'
      textarea.style.width = '400px'
      textarea.style.height = '300px'
      textarea.style.padding = '16px'
      textarea.style.fontSize = '14px'
      textarea.style.fontFamily = 'system-ui, sans-serif'
      textarea.style.border = '2px solid #2563EB'
      textarea.style.borderRadius = '8px'
      textarea.style.boxSizing = 'border-box'
      textarea.style.resize = 'none'
      textarea.style.outline = 'none'
      textarea.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)'

      // Handle events
      const handleChange = (e: Event) => {
        const target = e.target as HTMLTextAreaElement
        setEditText(target.value)
        console.log('Text changed:', target.value)
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          saveEdit()
        } else if (e.key === 'Escape') {
          cancelEdit()
        }
      }

      const handleClick = (e: MouseEvent) => {
        if (e.target === container) {
          saveEdit()
        }
      }

      const handleTextareaClick = (e: MouseEvent) => {
        e.stopPropagation()
      }

      textarea.addEventListener('change', handleChange)
      textarea.addEventListener('input', handleChange)
      textarea.addEventListener('keydown', handleKeyDown)
      textarea.addEventListener('click', handleTextareaClick)
      container.addEventListener('click', handleClick)

      container.appendChild(textarea)
      document.body.appendChild(container)

      // Focus textarea
      textarea.focus()

      // Cleanup
      return () => {
        textarea.removeEventListener('change', handleChange)
        textarea.removeEventListener('input', handleChange)
        textarea.removeEventListener('keydown', handleKeyDown)
        textarea.removeEventListener('click', handleTextareaClick)
        container.removeEventListener('click', handleClick)
        document.body.removeChild(container)
      }
    }
  }, [isEditing, editText])

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
