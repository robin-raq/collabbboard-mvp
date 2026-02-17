import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Board } from '../components/canvas/Board'
import { ToolPicker } from '../components/toolbar/ToolPicker'
import { ZoomControls } from '../components/toolbar/ZoomControls'
import { PresenceBar } from '../components/toolbar/PresenceBar'
import { CursorLayer } from '../components/cursors/CursorLayer'
import { ChatPanel } from '../components/chat/ChatPanel'
import { useLiveblocks } from '../hooks/useLiveblocks'
import { useUiStore } from '../stores/uiStore'
import type { BoardObject } from '../../../shared/types'

// Assign a random color to each user
const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { user } = useUser()
  const { activeTool, setActiveTool, toggleChat } = useUiStore()

  const localUser = useMemo(() => {
    if (!user) return null
    return {
      userId: user.id,
      userName: user.firstName ?? user.username ?? 'Anonymous',
      userColor: COLORS[Math.abs(user.id.charCodeAt(0)) % COLORS.length],
    }
  }, [user])

  // Initialize Liveblocks with local user presence
  const { objects, remoteUsers, createObject, updateObject, deleteObject, setCursor } = useLiveblocks(
    localUser?.userId ?? 'anonymous'
  )

  const handleObjectUpdate = useCallback(
    (id: string, fields: Partial<BoardObject>) => {
      updateObject(id, fields)
    },
    [updateObject]
  )

  const handleObjectCreate = useCallback(
    (x: number, y: number) => {
      if (!user || activeTool === 'select') return
      createObject({ type: activeTool as BoardObject['type'], x, y }, user.id)
      setActiveTool('select') // Switch back to select after creating
    },
    [user, activeTool, setActiveTool, createObject]
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
        <CursorLayer remoteUsers={remoteUsers} />
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
