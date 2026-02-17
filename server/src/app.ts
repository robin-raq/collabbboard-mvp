import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { clerkAuth } from './middleware/auth.js'
import boardsRouter from './routes/boards.js'
import aiRouter from './routes/ai.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Config endpoint - return frontend configuration (no auth needed)
app.get('/api/config', (_req, res) => {
  res.json({
    clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    liveblocksPublicKey: process.env.VITE_LIVEBLOCKS_PUBLIC_KEY,
    apiUrl: process.env.VITE_API_URL || '/api',
  })
})

// API routes
app.use('/api/boards', boardsRouter)
app.use('/api/ai', aiRouter)

// Serve static frontend files in production
const frontendPath = path.join(__dirname, '../../client/dist')
app.use(express.static(frontendPath, { maxAge: '1d' }))

// SPA fallback: serve index.html for all non-API routes
app.get(/^(?!\/api\/)/, (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).json({ error: 'Could not serve index.html' })
    }
  })
})

export default app
