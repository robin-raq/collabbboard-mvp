import { useState, useEffect, memo } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'

interface Props {
  obj: BoardObject
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  stagePos: { x: number; y: number }
}

/**
 * StickyNote — draggable sticky with inline text editing.
 *
 * Double-click to edit: a textarea appears directly on top of the sticky
 * matching its position, size, font, and background color. This gives the
 * illusion of typing directly on the note.
 *
 * - Enter = save
 * - Shift+Enter = newline
 * - Esc = cancel
 * - Click outside = save
 */
const StickyNote = memo(function StickyNote({ obj, onUpdate, stageRef, scale, stagePos }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(obj.text ?? '')

  useEffect(() => {
    if (!isEditing) setEditText(obj.text ?? '')
  }, [obj.text, isEditing])

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const pos = { x: e.target.x(), y: e.target.y() }
    onUpdate(obj.id, pos)
  }

  const handleDblClick = () => {
    setIsEditing(true)
  }

  // Inline textarea overlay — positioned directly on top of the sticky
  useEffect(() => {
    if (!isEditing) return
    const stage = stageRef.current
    if (!stage) return

    // Calculate screen position of the sticky note
    const screenX = obj.x * scale + stagePos.x
    const screenY = obj.y * scale + stagePos.y
    const screenW = obj.width * scale
    const screenH = obj.height * scale

    // Get stage container position on screen
    const container = stage.container()
    const rect = container.getBoundingClientRect()

    const textarea = document.createElement('textarea')
    textarea.value = editText
    textarea.style.cssText = [
      `position: fixed`,
      `left: ${rect.left + screenX}px`,
      `top: ${rect.top + screenY}px`,
      `width: ${screenW}px`,
      `height: ${screenH}px`,
      `padding: ${10 * scale}px`,
      `font-size: ${14 * scale}px`,
      `font-family: system-ui, sans-serif`,
      `color: #1E293B`,
      `background: ${obj.fill}`,
      `border: 2px solid #2563EB`,
      `border-radius: ${4 * scale}px`,
      `resize: none`,
      `outline: none`,
      `box-sizing: border-box`,
      `z-index: 1000`,
      `line-height: 1.4`,
      `overflow: hidden`,
    ].join(';')

    let currentText = editText

    const save = () => {
      onUpdate(obj.id, { text: currentText })
      cleanup()
    }

    const cancel = () => {
      cleanup()
    }

    const cleanup = () => {
      setIsEditing(false)
    }

    textarea.addEventListener('input', (e) => {
      currentText = (e.target as HTMLTextAreaElement).value
      setEditText(currentText)
    })

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        cancel()
      }
    })

    textarea.addEventListener('blur', () => {
      save()
    })

    document.body.appendChild(textarea)
    textarea.focus()
    // Move cursor to end of text
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    return () => {
      if (document.body.contains(textarea)) {
        document.body.removeChild(textarea)
      }
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
        listening={false}
      />
    </Group>
  )
})

export default StickyNote
