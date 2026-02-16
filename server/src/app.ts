import express from 'express'
import cors from 'cors'
import { clerkAuth } from './middleware/auth.js'
import boardsRouter from './routes/boards.js'
import aiRouter from './routes/ai.js'

const app = express()

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(clerkAuth)

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/boards', boardsRouter)
app.use('/api/ai', aiRouter)

export default app
