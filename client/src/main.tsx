import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { LiveblocksProvider } from '@liveblocks/react'
import './index.css'
import App from './App.tsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const liveblocksApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY

// Root provider stack
let root = <App />

// Wrap with Clerk if configured
if (clerkPubKey) {
  root = <ClerkProvider publishableKey={clerkPubKey}>{root}</ClerkProvider>
}

// Wrap with Liveblocks (required for real-time sync)
if (liveblocksApiKey) {
  root = <LiveblocksProvider publicApiKey={liveblocksApiKey}>{root}</LiveblocksProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
)
