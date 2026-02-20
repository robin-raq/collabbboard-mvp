/**
 * Board API Client
 *
 * Provides typed CRUD operations against the server REST API.
 * All methods require a Clerk JWT token for authentication.
 */

import { PRODUCTION_HOST } from './constants'

// ---------------------------------------------------------------------------
// API URL
// ---------------------------------------------------------------------------

export function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  // Auto-detect: if served from a non-localhost origin, use production host
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return `https://${PRODUCTION_HOST}`
  }
  return 'http://localhost:1234'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Board {
  id: string
  owner_id: string
  name: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export const boardsApi = {
  /** GET /api/boards — list all boards */
  async fetchBoards(token: string): Promise<Board[]> {
    try {
      const res = await fetch(`${getApiUrl()}/api/boards`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.boards ?? []
    } catch {
      return []
    }
  },

  /** POST /api/boards — create a new board */
  async createBoard(name: string, token: string): Promise<Board | null> {
    try {
      const res = await fetch(`${getApiUrl()}/api/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.board ?? null
    } catch {
      return null
    }
  },

  /** PATCH /api/boards/:id — rename a board */
  async renameBoard(id: string, name: string, token: string): Promise<boolean> {
    try {
      const res = await fetch(`${getApiUrl()}/api/boards/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      return res.ok
    } catch {
      return false
    }
  },

  /** DELETE /api/boards/:id — delete a board */
  async deleteBoard(id: string, token: string): Promise<boolean> {
    try {
      const res = await fetch(`${getApiUrl()}/api/boards/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return res.ok
    } catch {
      return false
    }
  },
}
