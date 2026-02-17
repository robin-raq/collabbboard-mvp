import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { LiveblocksProvider } from '@liveblocks/react'
import './index.css'
import App from './App.tsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const liveblocksApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY

// Clerk is now required for authentication
if (!clerkPubKey) {
  throw new Error(
    'Missing VITE_CLERK_PUBLISHABLE_KEY environment variable. ' +
    'See SETUP_CLERK.md for instructions on how to set up Clerk authentication.'
  )
}

if (!liveblocksApiKey) {
  throw new Error(
    'Missing VITE_LIVEBLOCKS_PUBLIC_KEY environment variable. ' +
    'Get this from https://liveblocks.io/dashboard'
  )
}

// Root provider stack - Clerk is now required
let root = (
  <ClerkProvider publishableKey={clerkPubKey}>
    <LiveblocksProvider publicApiKey={liveblocksApiKey}>
      <App />
    </LiveblocksProvider>
  </ClerkProvider>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
)
