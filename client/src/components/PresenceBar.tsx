/**
 * PresenceBar — Top-right connection status + user avatars.
 *
 * Shows connected/disconnected status, the local user avatar,
 * and up to 5 remote user avatars with overflow count.
 */

import type { RemoteCursor } from '../useYjs'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresenceBarProps {
  connected: boolean
  userName: string
  userColor: string
  remoteCursors: RemoteCursor[]
  chatOpen?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PresenceBar({ connected, userName, userColor, remoteCursors, chatOpen }: PresenceBarProps) {
  return (
    <div style={{ ...presenceStyle, right: chatOpen ? 366 : 12 }}>
      {/* Connection indicator */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? '#22c55e' : '#ef4444',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={{ color: '#374151', fontSize: 13 }}>
        {connected ? 'Connected' : 'Connecting...'}
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: '#e5e7eb' }} />

      {/* Local user avatar */}
      <span
        title={`${userName} (You)`}
        style={{
          ...avatarStyle,
          background: userColor,
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px #2563EB',
        }}
      >
        {userName.charAt(0).toUpperCase()}
      </span>

      {/* Remote user avatars (max 5) */}
      {remoteCursors.slice(0, 5).map((rc) => (
        <span key={rc.clientId} title={rc.name} style={{ ...avatarStyle, background: rc.color }}>
          {rc.name.charAt(0).toUpperCase()}
        </span>
      ))}

      {/* Overflow count */}
      {remoteCursors.length > 5 && (
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          +{remoteCursors.length - 5}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const presenceStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 40,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  background: '#fff',
  padding: '6px 14px',
  borderRadius: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
}

const avatarStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
  flexShrink: 0,
  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
}
