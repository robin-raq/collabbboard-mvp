/**
 * CursorBadge — Remote user cursor rendered on the Konva canvas.
 *
 * Shows a pointer shape + colored label with the user's name.
 * Rendered inside the cursors Layer (not interactive).
 */

import { Line, Rect as KonvaRect, Text as KonvaText } from 'react-konva'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CursorBadgeProps {
  x: number
  y: number
  name: string
  color: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CursorBadge({ x, y, name, color }: CursorBadgeProps) {
  const labelWidth = name.length * 7 + 10
  return (
    <>
      {/* Cursor pointer shape */}
      <Line
        points={[
          x, y,
          x + 2, y + 12,
          x + 5, y + 9,
          x + 10, y + 14,
          x + 12, y + 12,
          x + 7, y + 7,
          x + 11, y + 5,
          x, y,
        ]}
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
