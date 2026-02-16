import * as Y from 'yjs'

// In-memory room registry: Map<boardId, Y.Doc>
const rooms = new Map<string, Y.Doc>()

export function getOrCreateDoc(boardId: string): Y.Doc {
  let doc = rooms.get(boardId)
  if (!doc) {
    doc = new Y.Doc()
    rooms.set(boardId, doc)
  }
  return doc
}

export function getDoc(boardId: string): Y.Doc | undefined {
  return rooms.get(boardId)
}

export function removeDoc(boardId: string): void {
  const doc = rooms.get(boardId)
  if (doc) {
    doc.destroy()
    rooms.delete(boardId)
  }
}

export function getAllRooms(): Map<string, Y.Doc> {
  return rooms
}
