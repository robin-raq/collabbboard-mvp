import { Router, type Request, type Response } from 'express'
import { getAuth } from '@clerk/express'
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
  const liveblocks = getLiveblocks()
  if (!liveblocks) {
    res.status(503).json({
      error: 'Liveblocks auth not configured',
      hint: 'Set LIVEBLOCKS_SECRET_KEY on the server. See LIVEBLOCKS_SECRET_SETUP.md',
    })
    return
  }

  const auth = getAuth(req)
  const userId = auth?.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', hint: 'Sign in to use the board' })
    return
  }

  const room = typeof req.body?.room === 'string' ? req.body.room.trim() : null
  if (!room) {
    res.status(400).json({ error: 'Bad request', hint: 'Missing room in body' })
    return
  }

  // Optional: restrict to boards the user owns (for MVP we allow any authenticated user)
  const board = await getBoard(room)
  if (board && board.owner_id !== userId) {
    res.status(403).json({ error: 'Forbidden', hint: 'You do not have access to this board' })
    return
  }

  try {
    const session = liveblocks.prepareSession(userId, {
      userInfo: { userId },
    })
    session.allow(room, session.FULL_ACCESS)
    const { status, body } = await session.authorize()
    res.status(status).end(body)
  } catch (err) {
    console.error('[liveblocks-auth] authorize failed:', err)
    res.status(500).json({ error: 'Liveblocks auth failed' })
  }
})

export default router
