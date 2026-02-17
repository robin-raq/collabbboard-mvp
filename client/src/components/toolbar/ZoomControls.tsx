import { useUiStore } from '../../stores/uiStore'

export function ZoomControls() {
  const { viewport, setViewport } = useUiStore()
  const percentage = Math.round(viewport.scale * 100)

  const zoomIn = () => {
    setViewport({ ...viewport, scale: Math.min(4, viewport.scale * 1.2) })
  }

  const zoomOut = () => {
    setViewport({ ...viewport, scale: Math.max(0.1, viewport.scale / 1.2) })
  }

  const resetView = () => {
    setViewport({ x: 0, y: 0, scale: 1 })
  }

  const buttonStyle = {
    display: 'flex',
    height: '2rem',
    width: '2rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.375rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1.125rem',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderRadius: '0.5rem', backgroundColor: '#fff', padding: '0.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
      <button
        onClick={zoomOut}
        style={buttonStyle}
        title="Zoom out"
      >
        −
      </button>
      <button
        onClick={resetView}
        style={{ ...buttonStyle, width: '3rem', fontSize: '0.75rem', color: '#4b5563' }}
        title="Reset view"
      >
        {percentage}%
      </button>
      <button
        onClick={zoomIn}
        style={buttonStyle}
        title="Zoom in"
      >
        +
      </button>
    </div>
  )
}
