import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const [boards] = useState<{ id: string; name: string }[]>([])
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  const handleCreateBoard = () => {
    // For MVP: generate a random board ID and navigate directly
    const boardId = crypto.randomUUID()
    navigate(`/board/${boardId}`)
  }

  const handleShareBoard = () => {
    // Generate a new board and copy the URL to clipboard
    const boardId = crypto.randomUUID()
    const boardUrl = `${window.location.origin}/board/${boardId}`

    navigator.clipboard.writeText(boardUrl).then(() => {
      alert(`✅ Board URL copied to clipboard!\n\nShare this link:\n${boardUrl}`)
      // Navigate to the board
      navigate(`/board/${boardId}`)
    })
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>CollabBoard MVP</h1>
          {clerkKey && <UserButton />}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>Your Boards</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreateBoard}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
            >
              + New Board
            </button>
            <button
              onClick={handleShareBoard}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
            >
              📋 Share Board
            </button>
          </div>
        </div>

        {boards.length === 0 ? (
          <div style={{ border: '2px dashed #d1d5db', borderRadius: '0.5rem', padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Create a new board or generate a share link to collaborate with others.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={handleCreateBoard}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Create Board
              </button>
              <button
                onClick={handleShareBoard}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Share Board
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                style={{ border: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '1.5rem', textAlign: 'left', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                <h3 style={{ fontWeight: '500', color: '#1f2937' }}>{board.name}</h3>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
