import { useState, useEffect, useCallback, memo } from 'react'
import { Group, Rect, Text, Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'

const HANDLE_SIZE = 8
const MIN_SIZE = 30

interface Props {
  obj: BoardObject
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  stagePos: { x: number; y: number }
}

/**
 * BoardShape — unified editable shape component for all object types.
 *
 * Supports: sticky, rect, circle, text, frame
 * Features:
 *  - Drag to move
 *  - Click to select (shows blue border + resize handles)
 *  - Drag corner handles to resize
 *  - Double-click to edit text (textarea overlay)
 *  - Enter = save, Shift+Enter = newline, Esc = cancel, blur = save
 */
const BoardShape = memo(function BoardShape({
  obj, isSelected, onSelect, onUpdate, stageRef, scale, stagePos,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(obj.text ?? '')

  useEffect(() => {
    if (!isEditing) setEditText(obj.text ?? '')
  }, [obj.text, isEditing])

  // ---- Drag ---------------------------------------------------------------
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Get the Group's position (it's the drag target)
    const node = e.target
    onUpdate(obj.id, { x: node.x(), y: node.y() })
  }, [obj.id, onUpdate])

  // ---- Select -------------------------------------------------------------
  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    onSelect(obj.id)
  }, [obj.id, onSelect])

  // ---- Double-click to edit text ------------------------------------------
  const handleDblClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  // ---- Inline textarea overlay --------------------------------------------
  useEffect(() => {
    if (!isEditing) return
    const stage = stageRef.current
    if (!stage) return

    const screenX = obj.x * scale + stagePos.x
    const screenY = obj.y * scale + stagePos.y
    const screenW = obj.width * scale
    const screenH = obj.height * scale

    const container = stage.container()
    const rect = container.getBoundingClientRect()

    // For sticky notes, match the fill. For other shapes, use transparent bg over the shape.
    const bgColor = obj.type === 'sticky' ? obj.fill : 'rgba(255,255,255,0.95)'

    const textarea = document.createElement('textarea')
    textarea.value = editText
    textarea.style.cssText = [
      `position: fixed`,
      `left: ${rect.left + screenX}px`,
      `top: ${rect.top + screenY}px`,
      `width: ${screenW}px`,
      `height: ${screenH}px`,
      `padding: ${10 * scale}px`,
      `font-size: ${(obj.fontSize ?? 14) * scale}px`,
      `font-family: system-ui, sans-serif`,
      `color: #1E293B`,
      `background: ${bgColor}`,
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

    const cancel = () => cleanup()

    const cleanup = () => setIsEditing(false)

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

    textarea.addEventListener('blur', () => save())

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    return () => {
      if (document.body.contains(textarea)) {
        document.body.removeChild(textarea)
      }
    }
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Resize handles -----------------------------------------------------
  const handleResize = useCallback(
    (corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const node = e.target
      const dx = node.x()
      const dy = node.y()

      let newX = obj.x
      let newY = obj.y
      let newW = obj.width
      let newH = obj.height

      if (corner.includes('r')) {
        newW = Math.max(MIN_SIZE, obj.width + dx)
      }
      if (corner.includes('b')) {
        newH = Math.max(MIN_SIZE, obj.height + dy)
      }
      if (corner.includes('l')) {
        const delta = Math.min(dx, obj.width - MIN_SIZE)
        newX = obj.x + delta
        newW = obj.width - delta
      }
      if (corner.includes('t')) {
        const delta = Math.min(dy, obj.height - MIN_SIZE)
        newY = obj.y + delta
        newH = obj.height - delta
      }

      // Reset handle position (it moved relative to group during drag)
      node.position({ x: 0, y: 0 })

      onUpdate(obj.id, { x: newX, y: newY, width: newW, height: newH })
    },
    [obj.id, obj.x, obj.y, obj.width, obj.height, onUpdate],
  )

  // ---- Render shape body --------------------------------------------------
  const renderBody = () => {
    switch (obj.type) {
      case 'sticky':
        return (
          <>
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
              fontSize={obj.fontSize ?? 14}
              fontFamily="system-ui, sans-serif"
              fill="#1E293B"
              wrap="word"
              listening={false}
            />
          </>
        )

      case 'rect':
        return (
          <>
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.fill}
              stroke="#1E293B"
              strokeWidth={1}
              cornerRadius={2}
            />
            {obj.text && (
              <Text
                text={obj.text}
                width={obj.width}
                height={obj.height}
                padding={8}
                fontSize={obj.fontSize ?? 14}
                fontFamily="system-ui, sans-serif"
                fill="#1E293B"
                wrap="word"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            )}
          </>
        )

      case 'circle':
        return (
          <>
            <Ellipse
              x={obj.width / 2}
              y={obj.height / 2}
              radiusX={obj.width / 2}
              radiusY={obj.height / 2}
              fill={obj.fill}
              stroke="#1E293B"
              strokeWidth={1}
            />
            {obj.text && (
              <Text
                text={obj.text}
                width={obj.width}
                height={obj.height}
                padding={8}
                fontSize={obj.fontSize ?? 14}
                fontFamily="system-ui, sans-serif"
                fill="#1E293B"
                wrap="word"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            )}
          </>
        )

      case 'text':
        return (
          <Text
            text={obj.text || 'Text'}
            width={obj.width}
            height={obj.height}
            fontSize={obj.fontSize ?? 18}
            fontFamily="system-ui, sans-serif"
            fill={obj.fill === 'transparent' ? '#1E293B' : obj.fill}
            wrap="word"
            padding={4}
          />
        )

      case 'frame':
        return (
          <>
            <Rect
              width={obj.width}
              height={obj.height}
              fill="transparent"
              stroke="#94A3B8"
              strokeWidth={2}
              dash={[8, 4]}
              cornerRadius={8}
            />
            {/* Frame label at top */}
            <Text
              text={obj.text || 'Frame'}
              x={8}
              y={-20}
              fontSize={12}
              fontFamily="system-ui, sans-serif"
              fill="#64748B"
              listening={false}
            />
          </>
        )

      default:
        return null
    }
  }

  // ---- Selection border + resize handles ----------------------------------
  const renderSelection = () => {
    if (!isSelected) return null

    const hs = HANDLE_SIZE / scale // Scale-independent handle size
    const handles = [
      { key: 'tl', x: 0, y: 0, cursor: 'nwse-resize' },
      { key: 'tr', x: obj.width, y: 0, cursor: 'nesw-resize' },
      { key: 'bl', x: 0, y: obj.height, cursor: 'nesw-resize' },
      { key: 'br', x: obj.width, y: obj.height, cursor: 'nwse-resize' },
    ]

    return (
      <>
        {/* Selection border */}
        <Rect
          width={obj.width}
          height={obj.height}
          stroke="#2563EB"
          strokeWidth={2 / scale}
          fill="transparent"
          listening={false}
          dash={[6 / scale, 3 / scale]}
        />
        {/* Resize handles */}
        {handles.map((h) => (
          <Rect
            key={h.key}
            x={h.x - hs / 2}
            y={h.y - hs / 2}
            width={hs}
            height={hs}
            fill="#fff"
            stroke="#2563EB"
            strokeWidth={1.5 / scale}
            cornerRadius={1}
            draggable
            onDragEnd={handleResize(h.key)}
          />
        ))}
      </>
    )
  }

  return (
    <Group
      x={obj.x}
      y={obj.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={() => onSelect(obj.id)}
      onDblClick={handleDblClick}
      onDblTap={() => setIsEditing(true)}
    >
      {renderBody()}
      {renderSelection()}
    </Group>
  )
})

export default BoardShape
