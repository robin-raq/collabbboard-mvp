import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { Liveblocks } from '@liveblocks/node'
import { getAuth } from '@clerk/express'
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

// Liveblocks auth endpoint - called by frontend to get access token
app.post('/api/liveblocks-auth', async (req, res) => {
  try {
    const auth = getAuth(req)
    console.log('Liveblocks auth attempt - userId:', auth?.userId)

    if (!auth?.userId) {
      console.error('No userId in auth:', auth)
      return res.status(401).json({ error: 'Unauthorized - no user ID' })
    }

    const secret = process.env.LIVEBLOCKS_SECRET_KEY
    if (!secret) {
      console.error('LIVEBLOCKS_SECRET_KEY not configured')
      return res.status(500).json({ error: 'Server configuration error - missing secret' })
    }

    console.log('Creating Liveblocks client...')
    const client = new Liveblocks({ secret })

    // Generate a session token for the authenticated user
    // Use userId as display name since we don't have user object in this context
    console.log('Preparing Liveblocks session for user:', auth.userId)
    const session = client.prepareSession(auth.userId, {
      userInfo: {
        name: auth.userId || 'Anonymous',
      },
    })

    // Allow access to any room (room authorization happens at the room level)
    session.allow(`*`, session.FULL_ACCESS)

    console.log('Authorizing session...')
    const { body } = await session.authorize()

    console.log('Session authorized successfully')
    res.json(body)
  } catch (error) {
    console.error('Liveblocks auth error:', error)
    res.status(500).json({
      error: 'Failed to authenticate with Liveblocks',
      message: error instanceof Error ? error.message : String(error)
    })
  }
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
