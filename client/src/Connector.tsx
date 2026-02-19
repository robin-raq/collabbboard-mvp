import { useCallback, memo } from 'react'
import { Group, Line, Arrow, Rect, Circle } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from './types'

const HANDLE_RADIUS = 5

interface Props {
  obj: BoardObject
  isSelected: boolean
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  allObjects: BoardObject[]
  scale: number
}

/**
 * Get the center point of a shape for connector attachment.
 */
function getObjectCenter(obj: BoardObject): { x: number; y: number } {
  return {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  }
}

/**
 * Get the edge intersection point where a line from center hits the bounding box.
 * This makes connectors attach to the nearest edge instead of always the center.
 */
function getEdgePoint(
  obj: BoardObject,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2
  const dx = targetX - cx
  const dy = targetY - cy

  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const hw = obj.width / 2
  const hh = obj.height / 2

  // For circles, use radius intersection
  if (obj.type === 'circle') {
    const dist = Math.sqrt(dx * dx + dy * dy)
    const r = Math.min(hw, hh)
    if (dist === 0) return { x: cx, y: cy }
    return {
      x: cx + (dx / dist) * r,
      y: cy + (dy / dist) * r,
    }
  }

  // For rectangles/other shapes, find edge intersection
  const scaleX = Math.abs(dx) / hw
  const scaleY = Math.abs(dy) / hh
  const s = Math.max(scaleX, scaleY)

  if (s === 0) return { x: cx, y: cy }

  return {
    x: cx + dx / s,
    y: cy + dy / s,
  }
}

/**
 * Connector — renders a line or arrow between two points.
 *
 * If fromId/toId are set, endpoints auto-attach to those objects' edges.
 * Otherwise uses the raw points array.
 *
 * - Click to select
 * - Drag endpoints when selected to reposition
 * - Supports arrowhead at the end
 */
const Connector = memo(function Connector({
  obj, isSelected, onSelect, onUpdate, allObjects, scale,
}: Props) {
  // Resolve actual endpoints
  const fromObj = obj.fromId ? allObjects.find((o) => o.id === obj.fromId) : null
  const toObj = obj.toId ? allObjects.find((o) => o.id === obj.toId) : null

  // Raw points fallback
  const rawPts = obj.points ?? [0, 0, 100, 0]

  // Calculate endpoint positions
  let x1: number, y1: number, x2: number, y2: number

  if (fromObj && toObj) {
    // Both connected — use edge-to-edge
    const fromCenter = getObjectCenter(fromObj)
    const toCenter = getObjectCenter(toObj)
    const start = getEdgePoint(fromObj, toCenter.x, toCenter.y)
    const end = getEdgePoint(toObj, fromCenter.x, fromCenter.y)
    x1 = start.x
    y1 = start.y
    x2 = end.x
    y2 = end.y
  } else if (fromObj) {
    x2 = obj.x + rawPts[2]
    y2 = obj.y + rawPts[3]
    const start = getEdgePoint(fromObj, x2, y2)
    x1 = start.x
    y1 = start.y
  } else if (toObj) {
    x1 = obj.x + rawPts[0]
    y1 = obj.y + rawPts[1]
    const end = getEdgePoint(toObj, x1, y1)
    x2 = end.x
    y2 = end.y
  } else {
    // Freestanding line
    x1 = obj.x + rawPts[0]
    y1 = obj.y + rawPts[1]
    x2 = obj.x + rawPts[2]
    y2 = obj.y + rawPts[3]
  }

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    onSelect(obj.id)
  }, [obj.id, onSelect])

  // Drag start endpoint
  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const node = e.target
    const newX1 = node.x()
    const newY1 = node.y()
    node.position({ x: 0, y: 0 })
    // Update points relative to obj.x, obj.y
    onUpdate(obj.id, {
      points: [newX1 - obj.x, newY1 - obj.y, rawPts[2], rawPts[3]],
      fromId: undefined, // Detach from object when manually moved
    })
  }, [obj.id, obj.x, obj.y, rawPts, onUpdate])

  // Drag end endpoint
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const node = e.target
    const newX2 = node.x()
    const newY2 = node.y()
    node.position({ x: 0, y: 0 })
    onUpdate(obj.id, {
      points: [rawPts[0], rawPts[1], newX2 - obj.x, newY2 - obj.y],
      toId: undefined,
    })
  }, [obj.id, obj.x, obj.y, rawPts, onUpdate])

  const showArrow = obj.arrowEnd !== false // Default true

  const lineColor = obj.fill === 'transparent' ? '#374151' : obj.fill
  const hs = HANDLE_RADIUS / scale

  return (
    <Group onClick={handleClick} onTap={() => onSelect(obj.id)}>
      {/* The line/arrow itself */}
      {showArrow ? (
        <Arrow
          points={[x1, y1, x2, y2]}
          stroke={lineColor}
          strokeWidth={2}
          fill={lineColor}
          pointerLength={10}
          pointerWidth={8}
          hitStrokeWidth={12}
        />
      ) : (
        <Line
          points={[x1, y1, x2, y2]}
          stroke={lineColor}
          strokeWidth={2}
          hitStrokeWidth={12}
        />
      )}

      {/* Invisible wider hit area for easier selection */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke="transparent"
        strokeWidth={16}
        hitStrokeWidth={16}
      />

      {/* Endpoint handles when selected */}
      {isSelected && (
        <>
          <Circle
            x={x1}
            y={y1}
            radius={hs}
            fill="#fff"
            stroke="#2563EB"
            strokeWidth={1.5 / scale}
            draggable
            onDragEnd={handleDragStart}
          />
          <Circle
            x={x2}
            y={y2}
            radius={hs}
            fill="#fff"
            stroke="#2563EB"
            strokeWidth={1.5 / scale}
            draggable
            onDragEnd={handleDragEnd}
          />
          {/* Selection highlight */}
          <Rect
            x={Math.min(x1, x2) - 4}
            y={Math.min(y1, y2) - 4}
            width={Math.abs(x2 - x1) + 8}
            height={Math.abs(y2 - y1) + 8}
            stroke="#2563EB"
            strokeWidth={1 / scale}
            dash={[4 / scale, 3 / scale]}
            fill="transparent"
            listening={false}
          />
        </>
      )}
    </Group>
  )
})

export { getObjectCenter, getEdgePoint }
export default Connector
