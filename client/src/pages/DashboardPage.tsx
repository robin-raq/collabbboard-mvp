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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">CollabBoard AI</h1>
          {clerkKey && <UserButton />}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Your Boards</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCreateBoard}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              + New Board
            </button>
            <button
              onClick={handleShareBoard}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
            >
              📋 Share Board
            </button>
          </div>
        </div>

        {boards.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500 mb-4">Create a new board or generate a share link to collaborate with others.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleCreateBoard}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                Create Board
              </button>
              <button
                onClick={handleShareBoard}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
              >
                Share Board
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="font-medium text-gray-800">{board.name}</h3>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
