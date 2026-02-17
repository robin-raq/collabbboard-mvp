import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { LiveblocksProvider } from '@liveblocks/react'
import './index.css'
import App from './App.tsx'

// Get keys from injected window variables (set by inject-env.js at runtime)
// or fall back to build-time env vars for local development
const clerkPubKey = (window as any).__VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const liveblocksApiKey = (window as any).__VITE_LIVEBLOCKS_PUBLIC_KEY || import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY

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
