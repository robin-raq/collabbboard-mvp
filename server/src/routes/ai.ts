import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { aiRateLimit } from '../middleware/rateLimit.js'
import { processAiCommand } from '../services/agentService.js'

const router = Router()

const commandSchema = z.object({
  message: z.string().min(1),
  boardSnapshot: z.record(z.string(), z.any()), // Client sends current board state as key-value pairs
})

// POST /api/ai/command — AI agent command
// With Liveblocks, the frontend handles mutations directly
// This endpoint just returns AI-generated suggestions and tool calls
router.post('/command', requireAuth, aiRateLimit, async (req, res) => {
  try {
    const auth = getAuth(req)
    const body = commandSchema.parse(req.body)

    // Convert board snapshot from object record to array for AI service
    const objectsArray = Object.values(body.boardSnapshot) as unknown[]

    const { reply, toolCalls } = await processAiCommand(
      body.message,
      objectsArray as never, // Type assertion needed for legacy service signature
      auth.userId!
    )

    // Return suggestions to client, who will execute mutations via Liveblocks
    res.json({
      reply,
      toolCalls, // Client will apply these to Liveblocks storage
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues })
      return
    }
    console.error('AI command failed:', err)
    res.status(500).json({ error: 'AI command failed' })
  }
})

export default router
