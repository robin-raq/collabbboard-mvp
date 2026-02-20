/**
 * Auth Middleware — Clerk JWT validation for REST and WebSocket endpoints.
 *
 * Extracts Bearer token from Authorization header, validates via Clerk,
 * and returns the authenticated user's ID.
 */

import http from 'http'
import { verifyToken } from '@clerk/backend'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  userId: string
}

// ---------------------------------------------------------------------------
// Core auth function
// ---------------------------------------------------------------------------

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? ''

/**
 * Authenticate an incoming HTTP request by validating the Clerk JWT.
 * Returns { userId } on success, null on failure.
 */
export async function authenticateRequest(
  req: http.IncomingMessage,
): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7) // Remove 'Bearer '
  if (!token.trim()) return null

  try {
    if (!CLERK_SECRET_KEY) {
      console.error('[auth] CLERK_SECRET_KEY is empty — cannot verify tokens')
      return null
    }
    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    })
    if (!payload?.sub) {
      console.error('[auth] Token verified but no sub claim found')
      return null
    }
    return { userId: payload.sub }
  } catch (err) {
    console.error('[auth] Token verification failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Require authentication — sends 401 if not authenticated.
 * Returns the AuthUser or null (after sending 401).
 */
export async function requireAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<AuthUser | null> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return null
  }
  return user
}
