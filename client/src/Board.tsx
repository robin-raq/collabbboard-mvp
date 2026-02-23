import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Rect as KonvaRect } from 'react-konva'
import type Konva from 'konva'
import { useYjs } from './useYjs'
import BoardShape from './BoardShape'
import Connector from './Connector'
import ChatPanel from './components/ChatPanel'
import Toolbar from './components/Toolbar'
import ColorPicker from './components/ColorPicker'
import PresenceBar from './components/PresenceBar'
import ZoomControls from './components/ZoomControls'
import CursorBadge from './components/CursorBadge'
import HelpPanel from './components/HelpPanel'
import type { BoardObject, ToolType } from './types'
import { cullObjects, type Viewport } from './utils/viewportCulling'
import { intersects, normalizeRect, getSelectionBounds, type SelectionRect } from './utils/selection'
import { copyObjects, pasteObjects, type ClipboardState } from './utils/clipboard'

// ---------------------------------------------------------------------------
// Frame grouping: detect which frame (if any) fully contains an object
// ---------------------------------------------------------------------------

/** Returns the ID of the smallest enclosing frame, or undefined if none. */
export function detectParentFrame(
  id: string,
  updatedObj: { x: number; y: number; width: number; height: number; type: string },
  allObjects: BoardObject[],
): string | undefined {
  if (updatedObj.type === 'frame') return undefined // frames don't nest

  let bestFrame: { id: string; area: number } | null = null
  for (const frame of allObjects) {
    if (frame.type !== 'frame' || frame.id === id) continue
    const inside =
      updatedObj.x >= frame.x &&
      updatedObj.y >= frame.y &&
      updatedObj.x + updatedObj.width <= frame.x + frame.width &&
      updatedObj.y + updatedObj.height <= frame.y + frame.height
    if (inside) {
      const area = frame.width * frame.height
      if (!bestFrame || area < bestFrame.area) {
        bestFrame = { id: frame.id, area }
      }
    }
  }
  return bestFrame?.id
}
import {
  USER_COLORS,
  ZOOM_SCALE_FACTOR,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  GRID_SIZE,
  SHAPE_DEFAULTS,
  LINE_COLOR,
  MAX_RENDERED_OBJECTS,
} from './constants'

const DEBUG = import.meta.env.DEV

interface BoardProps {
  userName: string
  boardId?: string
}

export default function Board({ userName, boardId }: BoardProps) {
  const userColor = USER_COLORS[Math.abs(userName.charCodeAt(0)) % USER_COLORS.length]

  const { objects, remoteCursors, connected, createObject, updateObject, deleteObject, setCursor, undo, redo, canUndo, canRedo } =
    useYjs(boardId || 'mvp-board-1', userName, userColor)

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
  // Space-to-pan and middle-mouse pan
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [middlePanning, setMiddlePanning] = useState(false)
  // Track whether a rubber-band drag just completed, so onClick skips
  const didRubberBandRef = useRef(false)
  // Clipboard for copy/paste
  const clipboardRef = useRef<ClipboardState | null>(null)
  // AI Chat panel
  const [showChat, setShowChat] = useState(false)
  // Help panel
  const [showHelp, setShowHelp] = useState(false)

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

  // Prevent default middle-click auto-scroll (browser "scroll ball" behavior)
  useEffect(() => {
    const preventMiddleClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }
    window.addEventListener('mousedown', preventMiddleClick)
    return () => window.removeEventListener('mousedown', preventMiddleClick)
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
    const culled = cullObjects(objects, viewport, 50, MAX_RENDERED_OBJECTS, selectedIds)
    if (DEBUG) console.log(`[CULL] ${culled.length}/${objects.length} objects visible`)
    return culled
  }, [objects, viewport, selectedIds])

  // Get selected object for color picker / context
  const selectedObj = useMemo(
    () => objects.find((o) => o.id === selectedId) ?? null,
    [objects, selectedId],
  )

  // ---- Zoom & scroll pan ---------------------------------------------------
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      // Ctrl+wheel (or pinch) = zoom; plain wheel = pan
      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Zoom (pinch-to-zoom on trackpads sends ctrlKey)
        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const oldScale = scale
        const newScale = e.evt.deltaY > 0
          ? Math.max(ZOOM_MIN, oldScale / ZOOM_SCALE_FACTOR)
          : Math.min(ZOOM_MAX, oldScale * ZOOM_SCALE_FACTOR)

        const mousePointTo = {
          x: (pointer.x - stagePos.x) / oldScale,
          y: (pointer.y - stagePos.y) / oldScale,
        }

        setScale(newScale)
        setStagePos({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        })
      } else {
        // Plain scroll = pan (two-finger trackpad drag or mouse wheel)
        setStagePos((prev) => ({
          x: prev.x - e.evt.deltaX,
          y: prev.y - e.evt.deltaY,
        }))
      }
    },
    [scale, stagePos],
  )

  // ---- Pan (middle-mouse / right-click drag) ------------------------------
  const panStartRef = useRef<{ x: number; y: number; stageX: number; stageY: number } | null>(null)

  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Middle-mouse pan
      if (panStartRef.current) {
        const rawPointer = stage.getPointerPosition()
        if (rawPointer) {
          setStagePos({
            x: panStartRef.current.stageX + (rawPointer.x - panStartRef.current.x),
            y: panStartRef.current.stageY + (rawPointer.y - panStartRef.current.y),
          })
        }
        return // don't update cursor or rubber-band while panning
      }

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
      // Middle-mouse drag = pan (works anywhere on canvas, even over objects)
      if (e.evt.button === 1) {
        const stage = stageRef.current
        if (stage) {
          const pointer = stage.getPointerPosition()
          if (pointer) {
            panStartRef.current = {
              x: pointer.x,
              y: pointer.y,
              stageX: stagePos.x,
              stageY: stagePos.y,
            }
            setMiddlePanning(true)
          }
        }
        return
      }

      if (e.target !== e.target.getStage()) return

      // Space + left-click drag = pan
      if (spaceHeld) {
        const stage = stageRef.current
        if (stage) {
          const pointer = stage.getPointerPosition()
          if (pointer) {
            panStartRef.current = {
              x: pointer.x,
              y: pointer.y,
              stageX: stagePos.x,
              stageY: stagePos.y,
            }
          }
        }
        return
      }

      // Left-click in select mode = rubber-band selection
      if (activeTool !== 'select') return
      if (lineStart) return

      const world = pointerToWorld()
      if (!world) return

      selectionStartRef.current = { x: world.x, y: world.y }
    },
    [activeTool, lineStart, pointerToWorld, stagePos, spaceHeld],
  )

  // ---- Rubber-band selection: mouse up on stage ----------------------------
  const handleStageMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // End space-to-pan or middle-mouse pan
      if (panStartRef.current) {
        panStartRef.current = null
        setMiddlePanning(false)
        didRubberBandRef.current = true // suppress the click that follows
        return
      }

      if (selectionStartRef.current) {
        if (selectionRect && (selectionRect.w > 5 || selectionRect.h > 5)) {
          const selected = objects.filter((obj) => intersects(obj, selectionRect))
          setSelectedIds(new Set(selected.map((o) => o.id)))
          didRubberBandRef.current = true // suppress the click that follows
        }
        setSelectionRect(null)
        selectionStartRef.current = null
      }
    },
    [selectionRect, objects],
  )

  // ---- Click on empty canvas = deselect or create object -------------------
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Only handle clicks on the stage itself (empty space)
      if (e.target !== e.target.getStage()) return

      // Skip if a rubber-band drag or pan just finished — the click is
      // an artefact of the mousedown→mousemove→mouseup sequence.
      if (didRubberBandRef.current) {
        didRubberBandRef.current = false
        return
      }

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
            fill: LINE_COLOR,
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
      const d = SHAPE_DEFAULTS[activeTool] ?? SHAPE_DEFAULTS.rect
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
          fill: LINE_COLOR,
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
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            redo()
          }
          break
        case 'v':
          if ((e.ctrlKey || e.metaKey) && clipboardRef.current) {
            e.preventDefault()
            const { objects: newObjs, newPasteCount } = pasteObjects(clipboardRef.current)
            clipboardRef.current = { ...clipboardRef.current, pasteCount: newPasteCount }
            const pastedIds = new Set<string>()
            for (const obj of newObjs) {
              createObject(obj)
              pastedIds.add(obj.id)
            }
            setSelectedIds(pastedIds)
          } else if (!e.ctrlKey && !e.metaKey) {
            setActiveTool('select')
          }
          break
        case 's': setActiveTool('sticky'); break
        case 'r': setActiveTool('rect'); break
        case 'c':
          if ((e.ctrlKey || e.metaKey) && selectedIds.size > 0) {
            e.preventDefault()
            const result = copyObjects(objects, selectedIds)
            if (result) clipboardRef.current = result
          } else if (!e.ctrlKey && !e.metaKey) {
            setActiveTool('circle')
          }
          break
        case 't': setActiveTool('text'); break
        case 'f': setActiveTool('frame'); break
        case 'l': setActiveTool('line'); setLineStart(null); break
        case 'delete':
        case 'backspace':
          if (selectedIds.size > 0) {
            for (const id of selectedIds) {
              // If deleting a frame, also delete its children
              const selected = objects.find((o) => o.id === id)
              if (selected?.type === 'frame') {
                for (const child of objects) {
                  if (child.parentId === id) deleteObject(child.id)
                }
              }
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
            const allIds = objects.map((o) => o.id)
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

    // Space-to-pan: track space bar hold
    const spaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const spaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', spaceDown)
    window.addEventListener('keyup', spaceUp)

    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keydown', spaceDown)
      window.removeEventListener('keyup', spaceUp)
    }
  }, [selectedIds, deleteObject, objects, createObject, undo, redo])

  // ---- Zoom controls ------------------------------------------------------
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(ZOOM_MAX, s * ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(ZOOM_MIN, s / ZOOM_STEP))
  }, [])

  const zoomReset = useCallback(() => {
    setScale(1)
    setStagePos({ x: 0, y: 0 })
  }, [])

  // ---- Frame-aware update: when a frame moves, move its children too ------
  const handleObjectUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      const obj = objects.find((o) => o.id === id)

      // If this is a frame being repositioned, move all children by the same delta
      if (obj && obj.type === 'frame' && updates.x !== undefined && updates.y !== undefined) {
        const dx = updates.x - obj.x
        const dy = updates.y - obj.y

        if (dx !== 0 || dy !== 0) {
          // Move all children whose parentId matches this frame
          for (const child of objects) {
            if (child.parentId === id) {
              updateObject(child.id, { x: child.x + dx, y: child.y + dy })
            }
          }
        }
      }

      // Auto-detect parent frame when a non-frame object is repositioned
      if (obj && obj.type !== 'frame' && updates.x !== undefined && updates.y !== undefined) {
        const merged = { ...obj, ...updates }
        const newParent = detectParentFrame(id, merged, objects)
        if (newParent !== obj.parentId) {
          updates = { ...updates, parentId: newParent }
        }
      }

      updateObject(id, updates)
    },
    [objects, updateObject],
  )

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

  // ---- Toolbar callbacks --------------------------------------------------
  const handleDelete = useCallback(() => {
    for (const id of selectedIds) {
      // If deleting a frame, also delete its children
      const obj = objects.find((o) => o.id === id)
      if (obj?.type === 'frame') {
        for (const child of objects) {
          if (child.parentId === id) deleteObject(child.id)
        }
      }
      deleteObject(id)
    }
    setSelectedIds(new Set())
  }, [selectedIds, objects, deleteObject])

  const handleColorToggle = useCallback(() => {
    setShowColorPicker((prev) => !prev)
  }, [])

  // ---- Multi-select bounding box ------------------------------------------
  const selectionBounds = useMemo(() => {
    if (selectedIds.size <= 1) return null
    const selected = objects.filter((o) => selectedIds.has(o.id))
    return getSelectionBounds(selected)
  }, [selectedIds, objects])

  const hasSelection = selectedIds.size > 0

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Dot grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
          backgroundPosition: `${stagePos.x % (GRID_SIZE * scale)}px ${stagePos.y % (GRID_SIZE * scale)}px`,
          zIndex: 0,
        }}
      />

      {/* Left vertical toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        hasSelection={hasSelection}
        onDelete={handleDelete}
        onColorToggle={handleColorToggle}
        selectedFill={selectedObj?.fill ?? null}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onHelpToggle={() => setShowHelp((v) => !v)}
      />

      {/* Color picker popup */}
      {showColorPicker && hasSelection && (
        <ColorPicker
          currentFill={selectedObj?.fill ?? null}
          onColorChange={handleColorChange}
        />
      )}

      {/* Presence bar (top right) */}
      <PresenceBar
        connected={connected}
        userName={userName}
        userColor={userColor}
        remoteCursors={remoteCursors}
        chatOpen={showChat}
      />

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
          fontFamily: "'DM Sans', system-ui, sans-serif",
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
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          {lineStart
            ? `Click to set endpoint (or click a shape to connect) \u2014 ${activeTool === 'arrow' ? 'Arrow' : 'Line'}`
            : `Click to set start point (or click a shape to connect from) \u2014 ${activeTool === 'arrow' ? 'Arrow' : 'Line'}`}
        </div>
      )}

      {/* Zoom controls (bottom right) */}
      <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onZoomReset={zoomReset} chatOpen={showChat} />

      {/* Canvas */}
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ position: 'relative', zIndex: 1, cursor: middlePanning ? 'grabbing' : spaceHeld ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair' }}
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
                onUpdate={handleObjectUpdate}
                allObjects={objects}
                scale={scale}
              />
            ) : (
              <BoardShape
                key={obj.id}
                obj={obj}
                isSelected={selectedIds.has(obj.id)}
                onSelect={handleSelectOrConnect}
                onUpdate={handleObjectUpdate}
                stageRef={stageRef}
                scale={scale}
                stagePosX={stagePos.x}
                stagePosY={stagePos.y}
                isMultiSelected={selectedIds.size > 1 && selectedIds.has(obj.id)}
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

      {/* AI Chat toggle button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          style={chatToggleBtnStyle}
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          AI
        </button>
      )}

      {/* AI Chat panel */}
      {showChat && (
        <ChatPanel
          boardId={boardId || 'mvp-board-1'}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Help panel */}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  )
}

// ---- Styles ---------------------------------------------------------------

const chatToggleBtnStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 80,
  right: 24,
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
  zIndex: 90,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  transition: 'transform 0.2s, box-shadow 0.2s',
  animation: 'ai-pulse 2s ease-in-out 3',
}
