import { useState, useCallback, useRef, useEffect } from 'react'
import { Stage, Layer, Circle, Text as KonvaText, Line } from 'react-konva'
import type Konva from 'konva'
import { useYjs } from './useYjs'
import StickyNote from './StickyNote'
import Rectangle from './Rectangle'
import type { BoardObject } from './types'

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

interface BoardProps {
  userName: string
}

export default function Board({ userName }: BoardProps) {
  const userColor = COLORS[Math.abs(userName.charCodeAt(0)) % COLORS.length]

  const { objects, remoteCursors, connected, createObject, updateObject, setCursor } =
    useYjs('mvp-board-1', userName, userColor)

  const stageRef = useRef<Konva.Stage>(null)
  const [scale, setScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })

  // Track window resize
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const scaleBy = 1.08
      const oldScale = scale
      const newScale = e.evt.deltaY > 0
        ? Math.max(0.1, oldScale / scaleBy)
        : Math.min(5, oldScale * scaleBy)

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      }

      console.log('[CANVAS] Zoom:', newScale.toFixed(2))
      setScale(newScale)
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    },
    [scale, stagePos]
  )

  // Pan drag
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      const pos = { x: e.target.x(), y: e.target.y() }
      console.log('[CANVAS] Panned to:', pos)
      setStagePos(pos)
    }
  }, [])

  // Track cursor for awareness
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      // Convert screen coords to board coords
      const x = (pointer.x - stagePos.x) / scale
      const y = (pointer.y - stagePos.y) / scale
      setCursor(x, y)
    },
    [setCursor, stagePos, scale]
  )

  // Create objects
  const createSticky = useCallback(() => {
    const id = crypto.randomUUID()
    const obj: BoardObject = {
      id,
      type: 'sticky',
      x: (-stagePos.x + size.w / 2 - 75) / scale,
      y: (-stagePos.y + size.h / 2 - 75) / scale,
      width: 150,
      height: 150,
      text: 'New note',
      fill: '#FFEB3B',
    }
    console.log('[CREATE]', obj)
    createObject(obj)
  }, [createObject, stagePos, scale, size])

  const createRect = useCallback(() => {
    const id = crypto.randomUUID()
    const obj: BoardObject = {
      id,
      type: 'rect',
      x: (-stagePos.x + size.w / 2 - 50) / scale,
      y: (-stagePos.y + size.h / 2 - 50) / scale,
      width: 100,
      height: 100,
      fill: '#3B82F6',
    }
    console.log('[CREATE]', obj)
    createObject(obj)
  }, [createObject, stagePos, scale, size])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          gap: 8,
          background: '#fff',
          padding: '6px 12px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          alignItems: 'center',
        }}
      >
        <button onClick={createSticky} style={btnStyle} title="Add Sticky Note">
          📋 Sticky
        </button>
        <button onClick={createRect} style={btnStyle} title="Add Rectangle">
          ◻ Rect
        </button>
        <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Presence bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 40,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: '#fff',
          padding: '6px 12px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          fontSize: 13,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#374151' }}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
        {remoteCursors.length > 0 && (
          <span style={{ color: '#6b7280' }}>
            {' '}| {remoteCursors.length} other{remoteCursors.length > 1 ? 's' : ''} online
          </span>
        )}
      </div>

      {/* Canvas */}
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseMove={handleMouseMove}
      >
        {/* Objects layer */}
        <Layer>
          {objects.map((obj) =>
            obj.type === 'sticky' ? (
              <StickyNote key={obj.id} obj={obj} onUpdate={updateObject} />
            ) : (
              <Rectangle key={obj.id} obj={obj} onUpdate={updateObject} />
            )
          )}
        </Layer>

        {/* Remote cursors layer */}
        <Layer>
          {remoteCursors.map((rc) => {
            if (!rc.cursor) return null
            return (
              <CursorBadge
                key={rc.clientId}
                x={rc.cursor.x}
                y={rc.cursor.y}
                name={rc.name}
                color={rc.color}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}

function CursorBadge({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  return (
    <>
      {/* Cursor arrow */}
      <Line
        points={[x, y, x + 2, y + 12, x + 5, y + 9, x + 10, y + 14, x + 12, y + 12, x + 7, y + 7, x + 11, y + 5, x, y]}
        fill={color}
        closed
      />
      {/* Name label */}
      <KonvaText
        x={x + 14}
        y={y}
        text={name}
        fontSize={11}
        fill="#EF4444"
        padding={3}
      />
      {/* Label background */}
      <Circle x={x + 14} y={y + 7} radius={0} />
    </>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: '4px 10px',
  borderRadius: 6,
  color: '#374151',
  fontFamily: 'system-ui, sans-serif',
}
