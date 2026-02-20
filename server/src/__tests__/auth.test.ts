/**
 * Auth Middleware Tests (TDD)
 *
 * Tests Clerk JWT validation for REST and WebSocket endpoints.
 * Uses mocked Clerk verifyToken to test pure auth logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @clerk/backend before importing auth module
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

import { verifyToken } from '@clerk/backend'
import { authenticateRequest, type AuthUser } from '../auth.js'

const mockVerifyToken = vi.mocked(verifyToken)

// ---------------------------------------------------------------------------
// Helper: create a fake IncomingMessage with Authorization header
// ---------------------------------------------------------------------------
function fakeRequest(authHeader?: string): { headers: Record<string, string | undefined> } {
  return {
    headers: {
      authorization: authHeader,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Ensure CLERK_SECRET_KEY is set so the guard clause doesn't short-circuit
process.env.CLERK_SECRET_KEY = 'sk_test_fake_key_for_testing'

describe('authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns userId when token is valid', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_abc123' } as never)

    const req = fakeRequest('Bearer valid-token-here')
    const result = await authenticateRequest(req as never)

    expect(result).toEqual({ userId: 'user_abc123' })
    expect(mockVerifyToken).toHaveBeenCalledWith('valid-token-here', expect.any(Object))
  })

  it('returns null when Authorization header is missing', async () => {
    const req = fakeRequest(undefined)
    const result = await authenticateRequest(req as never)

    expect(result).toBeNull()
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns null when Authorization header has no Bearer prefix', async () => {
    const req = fakeRequest('Basic some-token')
    const result = await authenticateRequest(req as never)

    expect(result).toBeNull()
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns null when Bearer token is empty', async () => {
    const req = fakeRequest('Bearer ')
    const result = await authenticateRequest(req as never)

    expect(result).toBeNull()
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns null when verifyToken throws (invalid/expired token)', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Token expired'))

    const req = fakeRequest('Bearer expired-token')
    const result = await authenticateRequest(req as never)

    expect(result).toBeNull()
  })

  it('returns null when verifyToken returns payload without sub', async () => {
    mockVerifyToken.mockResolvedValue({} as never)

    const req = fakeRequest('Bearer no-sub-token')
    const result = await authenticateRequest(req as never)

    expect(result).toBeNull()
  })
})
