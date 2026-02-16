import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import * as boardService from '../services/boardService.js'

const router = Router()

const createBoardSchema = z.object({
  name: z.string().min(1).max(100).default('Untitled Board'),
})

// GET /api/boards — list user's boards
router.get('/', requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req)
    const boards = await boardService.listBoardsForUser(auth.userId!)
    res.json(boards)
  } catch (err) {
    console.error('Failed to list boards:', err)
    res.status(500).json({ error: 'Failed to list boards' })
  }
})

// POST /api/boards — create a new board
router.post('/', requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req)
    const body = createBoardSchema.parse(req.body)
    const board = await boardService.createBoard({
      name: body.name,
      ownerId: auth.userId!,
    })
    res.status(201).json(board)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    console.error('Failed to create board:', err)
    res.status(500).json({ error: 'Failed to create board' })
  }
})

// GET /api/boards/:id — get board metadata
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const board = await boardService.getBoard(req.params.id)
    if (!board) {
      res.status(404).json({ error: 'Board not found' })
      return
    }
    res.json(board)
  } catch (err) {
    console.error('Failed to get board:', err)
    res.status(500).json({ error: 'Failed to get board' })
  }
})

// DELETE /api/boards/:id — soft delete (owner only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req)
    await boardService.deleteBoard(req.params.id, auth.userId!)
    res.status(204).send()
  } catch (err) {
    console.error('Failed to delete board:', err)
    res.status(500).json({ error: 'Failed to delete board' })
  }
})

export default router
