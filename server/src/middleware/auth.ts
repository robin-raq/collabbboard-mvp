import { type RequestHandler } from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'

// Clerk middleware — attaches auth to request
export const clerkAuth = clerkMiddleware()

// Require authenticated user — use after clerkAuth
export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req)
  if (!auth?.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
