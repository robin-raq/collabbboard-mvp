import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { aiRateLimit } from '../middleware/rateLimit.js'
import { processAiCommand } from '../services/agentService.js'
import * as yjsService from '../services/yjsService.js'
import { getOrCreateDoc } from '../lib/yjsRoom.js'
import type { BoardObject } from '../../../shared/types.js'

const router = Router()

const commandSchema = z.object({
  message: z.string().min(1),
  boardId: z.string().uuid(),
})

// POST /api/ai/command — AI agent command
router.post('/command', requireAuth, aiRateLimit, async (req, res) => {
  try {
    const auth = getAuth(req)
    const body = commandSchema.parse(req.body)
    const doc = getOrCreateDoc(body.boardId)
    const snapshot = yjsService.getBoardSnapshot(doc)

    const { reply, toolCalls } = await processAiCommand(
      body.message,
      snapshot,
      auth.userId!
    )

    // Apply each tool call to the Y.Doc
    const results: string[] = []
    for (const call of toolCalls) {
      try {
        switch (call.tool) {
          case 'createObject': {
            const params = call.params as Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number }
            const obj = yjsService.createObject(doc, params, auth.userId!)
            results.push(`Created ${obj.type} "${obj.text ?? obj.id}"`)
            break
          }
          case 'updateObject': {
            const { id, ...fields } = call.params as { id: string } & Partial<BoardObject>
            yjsService.updateObject(doc, id, fields)
            results.push(`Updated object ${id}`)
            break
          }
          case 'deleteObject': {
            const { id } = call.params as { id: string }
            yjsService.deleteObject(doc, id)
            results.push(`Deleted object ${id}`)
            break
          }
          case 'moveObject': {
            const { id, x, y } = call.params as { id: string; x: number; y: number }
            yjsService.updateObject(doc, id, { x, y })
            results.push(`Moved object ${id} to (${x}, ${y})`)
            break
          }
          case 'clearBoard': {
            yjsService.clearBoard(doc)
            results.push('Cleared all objects from the board')
            break
          }
          default:
            results.push(`Unknown tool: ${call.tool}`)
        }
      } catch (err) {
        results.push(`Error executing ${call.tool}: ${(err as Error).message}`)
      }
    }

    res.json({
      reply: reply || results.join('; ') || 'Done.',
      toolCalls,
      results,
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
