import { useParams } from 'react-router-dom'
import { RoomProvider } from '@liveblocks/react'
import { BoardPage } from './BoardPage'

/**
 * Wrapper component that provides RoomProvider for each board
 * This is necessary because Liveblocks hooks require being within a RoomProvider
 */
export function BoardPageWrapper() {
  const { boardId } = useParams<{ boardId: string }>()

  if (!boardId) {
    return <div>Invalid board ID</div>
  }

  return (
    <RoomProvider
      id={boardId}
      initialPresence={{
        cursor: null,
        userId: '',
        userName: '',
        userColor: '',
      }}
      initialStorage={{
        objects: {},
      }}
    >
      <BoardPage />
    </RoomProvider>
  )
}
