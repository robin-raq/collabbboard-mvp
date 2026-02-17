import { Router, type Request, type Response } from 'express'
import { Liveblocks } from '@liveblocks/node'
import { getBoard } from '../services/boardService.js'

const router = Router()
const secret = process.env.LIVEBLOCKS_SECRET_KEY

function getLiveblocks(): Liveblocks | null {
  if (!secret) return null
  return new Liveblocks({ secret })
}

/**
 * POST /api/liveblocks-auth
 * Body: { room: string }
 * Returns a Liveblocks session token so the client can connect to the room with write access.
 * Requires Clerk auth. Optional: restrict to boards the user owns (MVP allows any authenticated user).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const liveblocks = getLiveblocks()
    if (!liveblocks) {
      console.warn('[liveblocks-auth] LIVEBLOCKS_SECRET_KEY not configured')
      res.status(503).json({
        error: 'Liveblocks auth not configured',
        hint: 'Set LIVEBLOCKS_SECRET_KEY on the server. See LIVEBLOCKS_SECRET_SETUP.md',
      })
      return
    }

    // Get userId from Clerk middleware (stored in req.auth by clerkAuth middleware)
    const auth = (req as any).auth
    const userId = auth?.userId
    console.log('[liveblocks-auth] Request received - userId:', userId)

    if (!userId) {
      console.warn('[liveblocks-auth] No userId in auth')
      res.status(401).json({ error: 'Unauthorized', hint: 'Sign in to use the board' })
      return
    }

    const room = typeof req.body?.room === 'string' ? req.body.room.trim() : null
    console.log('[liveblocks-auth] Room:', room)

    if (!room) {
      console.warn('[liveblocks-auth] No room in request body')
      res.status(400).json({ error: 'Bad request', hint: 'Missing room in body' })
      return
    }

    // Optional: restrict to boards the user owns (for MVP we allow any authenticated user)
    console.log('[liveblocks-auth] Checking board access for:', { room, userId })
    const board = await getBoard(room)
    console.log('[liveblocks-auth] Board found:', board ? board.id : 'none')

    if (board && board.owner_id !== userId) {
      console.warn('[liveblocks-auth] Access denied - not board owner')
      res.status(403).json({ error: 'Forbidden', hint: 'You do not have access to this board' })
      return
    }

    console.log('[liveblocks-auth] Creating Liveblocks session for userId:', userId)
    const session = liveblocks.prepareSession(userId, {
      userInfo: { userId },
    })
    session.allow(room, session.FULL_ACCESS)
    const { status, body } = await session.authorize()
    console.log('[liveblocks-auth] Authorization successful, status:', status)
    res.status(status).end(body)
  } catch (err) {
    console.error('[liveblocks-auth] FATAL ERROR:', err)
    res.status(500).json({
      error: 'Liveblocks auth failed',
      details: err instanceof Error ? err.message : String(err)
    })
  }
})

export default router
