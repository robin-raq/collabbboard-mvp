import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const [boards] = useState<{ id: string; name: string }[]>([])

  const handleCreateBoard = () => {
    // For MVP: generate a random board ID and navigate directly
    const boardId = crypto.randomUUID()
    navigate(`/board/${boardId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">CollabBoard AI</h1>
          <UserButton />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Your Boards</h2>
          <button
            onClick={handleCreateBoard}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            + New Board
          </button>
        </div>

        {boards.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500 mb-4">No boards yet. Create your first board to get started.</p>
            <button
              onClick={handleCreateBoard}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Create Board
            </button>
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
