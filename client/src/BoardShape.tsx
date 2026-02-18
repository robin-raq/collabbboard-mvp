import { useState, useEffect, useCallback, useRef, memo } from 'react'
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
 *  - Drag to move (live position update)
 *  - Click to select (shows blue border + resize handles)
 *  - Drag corner handles to resize (smooth live preview)
 *  - Double-click to edit text (textarea overlay)
 *  - Enter = save, Shift+Enter = newline, Esc = cancel, blur = save
 */
const BoardShape = memo(function BoardShape({
  obj, isSelected, onSelect, onUpdate, stageRef, scale, stagePos,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(obj.text ?? '')

  // Live resize state — tracks dimensions during drag for smooth preview
  const [liveResize, setLiveResize] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  // Use live resize values if actively resizing, otherwise use obj values
  const displayX = liveResize ? liveResize.x : obj.x
  const displayY = liveResize ? liveResize.y : obj.y
  const displayW = liveResize ? liveResize.width : obj.width
  const displayH = liveResize ? liveResize.height : obj.height

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

  // ---- Resize handles (smooth live preview) --------------------------------

  /** Calculate new bounds from a handle drag delta */
  const calcResize = useCallback(
    (corner: string, dx: number, dy: number) => {
      const base = resizeStartRef.current ?? { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
      let newX = base.x
      let newY = base.y
      let newW = base.width
      let newH = base.height

      if (corner.includes('r')) newW = Math.max(MIN_SIZE, base.width + dx)
      if (corner.includes('b')) newH = Math.max(MIN_SIZE, base.height + dy)
      if (corner.includes('l')) {
        const delta = Math.min(dx, base.width - MIN_SIZE)
        newX = base.x + delta
        newW = base.width - delta
      }
      if (corner.includes('t')) {
        const delta = Math.min(dy, base.height - MIN_SIZE)
        newY = base.y + delta
        newH = base.height - delta
      }

      return { x: newX, y: newY, width: newW, height: newH }
    },
    [obj.x, obj.y, obj.width, obj.height],
  )

  /** Start resize — capture the starting dimensions */
  const handleResizeDragStart = useCallback(
    (_corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      resizeStartRef.current = { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
    },
    [obj.x, obj.y, obj.width, obj.height],
  )

  /** Live resize — update local state every frame for smooth preview */
  const handleResizeDragMove = useCallback(
    (corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const node = e.target
      const dx = node.x()
      const dy = node.y()
      setLiveResize(calcResize(corner, dx, dy))
    },
    [calcResize],
  )

  /** End resize — commit to Yjs and clear live state */
  const handleResizeDragEnd = useCallback(
    (corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const node = e.target
      const dx = node.x()
      const dy = node.y()
      // Reset handle position
      node.position({ x: 0, y: 0 })

      const newBounds = calcResize(corner, dx, dy)
      setLiveResize(null)
      resizeStartRef.current = null
      onUpdate(obj.id, newBounds)
    },
    [obj.id, calcResize, onUpdate],
  )

  // ---- Render shape body --------------------------------------------------
  const renderBody = () => {
    const w = displayW
    const h = displayH

    switch (obj.type) {
      case 'sticky':
        return (
          <>
            <Rect
              width={w}
              height={h}
              fill={obj.fill}
              cornerRadius={4}
              shadowColor="rgba(0,0,0,0.15)"
              shadowBlur={6}
              shadowOffsetY={2}
            />
            <Text
              text={obj.text ?? ''}
              width={w}
              height={h}
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
              width={w}
              height={h}
              fill={obj.fill}
              stroke="#1E293B"
              strokeWidth={1}
              cornerRadius={2}
            />
            {obj.text && (
              <Text
                text={obj.text}
                width={w}
                height={h}
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
              x={w / 2}
              y={h / 2}
              radiusX={w / 2}
              radiusY={h / 2}
              fill={obj.fill}
              stroke="#1E293B"
              strokeWidth={1}
            />
            {obj.text && (
              <Text
                text={obj.text}
                width={w}
                height={h}
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
            width={w}
            height={h}
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
              width={w}
              height={h}
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

    const w = displayW
    const h = displayH
    const hs = HANDLE_SIZE / scale // Scale-independent handle size
    const handles = [
      { key: 'tl', x: 0, y: 0, cursor: 'nwse-resize' },
      { key: 'tr', x: w, y: 0, cursor: 'nesw-resize' },
      { key: 'bl', x: 0, y: h, cursor: 'nesw-resize' },
      { key: 'br', x: w, y: h, cursor: 'nwse-resize' },
    ]

    return (
      <>
        {/* Selection border */}
        <Rect
          width={w}
          height={h}
          stroke="#2563EB"
          strokeWidth={2 / scale}
          fill="transparent"
          listening={false}
          dash={[6 / scale, 3 / scale]}
        />
        {/* Resize handles — onDragMove gives smooth live preview */}
        {handles.map((handle) => (
          <Rect
            key={handle.key}
            x={handle.x - hs / 2}
            y={handle.y - hs / 2}
            width={hs}
            height={hs}
            fill="#fff"
            stroke="#2563EB"
            strokeWidth={1.5 / scale}
            cornerRadius={1}
            draggable
            onDragStart={handleResizeDragStart(handle.key)}
            onDragMove={handleResizeDragMove(handle.key)}
            onDragEnd={handleResizeDragEnd(handle.key)}
          />
        ))}
      </>
    )
  }

  return (
    <Group
      x={displayX}
      y={displayY}
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
