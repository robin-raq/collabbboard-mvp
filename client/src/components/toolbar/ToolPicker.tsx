import { useUiStore } from '../../stores/uiStore'

const tools = [
  { id: 'select' as const, label: 'Select', icon: '↖' },
  { id: 'sticky' as const, label: 'Sticky', icon: '📋' },
  { id: 'rect' as const, label: 'Rect', icon: '◻' },
  { id: 'circle' as const, label: 'Circle', icon: '○' },
  { id: 'line' as const, label: 'Line', icon: '╱' },
  { id: 'text' as const, label: 'Text', icon: 'T' },
]

export function ToolPicker() {
  const { activeTool, setActiveTool } = useUiStore()

  return (
    <div className="flex gap-1 rounded-lg bg-white p-1 shadow-md border border-gray-200">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors ${
            activeTool === tool.id
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}
