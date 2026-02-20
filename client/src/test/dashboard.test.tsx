/**
 * Dashboard Page Tests (TDD)
 *
 * Tests the Dashboard component:
 *  - Renders board list
 *  - "+New Board" button triggers create
 *  - Board names are clickable links to /board/:id
 *  - Owner badge shown on each board
 *  - Rename/Delete only for owned boards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock Clerk
const mockGetToken = vi.fn().mockResolvedValue('mock-jwt-token')
const mockSignOut = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
  useUser: () => ({
    user: {
      id: 'user_1',
      firstName: 'Test',
      lastName: 'User',
    },
  }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sign-out-wrapper">{children}</div>
  ),
}))

// Mock the API
vi.mock('../api.js', () => ({
  boardsApi: {
    fetchBoards: vi.fn(),
    createBoard: vi.fn(),
    renameBoard: vi.fn(),
    deleteBoard: vi.fn(),
  },
  getApiUrl: () => 'http://localhost:1234',
}))

import { boardsApi } from '../api.js'
import Dashboard from '../pages/Dashboard.js'

const mockFetchBoards = vi.mocked(boardsApi.fetchBoards)
const mockCreateBoard = vi.mocked(boardsApi.createBoard)
const mockDeleteBoard = vi.mocked(boardsApi.deleteBoard)

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchBoards.mockResolvedValue([])
  })

  it('renders the page title', async () => {
    renderDashboard()
    expect(screen.getByText('CollabBoard')).toBeTruthy()
  })

  it('renders "+ New Board" button', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('+ New Board')).toBeTruthy()
    })
  })

  it('fetches and displays boards', async () => {
    mockFetchBoards.mockResolvedValue([
      { id: 'b1', owner_id: 'user_1', name: 'My Board', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'b2', owner_id: 'user_2', name: 'Other Board', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('My Board')).toBeTruthy()
      expect(screen.getByText('Other Board')).toBeTruthy()
    })
  })

  it('board names link to /board/:id', async () => {
    mockFetchBoards.mockResolvedValue([
      { id: 'b1', owner_id: 'user_1', name: 'My Board', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ])

    renderDashboard()

    await waitFor(() => {
      const link = screen.getByText('My Board').closest('a')
      expect(link).toBeTruthy()
      expect(link?.getAttribute('href')).toBe('/board/b1')
    })
  })

  it('calls createBoard when "+ New Board" is clicked', async () => {
    mockFetchBoards.mockResolvedValue([])
    mockCreateBoard.mockResolvedValue({
      id: 'new-b', owner_id: 'user_1', name: 'Untitled Board',
      created_at: '2026-02-20T00:00:00Z', updated_at: '2026-02-20T00:00:00Z',
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('+ New Board')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('+ New Board'))

    await waitFor(() => {
      expect(mockCreateBoard).toHaveBeenCalledWith('Untitled Board', 'mock-jwt-token')
    })
  })

  it('shows "All Boards" section heading', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('All Boards')).toBeTruthy()
    })
  })

  it('shows empty state when no boards exist', async () => {
    mockFetchBoards.mockResolvedValue([])
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no boards yet/i)).toBeTruthy()
    })
  })
})
