/**
 * Dashboard Page — Board list and management
 *
 * Shows all boards (team workspace model — everyone sees everything).
 * Users can create new boards, and owners can rename/delete their boards.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useUser, SignOutButton } from '@clerk/clerk-react'
import { boardsApi, type Board } from '../api'

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id ?? ''

  const loadBoards = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const result = await boardsApi.fetchBoards(token)
    setBoards(result)
    setLoading(false)
  }, [getToken])

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  const handleCreateBoard = async () => {
    const token = await getToken()
    if (!token) return
    const board = await boardsApi.createBoard('Untitled Board', token)
    if (board) {
      setBoards((prev) => [board, ...prev])
    }
  }

  const handleDeleteBoard = async (id: string) => {
    const token = await getToken()
    if (!token) return
    const ok = await boardsApi.deleteBoard(id, token)
    if (ok) {
      setBoards((prev) => prev.filter((b) => b.id !== id))
    }
  }

  const handleRenameBoard = async (id: string) => {
    const name = prompt('Enter new board name:')
    if (!name?.trim()) return
    const token = await getToken()
    if (!token) return
    const ok = await boardsApi.renameBoard(id, name.trim(), token)
    if (ok) {
      setBoards((prev) =>
        prev.map((b) => (b.id === id ? { ...b, name: name.trim() } : b)),
      )
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>CollabBoard</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>
            {user?.firstName ?? 'User'}
          </span>
          <SignOutButton>
            <button style={styles.signOutBtn}>Sign Out</button>
          </SignOutButton>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>All Boards</h2>
          <button onClick={handleCreateBoard} style={styles.newBoardBtn}>
            + New Board
          </button>
        </div>

        {loading ? (
          <p style={styles.loadingText}>Loading boards...</p>
        ) : boards.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No boards yet. Create one to get started!</p>
          </div>
        ) : (
          <div style={styles.boardGrid}>
            {boards.map((board) => (
              <div key={board.id} style={styles.boardCard}>
                <Link to={`/board/${board.id}`} style={styles.boardLink}>
                  <div style={styles.boardPreview} />
                  <div style={styles.boardInfo}>
                    <span style={styles.boardName}>{board.name}</span>
                    <span style={styles.boardMeta}>
                      {board.owner_id === userId ? 'You' : 'Team'} &middot;{' '}
                      {new Date(board.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
                {board.owner_id === userId && (
                  <div style={styles.boardActions}>
                    <button
                      onClick={() => handleRenameBoard(board.id)}
                      style={styles.actionBtn}
                      title="Rename board"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDeleteBoard(board.id)}
                      style={{ ...styles.actionBtn, color: '#EF4444' }}
                      title="Delete board"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1E293B',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userName: {
    fontSize: 14,
    color: '#64748B',
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    color: '#6b7280',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 24px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1E293B',
    margin: 0,
  },
  newBoardBtn: {
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    padding: 40,
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    borderRadius: 12,
    border: '1px dashed #d1d5db',
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    margin: 0,
  },
  boardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  boardCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    transition: 'box-shadow 0.15s',
  },
  boardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  boardPreview: {
    height: 120,
    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
  },
  boardInfo: {
    padding: '12px 16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  boardName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1E293B',
  },
  boardMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  boardActions: {
    display: 'flex',
    gap: 8,
    padding: '4px 16px 12px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: '#64748B',
    cursor: 'pointer',
    padding: '2px 6px',
    fontFamily: 'inherit',
  },
}
