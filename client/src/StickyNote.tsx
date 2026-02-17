import { useState, useEffect } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'

interface Props {
  obj: BoardObject
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
}

export default function StickyNote({ obj, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(obj.text ?? '')

  useEffect(() => {
    if (!isEditing) setEditText(obj.text ?? '')
  }, [obj.text, isEditing])

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const pos = { x: e.target.x(), y: e.target.y() }
    console.log('[DRAG STICKY]', obj.id, pos)
    onUpdate(obj.id, pos)
  }

  const handleDblClick = () => {
    console.log('[EDIT START]', obj.id)
    setIsEditing(true)
  }

  // Textarea overlay for editing
  useEffect(() => {
    if (!isEditing) return

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);z-index:1000'

    const textarea = document.createElement('textarea')
    textarea.value = editText
    textarea.placeholder = 'Type here... (Ctrl+Enter to save, Esc to cancel)'
    textarea.style.cssText = 'width:300px;height:200px;padding:16px;font-size:14px;font-family:system-ui;border:2px solid #2563EB;border-radius:8px;resize:none;outline:none;box-shadow:0 10px 40px rgba(0,0,0,0.3)'

    let currentText = editText

    const save = () => {
      console.log('[EDIT SAVE]', obj.id, currentText)
      onUpdate(obj.id, { text: currentText })
      setIsEditing(false)
    }

    textarea.addEventListener('input', (e) => {
      currentText = (e.target as HTMLTextAreaElement).value
      setEditText(currentText)
    })

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) save()
      else if (e.key === 'Escape') setIsEditing(false)
    })

    container.addEventListener('click', (e) => {
      if (e.target === container) save()
    })

    container.appendChild(textarea)
    document.body.appendChild(container)
    textarea.focus()

    return () => {
      document.body.removeChild(container)
    }
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Group
      x={obj.x}
      y={obj.y}
      draggable
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill={obj.fill}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={6}
        shadowOffsetY={2}
      />
      <Text
        text={obj.text ?? ''}
        width={obj.width}
        height={obj.height}
        padding={10}
        fontSize={14}
        fontFamily="system-ui, sans-serif"
        fill="#1E293B"
        wrap="word"
      />
    </Group>
  )
}
