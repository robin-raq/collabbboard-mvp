/**
 * ColorPicker — Popup grid of color swatches.
 *
 * Appears next to the toolbar when the color button is clicked.
 * Calls onColorChange with the selected CSS color string.
 */

import { SHAPE_COLORS } from '../constants'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  currentFill: string | null
  onColorChange: (color: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ColorPicker({ currentFill, onColorChange }: ColorPickerProps) {
  return (
    <div style={colorPickerStyle}>
      {SHAPE_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: color,
            border: currentFill === color ? '2px solid #2563EB' : '2px solid #e5e7eb',
            cursor: 'pointer',
            padding: 0,
          }}
          title={color}
          aria-label={`Set color to ${color}`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
