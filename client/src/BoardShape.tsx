import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Group, Rect, Text, Ellipse, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'
import { calcAngle } from './utils/geometry'

const HANDLE_SIZE = 10
const HANDLE_HIT_SIZE = 24 // Larger invisible hit area for easier grabbing
const MIN_SIZE = 30
const ROTATION_HANDLE_OFFSET = 30 // Distance above shape for rotation handle

interface Props {
  obj: BoardObject
  isSelected: boolean
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  // Primitives survive React.memo shallow comparison (unlike objects/Sets)
  stagePosX: number
  stagePosY: number
  // Multi-select group drag support — boolean primitive instead of Set<string>
  isMultiSelected?: boolean
  onGroupDragEnd?: (draggedId: string, dx: number, dy: number) => void
}

/**
 * BoardShape — unified editable shape component for all object types.
 *
 * Supports: sticky, rect, circle, text, frame
 * Features:
 *  - Drag to move (live position update)
 *  - Click to select (shows blue border + resize handles)
 *  - Drag corner handles to resize (smooth live preview)
 *  - Drag rotation handle to rotate (smooth live preview)
 *  - Double-click to edit text (textarea overlay)
 *  - Enter = save, Shift+Enter = newline, Esc = cancel, blur = save
 */
const BoardShape = memo(function BoardShape({
  obj, isSelected, onSelect, onUpdate, stageRef, scale,
  stagePosX, stagePosY, isMultiSelected, onGroupDragEnd,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(obj.text ?? '')
  const shapeGroupRef = useRef<Konva.Group>(null)

  // Live resize state — tracks dimensions during drag for smooth preview
  const [liveResize, setLiveResize] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  // Tracks the starting obj bounds AND the handle's initial position
  const resizeStartRef = useRef<{
    x: number; y: number; width: number; height: number
    handleStartX: number; handleStartY: number
  } | null>(null)
  // Flag to prevent the parent Group drag from firing during a resize
  const isResizingRef = useRef(false)

  // Live rotation state
  const [liveRotation, setLiveRotation] = useState<number | null>(null)
  const isRotatingRef = useRef(false)

  // Group drag tracking
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)

  // Use live resize values if actively resizing, otherwise use obj values
  const displayW = liveResize ? liveResize.width : obj.width
  const displayH = liveResize ? liveResize.height : obj.height

  // The effective rotation (live preview or stored)
  const effectiveRotation = liveRotation ?? obj.rotation ?? 0

  useEffect(() => {
    if (!isEditing) setEditText(obj.text ?? '')
  }, [obj.text, isEditing])

  // ---- Drag ---------------------------------------------------------------
  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // If a resize or rotation is in progress, prevent the Group from dragging
    if (isResizingRef.current || isRotatingRef.current) {
      e.target.stopDrag()
      return
    }
    // Capture start position for group drag delta calculation
    const node = e.target
    dragStartPosRef.current = { x: node.x(), y: node.y() }
  }, [])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (isResizingRef.current || isRotatingRef.current) return
    if (e.target !== e.currentTarget) return
    const node = e.target

    // With offset, x/y includes the center offset. We need to convert back to top-left.
    const newCenterX = node.x()
    const newCenterY = node.y()
    const newX = newCenterX - displayW / 2
    const newY = newCenterY - displayH / 2

    // Calculate delta for group drag
    if (dragStartPosRef.current && onGroupDragEnd && isMultiSelected) {
      const dx = newCenterX - dragStartPosRef.current.x
      const dy = newCenterY - dragStartPosRef.current.y
      onGroupDragEnd(obj.id, dx, dy)
    }
    dragStartPosRef.current = null

    onUpdate(obj.id, { x: newX, y: newY })
  }, [obj.id, onUpdate, displayW, displayH, onGroupDragEnd, isMultiSelected])

  // ---- Select -------------------------------------------------------------
  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    onSelect(obj.id, e)
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

    const screenX = obj.x * scale + stagePosX
    const screenY = obj.y * scale + stagePosY
    const screenW = obj.width * scale
    const screenH = obj.height * scale

    const container = stage.container()
    const rect = container.getBoundingClientRect()

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

  /** Calculate new bounds from a pure delta (pixels dragged from start) */
  const calcResize = useCallback(
    (corner: string, dx: number, dy: number) => {
      const base = resizeStartRef.current
      if (!base) return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

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

  /** Start resize — capture starting dims + handle position */
  const handleResizeDragStart = useCallback(
    (_corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      isResizingRef.current = true
      const node = e.target
      // Disable dragging on the outer shape Group so it doesn't move during resize
      const shapeGroup = shapeGroupRef.current
      if (shapeGroup) shapeGroup.draggable(false)
      resizeStartRef.current = {
        x: obj.x, y: obj.y, width: obj.width, height: obj.height,
        handleStartX: node.x(), handleStartY: node.y(),
      }
    },
    [obj.x, obj.y, obj.width, obj.height],
  )

  /** Live resize — compute pure delta from handle start pos for smooth preview */
  const handleResizeDragMove = useCallback(
    (corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      if (!resizeStartRef.current) return
      const node = e.target
      const dx = node.x() - resizeStartRef.current.handleStartX
      const dy = node.y() - resizeStartRef.current.handleStartY
      setLiveResize(calcResize(corner, dx, dy))
    },
    [calcResize],
  )

  /** End resize — commit to Yjs and clear live state */
  const handleResizeDragEnd = useCallback(
    (corner: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      if (!resizeStartRef.current) return
      const node = e.target
      const dx = node.x() - resizeStartRef.current.handleStartX
      const dy = node.y() - resizeStartRef.current.handleStartY

      // Reset handle position back to its original spot
      node.position({ x: resizeStartRef.current.handleStartX, y: resizeStartRef.current.handleStartY })

      const newBounds = calcResize(corner, dx, dy)

      // Re-enable outer shape Group dragging and reset its position (center-based)
      const shapeGroup = shapeGroupRef.current
      if (shapeGroup) {
        shapeGroup.draggable(true)
        shapeGroup.position({
          x: newBounds.x + newBounds.width / 2,
          y: newBounds.y + newBounds.height / 2,
        })
      }

      setLiveResize(null)
      resizeStartRef.current = null
      setTimeout(() => { isResizingRef.current = false }, 0)
      onUpdate(obj.id, newBounds)
    },
    [obj.id, calcResize, onUpdate],
  )

  // ---- Rotation handle ----------------------------------------------------

  const handleRotationDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    isRotatingRef.current = true
    const shapeGroup = shapeGroupRef.current
    if (shapeGroup) shapeGroup.draggable(false)
  }, [])

  const handleRotationDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // Shape center in world coordinates
    const centerX = obj.x + displayW / 2
    const centerY = obj.y + displayH / 2

    // Convert screen pointer to world coords
    const worldX = (pointer.x - stagePosX) / scale
    const worldY = (pointer.y - stagePosY) / scale

    const angle = calcAngle(worldX, worldY, centerX, centerY)
    setLiveRotation(angle)

    // Reset drag node position so it doesn't accumulate offset
    const node = e.target
    node.position({ x: node.x(), y: node.y() })
  }, [obj.x, obj.y, displayW, displayH, stagePosX, stagePosY, scale, stageRef])

  const handleRotationDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    if (liveRotation !== null) {
      onUpdate(obj.id, { rotation: Math.round(liveRotation) })
    }
    setLiveRotation(null)
    const shapeGroup = shapeGroupRef.current
    if (shapeGroup) shapeGroup.draggable(true)
    setTimeout(() => { isRotatingRef.current = false }, 0)
  }, [obj.id, onUpdate, liveRotation])

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

  // ---- Selection border + resize handles + rotation handle ------------------
  const renderSelection = () => {
    if (!isSelected) return null

    const w = displayW
    const h = displayH
    const hs = HANDLE_SIZE / scale
    const hitHs = HANDLE_HIT_SIZE / scale
    const rotHandleOffset = ROTATION_HANDLE_OFFSET / scale
    const rotHandleRadius = 5 / scale
    const rotHitRadius = 12 / scale

    const handles = [
      { key: 'tl', x: 0, y: 0 },
      { key: 'tr', x: w, y: 0 },
      { key: 'bl', x: 0, y: h },
      { key: 'br', x: w, y: h },
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

        {/* Rotation handle — line + circle above top-center */}
        <Line
          points={[w / 2, 0, w / 2, -rotHandleOffset]}
          stroke="#2563EB"
          strokeWidth={1 / scale}
          listening={false}
        />
        {/* Visual rotation circle */}
        <Circle
          x={w / 2}
          y={-rotHandleOffset}
          radius={rotHandleRadius}
          fill="#fff"
          stroke="#2563EB"
          strokeWidth={1.5 / scale}
          listening={false}
        />
        {/* Invisible rotation hit area (larger circle for easy grabbing) */}
        <Circle
          x={w / 2}
          y={-rotHandleOffset}
          radius={rotHitRadius}
          fill="transparent"
          draggable
          onDragStart={handleRotationDragStart}
          onDragMove={handleRotationDragMove}
          onDragEnd={handleRotationDragEnd}
        />

        {/* Resize handles */}
        {handles.map((handle) => (
          <Group key={handle.key}>
            {/* Visual handle (small white square) */}
            <Rect
              x={handle.x - hs / 2}
              y={handle.y - hs / 2}
              width={hs}
              height={hs}
              fill="#fff"
              stroke="#2563EB"
              strokeWidth={1.5 / scale}
              cornerRadius={2}
              listening={false}
            />
            {/* Draggable hit area (larger invisible rect for easy grabbing) */}
            <Rect
              x={handle.x - hitHs / 2}
              y={handle.y - hitHs / 2}
              width={hitHs}
              height={hitHs}
              fill="transparent"
              draggable
              onDragStart={handleResizeDragStart(handle.key)}
              onDragMove={handleResizeDragMove(handle.key)}
              onDragEnd={handleResizeDragEnd(handle.key)}
            />
          </Group>
        ))}
      </>
    )
  }

  // Position the Group at center (for rotation pivot), use offset to shift content
  const centerX = (liveResize ? liveResize.x : obj.x) + displayW / 2
  const centerY = (liveResize ? liveResize.y : obj.y) + displayH / 2

  return (
    <Group
      ref={shapeGroupRef}
      x={centerX}
      y={centerY}
      offsetX={displayW / 2}
      offsetY={displayH / 2}
      rotation={effectiveRotation}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={(e) => onSelect(obj.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
      onDblClick={handleDblClick}
      onDblTap={() => setIsEditing(true)}
    >
      {renderBody()}
      {renderSelection()}
    </Group>
  )
})

export default BoardShape
