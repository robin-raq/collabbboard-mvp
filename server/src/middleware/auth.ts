import { type RequestHandler } from 'express'

// Mock auth for local dev (when CLERK_SECRET_KEY not set)
// In production, Clerk middleware will be properly configured
const mockAuth: RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization
    ? { userId: 'dev-user' }
    : { userId: null }
  ;(req as any).auth = auth
  next()
}

// Try to load real Clerk auth if configured
let clerkAuth = mockAuth

try {
  if (process.env.CLERK_SECRET_KEY) {
    const { clerkMiddleware } = require('@clerk/express')
    clerkAuth = clerkMiddleware()
  }
} catch (err) {
  console.warn('Clerk not available — using mock auth')
}

export { clerkAuth }

/**
 * Require authenticated user — use after clerkAuth
 * In dev mode (no Clerk), all requests with a Bearer token are allowed.
 * In production (Clerk configured), only valid JWT tokens are allowed.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = (req as any).auth
  if (!auth?.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
