import { ClerkProvider, SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react'
import Board from './Board'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AuthenticatedBoard() {
  const { user } = useUser()
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
    'User'

  console.log('[AUTH] Signed in as:', name)
  return <Board userName={name} />
}

export default function App() {
  if (!CLERK_KEY) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', color: '#d32f2f' }}>
        <h1>Missing VITE_CLERK_PUBLISHABLE_KEY</h1>
        <p>Add it to <code>client/.env.local</code></p>
      </div>
    )
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <SignedOut>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#f8fafc',
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedBoard />
      </SignedIn>
    </ClerkProvider>
  )
}
