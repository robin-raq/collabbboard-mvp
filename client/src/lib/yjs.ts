import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234'

/**
 * Create a Y.Doc and WebSocket provider for a board.
 * The token is passed as a query parameter on the WS URL for auth.
 */
export function createYjsConnection(boardId: string, token: string) {
  const doc = new Y.Doc()

  const provider = new WebsocketProvider(
    WS_URL,
    boardId,
    doc,
    {
      params: { token },
    }
  )

  const undoManager = new Y.UndoManager(doc.getMap('objects'))

  return { doc, provider, undoManager }
}
