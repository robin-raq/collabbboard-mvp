/**
 * Boards API Tests (TDD)
 *
 * Tests the board CRUD REST endpoints:
 *  - GET /api/boards — list all boards
 *  - POST /api/boards — create a new board
 *  - PATCH /api/boards/:id — rename a board (owner only)
 *  - DELETE /api/boards/:id — delete a board (owner only)
 *
 * Uses mocked Supabase client and auth middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
vi.mock('../db/supabase.js', () => {
  const mockFrom = vi.fn()
  return {
    supabase: {
      from: mockFrom,
    },
    __mockFrom: mockFrom,
  }
})

// Mock auth
vi.mock('../auth.js', () => ({
  authenticateRequest: vi.fn(),
}))

import { authenticateRequest } from '../auth.js'
import { supabase } from '../db/supabase.js'
import {
  handleListBoards,
  handleCreateBoard,
  handleRenameBoard,
  handleDeleteBoard,
} from '../routes/boards.js'

const mockAuth = vi.mocked(authenticateRequest)
const mockFrom = vi.mocked(supabase!.from)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeReq(body?: unknown): { headers: Record<string, string> } {
  return { headers: { 'content-type': 'application/json' } } as never
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    writeHead(status: number, headers?: Record<string, string>) {
      res.statusCode = status
      if (headers) Object.assign(res.headers, headers)
      return res
    },
    end(data?: string) {
      res.body = data ?? ''
      return res
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value
      return res
    },
  }
  return res
}

// ---------------------------------------------------------------------------
// Tests: handleListBoards (GET /api/boards)
// ---------------------------------------------------------------------------

describe('handleListBoards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = fakeRes()
    await handleListBoards(fakeReq() as never, res as never)

    expect(res.statusCode).toBe(401)
  })

  it('returns all boards when authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })

    const boards = [
      { id: 'board-1', owner_id: 'user_1', name: 'My Board', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'board-2', owner_id: 'user_2', name: 'Other Board', created_at: '2026-01-02', updated_at: '2026-01-02' },
    ]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: boards, error: null }),
      }),
    } as never)

    const res = fakeRes()
    await handleListBoards(fakeReq() as never, res as never)

    expect(res.statusCode).toBe(200)
    const parsed = JSON.parse(res.body)
    expect(parsed.boards).toHaveLength(2)
    expect(parsed.boards[0].name).toBe('My Board')
  })
})

// ---------------------------------------------------------------------------
// Tests: handleCreateBoard (POST /api/boards)
// ---------------------------------------------------------------------------

describe('handleCreateBoard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = fakeRes()
    await handleCreateBoard(fakeReq() as never, res as never, '{}')

    expect(res.statusCode).toBe(401)
  })

  it('creates a board with owner_id set to current user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })

    const createdBoard = {
      id: 'new-board-uuid',
      owner_id: 'user_1',
      name: 'My New Board',
      created_at: '2026-02-20',
      updated_at: '2026-02-20',
    }
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdBoard, error: null }),
        }),
      }),
    } as never)

    const res = fakeRes()
    await handleCreateBoard(fakeReq() as never, res as never, JSON.stringify({ name: 'My New Board' }))

    expect(res.statusCode).toBe(201)
    const parsed = JSON.parse(res.body)
    expect(parsed.board.id).toBe('new-board-uuid')
    expect(parsed.board.owner_id).toBe('user_1')
    expect(parsed.board.name).toBe('My New Board')
  })

  it('uses default name when none provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'b1', owner_id: 'user_1', name: 'Untitled Board', created_at: '', updated_at: '' },
            error: null,
          }),
        }),
      }),
    } as never)

    const res = fakeRes()
    await handleCreateBoard(fakeReq() as never, res as never, '{}')

    expect(res.statusCode).toBe(201)
    // Verify insert was called with 'Untitled Board' default
    const insertCall = mockFrom.mock.results[0].value.insert
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Untitled Board' })
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: handleRenameBoard (PATCH /api/boards/:id)
// ---------------------------------------------------------------------------

describe('handleRenameBoard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = fakeRes()
    await handleRenameBoard(fakeReq() as never, res as never, 'board-1', '{}')

    expect(res.statusCode).toBe(401)
  })

  it('renames board when user is owner', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })

    // First call: select to check ownership
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'board-1', owner_id: 'user_1' }, error: null }),
      }),
    })
    // Second call: update
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return { select: selectMock } as never
      return { update: updateMock } as never
    })

    const res = fakeRes()
    await handleRenameBoard(fakeReq() as never, res as never, 'board-1', JSON.stringify({ name: 'Renamed Board' }))

    expect(res.statusCode).toBe(200)
  })

  it('returns 403 when user is not owner', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'board-1', owner_id: 'user_1' }, error: null }),
        }),
      }),
    } as never)

    const res = fakeRes()
    await handleRenameBoard(fakeReq() as never, res as never, 'board-1', JSON.stringify({ name: 'Hack' }))

    expect(res.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Tests: handleDeleteBoard (DELETE /api/boards/:id)
// ---------------------------------------------------------------------------

describe('handleDeleteBoard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = fakeRes()
    await handleDeleteBoard(fakeReq() as never, res as never, 'board-1')

    expect(res.statusCode).toBe(401)
  })

  it('deletes board when user is owner', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })

    // Check ownership
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'board-1', owner_id: 'user_1' }, error: null }),
      }),
    })
    // Delete board
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    // Delete snapshot
    const deleteSnapshotMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return { select: selectMock } as never
      if (callCount === 2) return { delete: deleteSnapshotMock } as never
      return { delete: deleteMock } as never
    })

    const res = fakeRes()
    await handleDeleteBoard(fakeReq() as never, res as never, 'board-1')

    expect(res.statusCode).toBe(200)
  })

  it('returns 403 when user is not owner', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'board-1', owner_id: 'user_1' }, error: null }),
        }),
      }),
    } as never)

    const res = fakeRes()
    await handleDeleteBoard(fakeReq() as never, res as never, 'board-1')

    expect(res.statusCode).toBe(403)
  })
})
