/**
 * HelpPanel — Keyboard shortcuts & features overlay.
 *
 * Shows all available keyboard shortcuts and features in a clean
 * floating panel. Toggled via the ? button in the toolbar.
 */

interface HelpPanelProps {
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'V', description: 'Select tool' },
  { keys: 'S', description: 'Sticky note tool' },
  { keys: 'R', description: 'Rectangle tool' },
  { keys: 'C', description: 'Circle tool' },
  { keys: 'T', description: 'Text tool' },
  { keys: 'F', description: 'Frame tool' },
  { keys: 'L', description: 'Line tool' },
  { keys: 'A', description: 'Arrow tool' },
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+Shift+Z', description: 'Redo' },
  { keys: 'Ctrl+Y', description: 'Redo (alt)' },
  { keys: 'Ctrl+C', description: 'Copy selected objects' },
  { keys: 'Ctrl+V', description: 'Paste with offset' },
  { keys: 'Ctrl+D', description: 'Duplicate selected' },
  { keys: 'Ctrl+A', description: 'Select all objects' },
  { keys: 'Delete', description: 'Delete selected' },
  { keys: 'Escape', description: 'Deselect / cancel' },
  { keys: 'Space+Drag', description: 'Pan canvas' },
]

const FEATURES: string[] = [
  'Real-time collaboration with live cursors',
  'AI assistant — type natural language commands',
  'Copy/paste with stacking offsets',
  'Undo/redo (local changes only)',
  'Frames group child objects',
  'Connector lines & arrows between objects',
  'Drag to rubber-band select multiple objects',
  'Scroll/trackpad to pan, Ctrl+scroll to zoom',
]

export default function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Keyboard Shortcuts & Features</span>
          <button onClick={onClose} style={closeBtnStyle} title="Close" aria-label="Close help panel">
            &times;
          </button>
        </div>

        {/* Shortcuts */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Keyboard Shortcuts</h3>
          <div style={gridStyle}>
            {SHORTCUTS.map((s) => (
              <div key={s.keys} style={rowStyle}>
                <kbd style={kbdStyle}>{s.keys}</kbd>
                <span style={descStyle}>{s.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Features</h3>
          <ul style={listStyle}>
            {FEATURES.map((f) => (
              <li key={f} style={listItemStyle}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.3)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  width: 480,
  maxHeight: '80vh',
  overflowY: 'auto',
  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #e5e7eb',
  background: '#1E293B',
  color: '#fff',
  borderRadius: '16px 16px 0 0',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.7)',
  padding: '0 4px',
  lineHeight: 1,
}

const sectionStyle: React.CSSProperties = {
  padding: '16px 20px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 12,
  marginTop: 0,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px 16px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 60,
  padding: '3px 8px',
  background: '#F1F5F9',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  color: '#334155',
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
}

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#374151',
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
}

const listItemStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#374151',
  lineHeight: 1.8,
}
