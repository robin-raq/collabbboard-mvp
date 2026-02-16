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

  return (
    <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-md border border-gray-200">
      <button
        onClick={zoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
        title="Zoom out"
      >
        −
      </button>
      <button
        onClick={resetView}
        className="flex h-8 min-w-[3rem] items-center justify-center rounded-md text-xs text-gray-600 hover:bg-gray-100"
        title="Reset view"
      >
        {percentage}%
      </button>
      <button
        onClick={zoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
        title="Zoom in"
      >
        +
      </button>
    </div>
  )
}
