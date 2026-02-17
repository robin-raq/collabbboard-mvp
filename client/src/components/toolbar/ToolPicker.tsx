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
    <div style={{ display: 'flex', gap: '0.25rem', borderRadius: '0.5rem', backgroundColor: '#fff', padding: '0.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          style={{
            display: 'flex',
            height: '2.25rem',
            width: '2.25rem',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTool === tool.id ? '#3b82f6' : 'transparent',
            color: activeTool === tool.id ? '#fff' : '#374151',
            transition: 'all 0.2s',
          }}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}
