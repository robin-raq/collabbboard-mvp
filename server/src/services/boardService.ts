import { randomUUID } from 'crypto'

export interface CreateBoardInput {
  name: string
  ownerId: string
}

interface Board {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

// In-memory board storage for MVP (persisted via Liveblocks)
const boards = new Map<string, Board>()

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  const id = randomUUID()
  const now = new Date().toISOString()

  const board: Board = {
    id,
    name: input.name,
    owner_id: input.ownerId,
    created_at: now,
    updated_at: now,
  }

  boards.set(id, board)
  return board
}

export async function listBoardsForUser(userId: string) {
  // Return boards owned by the user (simplified MVP)
  return Array.from(boards.values())
    .filter((board) => board.owner_id === userId)
    .map((board) => ({
      board_id: board.id,
      role: 'owner',
      boards: {
        id: board.id,
        name: board.name,
        owner_id: board.owner_id,
        created_at: board.created_at,
        updated_at: board.updated_at,
      },
    }))
}

export async function getBoard(boardId: string): Promise<Board | null> {
  return boards.get(boardId) ?? null
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = boards.get(boardId)
  if (board && board.owner_id === userId) {
    boards.delete(boardId)
  }
}
