/**
 * Toolbar — Left vertical tool selector + delete + color toggle.
 *
 * Pure presentational component. Receives active tool and callbacks,
 * renders tool buttons with keyboard shortcut labels.
 */

import type { ToolType } from '../types'

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Array<{ type: ToolType; label: string; icon: string; shortcut: string }> = [
  { type: 'select', label: 'Select', icon: '\u2196', shortcut: 'V' },
  { type: 'sticky', label: 'Sticky', icon: '\u2610', shortcut: 'S' },
  { type: 'rect', label: 'Rect', icon: '\u25AC', shortcut: 'R' },
  { type: 'circle', label: 'Circle', icon: '\u25CF', shortcut: 'C' },
  { type: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
  { type: 'frame', label: 'Frame', icon: '\u229E', shortcut: 'F' },
  { type: 'line', label: 'Line', icon: '\u2014', shortcut: 'L' },
  { type: 'arrow', label: 'Arrow', icon: '\u2192', shortcut: 'A' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ToolbarProps {
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
  hasSelection: boolean
  onDelete: () => void
  onColorToggle: () => void
  selectedFill: string | null
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onHelpToggle?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Toolbar({
  activeTool,
  onToolChange,
  hasSelection,
  onDelete,
  onColorToggle,
  selectedFill,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onHelpToggle,
}: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          onClick={() => onToolChange(tool.type)}
          style={{
            ...toolBtnStyle,
            background: activeTool === tool.type ? '#EBF5FF' : 'transparent',
            color: activeTool === tool.type ? '#2563EB' : '#64748B',
            border: activeTool === tool.type ? '1px solid #BFDBFE' : '1px solid transparent',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          title={`${tool.label} (${tool.shortcut})`}
          aria-label={`${tool.label} tool`}
        >
          <span style={{ fontSize: 18, lineHeight: '1' }}>{tool.icon}</span>
          <span style={{ fontSize: 9, marginTop: 2 }}>{tool.shortcut}</span>
        </button>
      ))}

      {/* Divider */}
      <div style={{ width: '70%', height: 1, background: '#e5e7eb', margin: '4px auto' }} />

      {/* Delete button */}
      <button
        onClick={onDelete}
        style={{
          ...toolBtnStyle,
          color: hasSelection ? '#EF4444' : '#d1d5db',
        }}
        title="Delete (Del)"
        aria-label="Delete selected objects"
        disabled={!hasSelection}
      >
        <span style={{ fontSize: 16 }}>&#128465;</span>
        <span style={{ fontSize: 9, marginTop: 2 }}>Del</span>
      </button>

      {/* Color button */}
      <button
        onClick={onColorToggle}
        style={{
          ...toolBtnStyle,
          position: 'relative',
          color: hasSelection ? '#374151' : '#d1d5db',
        }}
        title="Color"
        aria-label="Change color"
        disabled={!hasSelection}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: selectedFill || '#ccc',
            border: '2px solid #e5e7eb',
            display: 'block',
          }}
        />
        <span style={{ fontSize: 9, marginTop: 2 }}>Color</span>
      </button>

      {/* Divider */}
      <div style={{ width: '70%', height: 1, background: '#e5e7eb', margin: '4px auto' }} />

      {/* Undo button */}
      <button
        onClick={onUndo}
        style={{
          ...toolBtnStyle,
          color: canUndo ? '#374151' : '#d1d5db',
        }}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!canUndo}
      >
        <span style={{ fontSize: 16 }}>&#8630;</span>
        <span style={{ fontSize: 9, marginTop: 2 }}>Undo</span>
      </button>

      {/* Redo button */}
      <button
        onClick={onRedo}
        style={{
          ...toolBtnStyle,
          color: canRedo ? '#374151' : '#d1d5db',
        }}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        disabled={!canRedo}
      >
        <span style={{ fontSize: 16 }}>&#8631;</span>
        <span style={{ fontSize: 9, marginTop: 2 }}>Redo</span>
      </button>

      {/* Divider */}
      <div style={{ width: '70%', height: 1, background: '#e5e7eb', margin: '4px auto' }} />

      {/* Help button */}
      <button
        onClick={onHelpToggle}
        style={{
          ...toolBtnStyle,
          color: '#64748B',
        }}
        title="Keyboard Shortcuts (?)"
        aria-label="Show keyboard shortcuts"
      >
        <span style={{ fontSize: 16 }}>?</span>
        <span style={{ fontSize: 9, marginTop: 2 }}>Help</span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 12,
  transform: 'translateY(-50%)',
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  background: '#fff',
  padding: '8px 6px',
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
  border: '1px solid #e5e7eb',
}

const toolBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  padding: 0,
  fontFamily: "'DM Sans', system-ui, sans-serif",
}
