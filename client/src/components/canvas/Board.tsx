import { useRef, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Line, Text, Group } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../../../shared/types'
import { useUiStore } from '../../stores/uiStore'
import { DotGrid } from './DotGrid'
import { StickyNote } from './StickyNote'
import { CanvasObject } from './CanvasObject'

interface BoardProps {
  objects: Map<string, BoardObject>
  onObjectUpdate: (id: string, fields: Partial<BoardObject>) => void
  onObjectCreate: (x: number, y: number) => void
  onCursorMove: (x: number, y: number) => void
  children?: React.ReactNode
}

export function Board({ objects, onObjectUpdate, onObjectCreate, onCursorMove, children }: BoardProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const { viewport, setViewport, activeTool, clearSelection } = useUiStore()

  // Pan: wheel with no modifier, or middle-mouse drag (via Stage draggable)
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      // Zoom with Ctrl/Cmd + scroll
      if (e.evt.ctrlKey || e.evt.metaKey) {
        const scaleBy = 1.08
        const oldScale = stage.scaleX()
        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale,
        }

        const direction = e.evt.deltaY > 0 ? -1 : 1
        const newScale = Math.min(4, Math.max(0.1, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy))

        setViewport({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
          scale: newScale,
        })
      } else {
        // Pan with regular scroll
        setViewport({
          x: viewport.x - e.evt.deltaX,
          y: viewport.y - e.evt.deltaY,
          scale: viewport.scale,
        })
      }
    },
    [viewport, setViewport]
  )

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Click on empty area
      if (e.target === e.target.getStage()) {
        clearSelection()

        if (activeTool !== 'select') {
          const stage = stageRef.current
          if (!stage) return
          const pointer = stage.getPointerPosition()
          if (!pointer) return

          // Convert screen coords to board coords
          const x = (pointer.x - viewport.x) / viewport.scale
          const y = (pointer.y - viewport.y) / viewport.scale
          onObjectCreate(x, y)
        }
      }
    },
    [activeTool, clearSelection, onObjectCreate, viewport]
  )

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const x = (pointer.x - viewport.x) / viewport.scale
      const y = (pointer.y - viewport.y) / viewport.scale
      onCursorMove(x, y)
    },
    [onCursorMove, viewport]
  )

  // Sort objects by zIndex for rendering
  const sortedObjects = Array.from(objects.values()).sort((a, b) => a.zIndex - b.zIndex)

  return (
    <Stage
      ref={stageRef}
      width={window.innerWidth}
      height={window.innerHeight}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      onWheel={handleWheel}
      onClick={handleStageClick}
      onMouseMove={handleMouseMove}
    >
      {/* Background layer — static */}
      <Layer listening={false}>
        <DotGrid viewport={viewport} />
      </Layer>

      {/* Objects layer */}
      <Layer>
        {sortedObjects.map((obj) => (
          <CanvasObject
            key={obj.id}
            object={obj}
            onUpdate={(fields) => onObjectUpdate(obj.id, fields)}
          />
        ))}
      </Layer>

      {/* Cursors layer (passed as children) */}
      <Layer>
        {children}
      </Layer>
    </Stage>
  )
}
