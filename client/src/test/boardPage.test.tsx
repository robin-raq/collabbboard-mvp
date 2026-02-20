/**
 * BoardPage Tests (TDD)
 *
 * Tests the board page wrapper component:
 *  - Extracts board ID from URL params
 *  - Renders "Back to boards" link
 *  - Passes boardId to child components
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  }),
  useUser: () => ({
    user: {
      id: 'user_1',
      firstName: 'Test',
      lastName: 'User',
    },
  }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

// Mock the Board component to avoid canvas/Konva issues in jsdom
vi.mock('../Board', () => ({
  default: ({ userName, boardId }: { userName: string; boardId?: string }) => (
    <div data-testid="mock-board">
      <span data-testid="board-username">{userName}</span>
      <span data-testid="board-id">{boardId}</span>
    </div>
  ),
}))

import BoardPage from '../pages/BoardPage'

function renderBoardPage(boardId: string) {
  return render(
    <MemoryRouter initialEntries={[`/board/${boardId}`]}>
      <Routes>
        <Route path="/board/:id" element={<BoardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BoardPage', () => {
  it('renders with board ID from URL params', () => {
    renderBoardPage('test-board-uuid')
    expect(screen.getByTestId('board-id').textContent).toBe('test-board-uuid')
  })

  it('renders back link to dashboard', () => {
    renderBoardPage('test-board-uuid')
    const backLink = screen.getByText(/boards/i)
    expect(backLink.closest('a')?.getAttribute('href')).toBe('/')
  })

  it('passes user name to Board component', () => {
    renderBoardPage('test-board-uuid')
    expect(screen.getByTestId('board-username').textContent).toBe('Test User')
  })
})
