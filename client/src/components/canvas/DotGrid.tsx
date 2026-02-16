import { useMemo } from 'react'
import { Circle, Group } from 'react-konva'

interface DotGridProps {
  viewport: { x: number; y: number; scale: number }
}

const DOT_SPACING = 40
const DOT_RADIUS = 1.5
const DOT_COLOR = '#CBD5E1'

export function DotGrid({ viewport }: DotGridProps) {
  const dots = useMemo(() => {
    const { x, y, scale } = viewport
    const width = window.innerWidth
    const height = window.innerHeight

    // Calculate visible area in board space
    const startX = Math.floor(-x / scale / DOT_SPACING) * DOT_SPACING - DOT_SPACING
    const startY = Math.floor(-y / scale / DOT_SPACING) * DOT_SPACING - DOT_SPACING
    const endX = startX + width / scale + DOT_SPACING * 2
    const endY = startY + height / scale + DOT_SPACING * 2

    const result: { x: number; y: number }[] = []
    for (let dx = startX; dx <= endX; dx += DOT_SPACING) {
      for (let dy = startY; dy <= endY; dy += DOT_SPACING) {
        result.push({ x: dx, y: dy })
      }
    }
    return result
  }, [viewport])

  return (
    <Group>
      {dots.map((dot, i) => (
        <Circle
          key={i}
          x={dot.x}
          y={dot.y}
          radius={DOT_RADIUS / viewport.scale}
          fill={DOT_COLOR}
        />
      ))}
    </Group>
  )
}
