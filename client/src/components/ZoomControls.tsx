/**
 * ZoomControls — Bottom-right zoom in/out/reset buttons.
 *
 * Displays current zoom percentage and provides +/- buttons.
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ZoomControlsProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onZoomReset }: ZoomControlsProps) {
  return (
    <div style={zoomControlsStyle}>
      <button onClick={onZoomOut} style={zoomBtnStyle} title="Zoom Out" aria-label="Zoom out">
        &minus;
      </button>
      <button
        onClick={onZoomReset}
        style={{ ...zoomBtnStyle, fontSize: 11, minWidth: 48 }}
        aria-label={`Reset zoom, currently ${Math.round(scale * 100)}%`}
      >
        {Math.round(scale * 100)}%
      </button>
      <button onClick={onZoomIn} style={zoomBtnStyle} title="Zoom In" aria-label="Zoom in">
        +
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  fontFamily: "'DM Sans', system-ui, sans-serif",
}
