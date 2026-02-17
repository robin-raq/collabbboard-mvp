import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Board } from '../components/canvas/Board'
import { ToolPicker } from '../components/toolbar/ToolPicker'
import { ZoomControls } from '../components/toolbar/ZoomControls'
import { PresenceBar } from '../components/toolbar/PresenceBar'
import { CursorLayer } from '../components/cursors/CursorLayer'
import { ChatPanel } from '../components/chat/ChatPanel'
import { useOptionalUser } from '../hooks/useOptionalUser'
import { useLiveblocks } from '../hooks/useLiveblocks'
import { useUiStore } from '../stores/uiStore'
import type { BoardObject } from '../../../shared/types'

// Assign a random color to each user
const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { user } = useOptionalUser()
  const { activeTool, setActiveTool, toggleChat } = useUiStore()

  const localUser = useMemo(() => {
    // User is guaranteed to exist since Clerk is now required (see main.tsx)
    if (!user) {
      // This shouldn't happen in production, but provide fallback for loading state
      return {
        userId: 'loading',
        userName: 'Loading...',
        userColor: COLORS[0],
      }
    }

    return {
      userId: user.id,
      // Use firstName and lastName for full name, fallback to email
      userName: (
        [user.firstName, user.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || user.emailAddresses[0]?.emailAddress.split('@')[0] || 'User'
      ),
      userColor: COLORS[Math.abs(user.id.charCodeAt(0)) % COLORS.length],
    }
  }, [user])

  // Initialize Liveblocks with authenticated user presence
  const { objects, remoteUsers, currentUserCursor, createObject, updateObject, deleteObject, setCursor } = useLiveblocks({
    userId: localUser.userId,
    userName: localUser.userName,
    userColor: localUser.userColor,
  })

  const handleObjectUpdate = useCallback(
    (id: string, fields: Partial<BoardObject>) => {
      updateObject(id, fields)
    },
    [updateObject]
  )

  const handleObjectCreate = useCallback(
    (x: number, y: number) => {
      if (activeTool === 'select') return
      createObject({ type: activeTool as BoardObject['type'], x, y }, localUser.userId)
      setActiveTool('select') // Switch back to select after creating
    },
    [activeTool, setActiveTool, createObject, localUser.userId]
  )

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      setCursor(x, y)
    },
    [setCursor]
  )

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        const { selectedIds, clearSelection } = useUiStore.getState()
        for (const id of selectedIds) {
          deleteObject(id)
        }
        clearSelection()
      }

      // Toggle chat
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleChat()
      }
    },
    [deleteObject, toggleChat]
  )

  // Liveblocks connects automatically when provider is configured
  const connected = true

  return (
    <div className="relative h-screen w-screen overflow-hidden" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Canvas */}
      <Board
        objects={objects}
        onObjectUpdate={handleObjectUpdate}
        onObjectCreate={handleObjectCreate}
        onCursorMove={handleCursorMove}
      >
        <CursorLayer remoteUsers={remoteUsers} currentUserCursor={currentUserCursor} currentUserColor={localUser.userColor} />
      </Board>

      {/* Toolbar overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-3 z-40">
        <ToolPicker />
        <ZoomControls />
      </div>

      {/* Presence + chat toggle */}
      <div className="absolute top-4 right-4 flex gap-3 z-40">
        <PresenceBar remoteUsers={remoteUsers} connected={connected} />
        <button
          onClick={toggleChat}
          className="flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-sm text-gray-700 shadow-md border border-gray-200 hover:bg-gray-50"
          title="Toggle AI Chat (Cmd+/)"
        >
          AI
        </button>
      </div>

      {/* Chat panel */}
      <ChatPanel boardId={boardId} />
    </div>
  )
}
