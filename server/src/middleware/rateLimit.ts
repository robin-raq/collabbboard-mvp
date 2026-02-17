import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'

// Rate limit AI endpoint: 20 requests per user per hour
export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please slow down.' },
  keyGenerator: (req: Request) => {
    // Use user ID from auth if available, fallback to IP-based key
    const auth = (req as unknown as Record<string, unknown>).auth as { userId?: string } | undefined
    if (auth?.userId) return auth.userId

    // Fallback to IP address (IPv6 safe)
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    return ip
  },
})
