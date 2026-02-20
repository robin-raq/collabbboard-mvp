/**
 * BoardPage — Wrapper for the canvas board
 *
 * Extracts the board ID from URL params, provides auth context,
 * and renders the Board component with a header bar.
 */

import { useParams, Link } from 'react-router-dom'
import { useUser, SignOutButton } from '@clerk/clerk-react'
import Board from '../Board'

export default function BoardPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
    'User'

  return (
    <div style={styles.container}>
      {/* Board header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link to="/" style={styles.backLink}>
            &larr; Boards
          </Link>
        </div>
        <div style={styles.headerRight}>
          <SignOutButton>
            <button style={styles.signOutBtn}>Sign Out</button>
          </SignOutButton>
        </div>
      </header>

      {/* Canvas */}
      <div style={styles.boardWrapper}>
        <Board userName={userName} boardId={id} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    zIndex: 100,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backLink: {
    textDecoration: 'none',
    color: '#2563EB',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    color: '#6b7280',
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
  boardWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
}
