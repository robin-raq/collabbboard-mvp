import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Rect as KonvaRect, Text as KonvaText, Line } from 'react-konva'
import type Konva from 'konva'
import { useYjs } from './useYjs'
import BoardShape from './BoardShape'
import Connector from './Connector'
import type { BoardObject, ToolType } from './types'
import { cullObjects, type Viewport } from './utils/viewportCulling'
import { intersects, normalizeRect, getSelectionBounds, type SelectionRect } from './utils/selection'

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
  // Multi-select: Set of selected object IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [showColorPicker, setShowColorPicker] = useState(false)
  // Line tool: first click sets the start point, second click creates the line
  const [lineStart, setLineStart] = useState<{ x: number; y: number; fromId?: string } | null>(null)
  // Rubber-band selection
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)

  // Derived: first selected ID (for single-object contexts like color picker)
  const selectedId = useMemo(
    () => selectedIds.size > 0 ? [...selectedIds][0] : null,
    [selectedIds],
  )

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
  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() })
    }
  }, [])

  // ---- Cursor awareness ---------------------------------------------------
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const x = (pointer.x - stagePos.x) / scale
      const y = (pointer.y - stagePos.y) / scale
      setCursor(x, y)

      // Rubber-band selection update
      if (selectionStartRef.current && activeTool === 'select') {
        const rect = normalizeRect(
          selectionStartRef.current.x, selectionStartRef.current.y,
          x, y,
        )
        setSelectionRect(rect)
      }
    },
    [setCursor, stagePos, scale, activeTool],
  )

  // ---- Helper: convert screen pointer to world coords ----------------------
  const pointerToWorld = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return {
      x: (pointer.x - stagePos.x) / scale,
      y: (pointer.y - stagePos.y) / scale,
    }
  }, [stagePos, scale])

  // ---- Rubber-band selection: mouse down on empty canvas -------------------
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return
      if (activeTool !== 'select') return
      if (lineStart) return

      const world = pointerToWorld()
      if (!world) return

      selectionStartRef.current = { x: world.x, y: world.y }
    },
    [activeTool, lineStart, pointerToWorld],
  )

  // ---- Rubber-band selection: mouse up on stage ----------------------------
  const handleStageMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (selectionStartRef.current && selectionRect) {
        // Only do rubber-band select if the rect is big enough (not just a click)
        if (selectionRect.w > 5 || selectionRect.h > 5) {
          const selected = objects.filter((obj) => obj.type !== 'line' && intersects(obj, selectionRect))
          setSelectedIds(new Set(selected.map((o) => o.id)))
        }
        setSelectionRect(null)
        selectionStartRef.current = null
      }
    },
    [selectionRect, objects],
  )

  // ---- Click on empty canvas = deselect or create object -------------------
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only handle clicks on the stage itself (empty space)
      if (e.target !== e.target.getStage()) return

      const world = pointerToWorld()
      if (!world) return

      // Line / Arrow tool — two-click mode
      const isLineTool = activeTool === 'line' || activeTool === 'arrow'
      if (isLineTool) {
        if (!lineStart) {
          // First click — set start point
          setLineStart({ x: world.x, y: world.y })
        } else {
          // Second click — create the line
          const id = crypto.randomUUID()
          const minX = Math.min(lineStart.x, world.x)
          const minY = Math.min(lineStart.y, world.y)
          const obj: BoardObject = {
            id,
            type: 'line',
            x: minX,
            y: minY,
            width: Math.abs(world.x - lineStart.x) || 1,
            height: Math.abs(world.y - lineStart.y) || 1,
            fill: '#374151',
            points: [
              lineStart.x - minX, lineStart.y - minY,
              world.x - minX, world.y - minY,
            ],
            fromId: lineStart.fromId,
            arrowEnd: activeTool === 'arrow',
          }
          createObject(obj)
          setSelectedIds(new Set([id]))
          setLineStart(null)
          setActiveTool('select')
        }
        return
      }

      if (activeTool === 'select') {
        setSelectedIds(new Set())
        setShowColorPicker(false)
        setLineStart(null)
        return
      }

      // Create shape at click position
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
        x: world.x - (d.width ?? 100) / 2,
        y: world.y - (d.height ?? 100) / 2,
        width: d.width ?? 100,
        height: d.height ?? 100,
        fill: d.fill ?? '#42A5F5',
        text: d.text,
        fontSize: d.fontSize,
      }

      createObject(obj)
      setSelectedIds(new Set([id]))
      setActiveTool('select')
    },
    [activeTool, stagePos, scale, createObject, lineStart, pointerToWorld],
  )

  // ---- Handle clicking on a shape with line/arrow tool to start connector --
  const handleSelectOrConnect = useCallback((id: string, e?: Konva.KonvaEventObject<MouseEvent>) => {
    const isLineTool = activeTool === 'line' || activeTool === 'arrow'
    if (isLineTool) {
      const target = objects.find((o) => o.id === id)
      if (!target) return

      if (!lineStart) {
        // Start connector from this object
        const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
        setLineStart({ x: center.x, y: center.y, fromId: id })
      } else {
        // End connector at this object
        const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
        const minX = Math.min(lineStart.x, center.x)
        const minY = Math.min(lineStart.y, center.y)
        const connId = crypto.randomUUID()
        const obj: BoardObject = {
          id: connId,
          type: 'line',
          x: minX,
          y: minY,
          width: Math.abs(center.x - lineStart.x) || 1,
          height: Math.abs(center.y - lineStart.y) || 1,
          fill: '#374151',
          points: [
            lineStart.x - minX, lineStart.y - minY,
            center.x - minX, center.y - minY,
          ],
          fromId: lineStart.fromId,
          toId: id,
          arrowEnd: activeTool === 'arrow',
        }
        createObject(obj)
        setSelectedIds(new Set([connId]))
        setLineStart(null)
        setActiveTool('select')
      }
      return
    }

    // Multi-select: shift-click toggles
    if (e?.evt?.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else {
      setSelectedIds(new Set([id]))
    }
    setShowColorPicker(false)
  }, [activeTool, lineStart, objects, createObject])

  // ---- Group drag handler (called from BoardShape when multi-selected) -----
  const handleGroupDragEnd = useCallback((draggedId: string, dx: number, dy: number) => {
    for (const id of selectedIds) {
      if (id === draggedId) continue
      const obj = objects.find((o) => o.id === id)
      if (obj) {
        updateObject(id, { x: obj.x + dx, y: obj.y + dy })
      }
    }
  }, [selectedIds, objects, updateObject])

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
        case 'l': setActiveTool('line'); setLineStart(null); break
        case 'delete':
        case 'backspace':
          if (selectedIds.size > 0) {
            for (const id of selectedIds) {
              deleteObject(id)
            }
            setSelectedIds(new Set())
          }
          break
        case 'escape':
          setSelectedIds(new Set())
          setActiveTool('select')
          setShowColorPicker(false)
          setLineStart(null)
          break
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Select all non-line objects
            const allIds = objects.filter((o) => o.type !== 'line').map((o) => o.id)
            setSelectedIds(new Set(allIds))
          } else {
            setActiveTool('arrow')
            setLineStart(null)
          }
          break
        case 'd':
          if ((e.ctrlKey || e.metaKey) && selectedIds.size > 0) {
            e.preventDefault()
            // Duplicate all selected objects
            const newIds = new Set<string>()
            for (const id of selectedIds) {
              const src = objects.find((o) => o.id === id)
              if (src) {
                const newId = crypto.randomUUID()
                createObject({ ...src, id: newId, x: src.x + 20, y: src.y + 20 })
                newIds.add(newId)
              }
            }
            setSelectedIds(newIds)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds, deleteObject, objects, createObject])

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

  // ---- Color picker (applies to all selected) -----------------------------
  const handleColorChange = useCallback(
    (color: string) => {
      for (const id of selectedIds) {
        updateObject(id, { fill: color })
      }
      setShowColorPicker(false)
    },
    [selectedIds, updateObject],
  )

  // ---- Multi-select bounding box ------------------------------------------
  const selectionBounds = useMemo(() => {
    if (selectedIds.size <= 1) return null
    const selected = objects.filter((o) => selectedIds.has(o.id))
    return getSelectionBounds(selected)
  }, [selectedIds, objects])

  // ---- Toolbar data -------------------------------------------------------
  const tools: Array<{ type: ToolType; label: string; icon: string; shortcut: string }> = [
    { type: 'select', label: 'Select', icon: '\u2196', shortcut: 'V' },
    { type: 'sticky', label: 'Sticky', icon: '\u2610', shortcut: 'S' },
    { type: 'rect', label: 'Rect', icon: '\u25AC', shortcut: 'R' },
    { type: 'circle', label: 'Circle', icon: '\u25CF', shortcut: 'C' },
    { type: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
    { type: 'frame', label: 'Frame', icon: '\u229E', shortcut: 'F' },
    { type: 'line', label: 'Line', icon: '\u2014', shortcut: 'L' },
    { type: 'arrow', label: 'Arrow', icon: '\u2192', shortcut: 'A' },
  ]

  const hasSelection = selectedIds.size > 0

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
            if (hasSelection) {
              for (const id of selectedIds) deleteObject(id)
              setSelectedIds(new Set())
            }
          }}
          style={{
            ...toolBtnStyle,
            color: hasSelection ? '#EF4444' : '#d1d5db',
          }}
          title="Delete (Del)"
          disabled={!hasSelection}
        >
          <span style={{ fontSize: 16 }}>&#128465;</span>
          <span style={{ fontSize: 9, marginTop: 2 }}>Del</span>
        </button>

        {/* Color button */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          style={{
            ...toolBtnStyle,
            position: 'relative',
            color: hasSelection ? '#374151' : '#d1d5db',
          }}
          title="Color"
          disabled={!hasSelection}
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
      {showColorPicker && hasSelection && (
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
        {/* Always show the local user avatar */}
        <div style={{ width: 1, height: 16, background: '#e5e7eb' }} />
        <span
          title={`${userName} (You)`}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: userColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px #2563EB',
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </span>
        {/* Remote user avatars */}
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
      </div>

      {/* Multi-select count badge */}
      {selectedIds.size > 1 && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          background: '#2563EB',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
        }}>
          {selectedIds.size} selected
        </div>
      )}

      {/* Line / Arrow tool hint */}
      {(activeTool === 'line' || activeTool === 'arrow') && (
        <div style={{
          position: 'absolute',
          bottom: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          background: '#1E293B',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}>
          {lineStart
            ? `Click to set endpoint (or click a shape to connect) \u2014 ${activeTool === 'arrow' ? 'Arrow' : 'Line'}`
            : `Click to set start point (or click a shape to connect from) \u2014 ${activeTool === 'arrow' ? 'Arrow' : 'Line'}`}
        </div>
      )}

      {/* Zoom controls (bottom right) */}
      <div style={zoomControlsStyle}>
        <button onClick={zoomOut} style={zoomBtnStyle} title="Zoom Out">&minus;</button>
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
        draggable={activeTool === 'select' && !lineStart && !selectionStartRef.current}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onMouseMove={handleMouseMove}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
        onTap={handleStageClick as any}
        style={{ position: 'relative', zIndex: 1, cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
      >
        {/* Objects layer */}
        <Layer>
          {visibleObjects.map((obj) =>
            obj.type === 'line' ? (
              <Connector
                key={obj.id}
                obj={obj}
                isSelected={selectedIds.has(obj.id)}
                onSelect={handleSelectOrConnect}
                onUpdate={updateObject}
                allObjects={objects}
                scale={scale}
              />
            ) : (
              <BoardShape
                key={obj.id}
                obj={obj}
                isSelected={selectedIds.has(obj.id)}
                onSelect={handleSelectOrConnect}
                onUpdate={updateObject}
                stageRef={stageRef}
                scale={scale}
                stagePos={stagePos}
                selectedIds={selectedIds}
                onGroupDragEnd={handleGroupDragEnd}
              />
            )
          )}

          {/* Multi-select bounding box */}
          {selectionBounds && (
            <KonvaRect
              x={selectionBounds.x}
              y={selectionBounds.y}
              width={selectionBounds.w}
              height={selectionBounds.h}
              stroke="#2563EB"
              strokeWidth={1.5 / scale}
              fill="transparent"
              dash={[8 / scale, 4 / scale]}
              listening={false}
            />
          )}

          {/* Rubber-band selection rectangle */}
          {selectionRect && (
            <KonvaRect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.w}
              height={selectionRect.h}
              stroke="#2563EB"
              strokeWidth={1 / scale}
              fill="rgba(37, 99, 235, 0.08)"
              listening={false}
            />
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

// ---- Remote cursor display ------------------------------------------------

function CursorBadge({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  const labelWidth = name.length * 7 + 10
  return (
    <>
      {/* Cursor pointer shape */}
      <Line
        points={[x, y, x + 2, y + 12, x + 5, y + 9, x + 10, y + 14, x + 12, y + 12, x + 7, y + 7, x + 11, y + 5, x, y]}
        fill={color}
        stroke={color}
        strokeWidth={1}
        closed
      />
      {/* Name label background */}
      <KonvaRect
        x={x + 14}
        y={y}
        width={labelWidth}
        height={18}
        fill={color}
        cornerRadius={4}
      />
      {/* Name label text */}
      <KonvaText
        x={x + 14}
        y={y}
        text={name}
        fontSize={11}
        fill="#fff"
        padding={3}
      />
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
