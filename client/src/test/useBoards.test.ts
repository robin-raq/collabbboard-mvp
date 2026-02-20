/**
 * useBoards Hook Tests (TDD)
 *
 * Tests the board CRUD operations:
 *  - fetchBoards() — GET /api/boards
 *  - createBoard(name) — POST /api/boards
 *  - renameBoard(id, name) — PATCH /api/boards/:id
 *  - deleteBoard(id) — DELETE /api/boards/:id
 *
 * Uses mocked fetch and Clerk auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Clerk's useAuth hook
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  }),
}))

// We'll test the raw API functions (not the hook) since they're easier to unit test
import { boardsApi } from '../api.js'

// Mock global fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('boardsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchBoards', () => {
    it('calls GET /api/boards with auth token', async () => {
      const boards = [
        { id: 'b1', owner_id: 'u1', name: 'Board 1', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ boards }),
      })

      const result = await boardsApi.fetchBoards('mock-token')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/boards'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      )
      expect(result).toEqual(boards)
    })

    it('returns empty array when API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      })

      const result = await boardsApi.fetchBoards('mock-token')
      expect(result).toEqual([])
    })
  })

  describe('createBoard', () => {
    it('calls POST /api/boards with name and auth token', async () => {
      const board = { id: 'b-new', owner_id: 'u1', name: 'New Board', created_at: '2026-02-20', updated_at: '2026-02-20' }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ board }),
      })

      const result = await boardsApi.createBoard('New Board', 'mock-token')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/boards'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
          body: JSON.stringify({ name: 'New Board' }),
        }),
      )
      expect(result).toEqual(board)
    })

    it('returns null when API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      })

      const result = await boardsApi.createBoard('Fail Board', 'mock-token')
      expect(result).toBeNull()
    })
  })

  describe('renameBoard', () => {
    it('calls PATCH /api/boards/:id with new name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ board: { id: 'b1', name: 'Renamed' } }),
      })

      const result = await boardsApi.renameBoard('b1', 'Renamed', 'mock-token')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/boards/b1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed' }),
        }),
      )
      expect(result).toBe(true)
    })

    it('returns false when API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Forbidden' }),
      })

      const result = await boardsApi.renameBoard('b1', 'Hack', 'mock-token')
      expect(result).toBe(false)
    })
  })

  describe('deleteBoard', () => {
    it('calls DELETE /api/boards/:id with auth token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await boardsApi.deleteBoard('b1', 'mock-token')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/boards/b1'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      )
      expect(result).toBe(true)
    })

    it('returns false when API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      const result = await boardsApi.deleteBoard('b1', 'mock-token')
      expect(result).toBe(false)
    })
  })
})
