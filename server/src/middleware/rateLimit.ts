import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// Rate limit AI endpoint: 20 requests per user per hour
export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please slow down.' },
  keyGenerator: (req) => {
    // Use user ID from auth if available, fallback to IPv6-safe IP generator
    const auth = (req as unknown as Record<string, unknown>).auth as { userId?: string } | undefined
    if (auth?.userId) return auth.userId
    return ipKeyGenerator(req)
  },
})
