import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Circle, Text as KonvaText, Line } from 'react-konva'
import type Konva from 'konva'
import { useYjs } from './useYjs'
import BoardShape from './BoardShape'
import type { BoardObject, ToolType } from './types'
import { cullObjects, type Viewport } from './utils/viewportCulling'

const DEBUG = import.meta.env.DEV

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

// Shape fill colors for the color picker
const SHAPE_COLORS = [
  '#FFEB3B', '#FFA726', '#EF5350', '#AB47BC',
  '#42A5F5', '#26C6DA', '#66BB6A', '#8D6E63',
  '#78909C', '#FFFFFF',
]

interface BoardProps {
  userName: string
}

export default function Board({ userName }: BoardProps) {
  const userColor = COLORS[Math.abs(userName.charCodeAt(0)) % COLORS.length]

  const { objects, remoteCursors, connected, createObject, updateObject, deleteObject, setCursor } =
    useYjs('mvp-board-1', userName, userColor)

  const stageRef = useRef<Konva.Stage>(null)
  const [scale, setScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Track window resize
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Viewport culling
  const viewport: Viewport = useMemo(
    () => ({
      stageX: stagePos.x,
      stageY: stagePos.y,
      scale,
      width: size.w,
      height: size.h,
    }),
    [stagePos.x, stagePos.y, scale, size.w, size.h],
  )

  const visibleObjects = useMemo(() => {
    const culled = cullObjects(objects, viewport)
    if (DEBUG) console.log(`[CULL] ${culled.length}/${objects.length} objects visible`)
    return culled
  }, [objects, viewport])

  // Get selected object for color picker / context
  const selectedObj = useMemo(
    () => objects.find((o) => o.id === selectedId) ?? null,
    [objects, selectedId],
  )

  // ---- Zoom ---------------------------------------------------------------
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

      setScale(newScale)
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    },
    [scale, stagePos],
  )

  // ---- Pan ----------------------------------------------------------------
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() })
    }
  }, [])

  // ---- Cursor awareness ---------------------------------------------------
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const x = (pointer.x - stagePos.x) / scale
      const y = (pointer.y - stagePos.y) / scale
      setCursor(x, y)
    },
    [setCursor, stagePos, scale],
  )

  // ---- Click on empty canvas = deselect or create object -------------------
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only handle clicks on the stage itself (empty space)
      if (e.target !== e.target.getStage()) return

      if (activeTool === 'select') {
        setSelectedId(null)
        setShowColorPicker(false)
        return
      }

      // Create object at click position
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const worldX = (pointer.x - stagePos.x) / scale
      const worldY = (pointer.y - stagePos.y) / scale

      const id = crypto.randomUUID()
      const defaults: Record<string, Partial<BoardObject>> = {
        sticky: { width: 150, height: 150, fill: '#FFEB3B', text: 'New note' },
        rect: { width: 120, height: 80, fill: '#42A5F5' },
        circle: { width: 100, height: 100, fill: '#66BB6A' },
        text: { width: 200, height: 40, fill: 'transparent', text: 'Text', fontSize: 18 },
        frame: { width: 300, height: 200, fill: 'transparent', text: 'Frame' },
      }

      const d = defaults[activeTool] ?? defaults.rect
      const obj: BoardObject = {
        id,
        type: activeTool as BoardObject['type'],
        x: worldX - (d.width ?? 100) / 2,
        y: worldY - (d.height ?? 100) / 2,
        width: d.width ?? 100,
        height: d.height ?? 100,
        fill: d.fill ?? '#42A5F5',
        text: d.text,
        fontSize: d.fontSize,
      }

      createObject(obj)
      setSelectedId(id)
      // Switch back to select after placing
      setActiveTool('select')
    },
    [activeTool, stagePos, scale, createObject],
  )

  // ---- Selection ----------------------------------------------------------
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setShowColorPicker(false)
  }, [])

  // ---- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture keys when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break
        case 's': setActiveTool('sticky'); break
        case 'r': setActiveTool('rect'); break
        case 'c': setActiveTool('circle'); break
        case 't': setActiveTool('text'); break
        case 'f': setActiveTool('frame'); break
        case 'delete':
        case 'backspace':
          if (selectedId) {
            deleteObject(selectedId)
            setSelectedId(null)
          }
          break
        case 'escape':
          setSelectedId(null)
          setActiveTool('select')
          setShowColorPicker(false)
          break
        case 'd':
          if ((e.ctrlKey || e.metaKey) && selectedId) {
            e.preventDefault()
            // Duplicate selected object
            const src = objects.find((o) => o.id === selectedId)
            if (src) {
              const newId = crypto.randomUUID()
              createObject({ ...src, id: newId, x: src.x + 20, y: src.y + 20 })
              setSelectedId(newId)
            }
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, deleteObject, objects, createObject])

  // ---- Zoom controls ------------------------------------------------------
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(5, s * 1.2))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(0.1, s / 1.2))
  }, [])

  const zoomReset = useCallback(() => {
    setScale(1)
    setStagePos({ x: 0, y: 0 })
  }, [])

  // ---- Color picker -------------------------------------------------------
  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedId) {
        updateObject(selectedId, { fill: color })
      }
      setShowColorPicker(false)
    },
    [selectedId, updateObject],
  )

  // ---- Toolbar data -------------------------------------------------------
  const tools: Array<{ type: ToolType; label: string; icon: string; shortcut: string }> = [
    { type: 'select', label: 'Select', icon: '↖', shortcut: 'V' },
    { type: 'sticky', label: 'Sticky', icon: '☐', shortcut: 'S' },
    { type: 'rect', label: 'Rect', icon: '▬', shortcut: 'R' },
    { type: 'circle', label: 'Circle', icon: '●', shortcut: 'C' },
    { type: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
    { type: 'frame', label: 'Frame', icon: '⊞', shortcut: 'F' },
  ]

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Dot grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${stagePos.x % (20 * scale)}px ${stagePos.y % (20 * scale)}px`,
          zIndex: 0,
        }}
      />

      {/* Left vertical toolbar */}
      <div style={toolbarStyle}>
        {tools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => setActiveTool(tool.type)}
            style={{
              ...toolBtnStyle,
              background: activeTool === tool.type ? '#EBF5FF' : 'transparent',
              color: activeTool === tool.type ? '#2563EB' : '#64748B',
              border: activeTool === tool.type ? '1px solid #BFDBFE' : '1px solid transparent',
            }}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span style={{ fontSize: 18, lineHeight: '1' }}>{tool.icon}</span>
            <span style={{ fontSize: 9, marginTop: 2 }}>{tool.shortcut}</span>
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '70%', height: 1, background: '#e5e7eb', margin: '4px auto' }} />

        {/* Delete button */}
        <button
          onClick={() => {
            if (selectedId) {
              deleteObject(selectedId)
              setSelectedId(null)
            }
          }}
          style={{
            ...toolBtnStyle,
            color: selectedId ? '#EF4444' : '#d1d5db',
          }}
          title="Delete (Del)"
          disabled={!selectedId}
        >
          <span style={{ fontSize: 16 }}>🗑</span>
          <span style={{ fontSize: 9, marginTop: 2 }}>Del</span>
        </button>

        {/* Color button */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          style={{
            ...toolBtnStyle,
            position: 'relative',
            color: selectedId ? '#374151' : '#d1d5db',
          }}
          title="Color"
          disabled={!selectedId}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: selectedObj?.fill || '#ccc',
              border: '2px solid #e5e7eb',
              display: 'block',
            }}
          />
          <span style={{ fontSize: 9, marginTop: 2 }}>Color</span>
        </button>
      </div>

      {/* Color picker popup */}
      {showColorPicker && selectedId && (
        <div style={colorPickerStyle}>
          {SHAPE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: color,
                border: selectedObj?.fill === color ? '2px solid #2563EB' : '2px solid #e5e7eb',
                cursor: 'pointer',
                padding: 0,
              }}
              title={color}
            />
          ))}
        </div>
      )}

      {/* Presence bar (top right) */}
      <div style={presenceStyle}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#374151', fontSize: 13 }}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
        {remoteCursors.length > 0 && (
          <>
            <div style={{ width: 1, height: 16, background: '#e5e7eb' }} />
            {remoteCursors.slice(0, 5).map((rc) => (
              <span
                key={rc.clientId}
                title={rc.name}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: rc.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {rc.name.charAt(0).toUpperCase()}
              </span>
            ))}
            {remoteCursors.length > 5 && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                +{remoteCursors.length - 5}
              </span>
            )}
          </>
        )}
      </div>

      {/* Zoom controls (bottom right) */}
      <div style={zoomControlsStyle}>
        <button onClick={zoomOut} style={zoomBtnStyle} title="Zoom Out">−</button>
        <button onClick={zoomReset} style={{ ...zoomBtnStyle, fontSize: 11, minWidth: 48 }}>
          {Math.round(scale * 100)}%
        </button>
        <button onClick={zoomIn} style={zoomBtnStyle} title="Zoom In">+</button>
      </div>

      {/* Canvas */}
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable={activeTool === 'select'}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseMove={handleMouseMove}
        onClick={handleStageClick}
        onTap={handleStageClick as any}
        style={{ position: 'relative', zIndex: 1, cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
      >
        {/* Objects layer */}
        <Layer>
          {visibleObjects.map((obj) => (
            <BoardShape
              key={obj.id}
              obj={obj}
              isSelected={obj.id === selectedId}
              onSelect={handleSelect}
              onUpdate={updateObject}
              stageRef={stageRef}
              scale={scale}
              stagePos={stagePos}
            />
          ))}
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

// ---- Remote cursor display ------------------------------------------------

function CursorBadge({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  return (
    <>
      <Line
        points={[x, y, x + 2, y + 12, x + 5, y + 9, x + 10, y + 14, x + 12, y + 12, x + 7, y + 7, x + 11, y + 5, x, y]}
        fill={color}
        closed
      />
      <KonvaText
        x={x + 14}
        y={y}
        text={name}
        fontSize={11}
        fill="#fff"
        padding={3}
      />
      {/* Label background behind name */}
      <Circle x={x + 14} y={y + 7} radius={0} />
    </>
  )
}

// ---- Styles ---------------------------------------------------------------

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 12,
  transform: 'translateY(-50%)',
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  background: '#fff',
  padding: '8px 6px',
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
  border: '1px solid #e5e7eb',
}

const toolBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'system-ui, sans-serif',
}

const presenceStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 40,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  background: '#fff',
  padding: '6px 14px',
  borderRadius: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
}

const zoomControlsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  zIndex: 40,
  display: 'flex',
  gap: 2,
  background: '#fff',
  padding: 4,
  borderRadius: 10,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
}

const zoomBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 16,
  color: '#374151',
  fontFamily: 'system-ui, sans-serif',
}

const colorPickerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 68,
  transform: 'translateY(-50%)',
  zIndex: 50,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 6,
  background: '#fff',
  padding: 10,
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  border: '1px solid #e5e7eb',
}
