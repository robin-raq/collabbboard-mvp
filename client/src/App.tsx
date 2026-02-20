import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import Board from './Board'
import Dashboard from './pages/Dashboard'
import BoardPage from './pages/BoardPage'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const GUEST_NAMES = [
  'Curious Panda', 'Swift Falcon', 'Bright Otter', 'Bold Tiger',
  'Calm Dolphin', 'Quick Fox', 'Wise Owl', 'Happy Koala',
]

function GuestBoard() {
  const [guestName] = useState(
    () => GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]
  )
  if (import.meta.env.DEV) console.log('[AUTH] Joined as guest:', guestName)
  // Guest gets a random ephemeral board — no dashboard
  const [guestBoardId] = useState(() => `guest-${crypto.randomUUID().slice(0, 8)}`)
  return <Board userName={guestName} boardId={guestBoardId} />
}

function AuthenticatedApp() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/board/:id" element={<BoardPage />} />
    </Routes>
  )
}

export default function App() {
  const [isGuest, setIsGuest] = useState(false)

  if (isGuest) {
    return <GuestBoard />
  }

  if (!CLERK_KEY) {
    return <GuestBoard />
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <SignedOut>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#f8fafc',
            gap: 20,
            fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#1E293B',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              CollabBoard
            </h1>
            <p
              style={{
                fontSize: 14,
                color: '#64748B',
                margin: '6px 0 0',
                fontWeight: 400,
              }}
            >
              Real-time collaborative whiteboard
            </p>
          </div>
          <SignIn routing="hash" />
          <button
            onClick={() => setIsGuest(true)}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              color: '#6b7280',
              cursor: 'pointer',
              fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            Continue as Guest
          </button>
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </ClerkProvider>
  )
}
