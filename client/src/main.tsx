import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { LiveblocksProvider } from '@liveblocks/react'
import './index.css'
import App from './App.tsx'

// Initialize app by fetching configuration from backend
async function initializeApp() {
  console.log('[App Init] Starting initialization...')
  try {
    // Fetch configuration from backend API
    console.log('[App Init] Fetching config from /api/config...')
    const response = await fetch('/api/config')
    console.log('[App Init] Config response status:', response.status)
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`)
    }
    const config = await response.json()
    console.log('[App Init] Config loaded:', config)

    // Get Clerk key from API response or fall back to environment variables
    const clerkPubKey = config.clerkPublishableKey || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

    // Log for debugging
    console.log('[App Init] Clerk Key:', clerkPubKey ? '✓ Set' : '✗ Missing')
    console.log('[App Init] Liveblocks Key:', config.liveblocksPublicKey ? '✓ Set' : '✗ Missing')
    console.log('[App Init] API URL:', config.apiUrl || '/api')

    // Clerk is now required for authentication
    if (!clerkPubKey) {
      console.error('Missing VITE_CLERK_PUBLISHABLE_KEY')
      throw new Error(
        'Missing VITE_CLERK_PUBLISHABLE_KEY environment variable. ' +
        'See SETUP_CLERK.md for instructions on how to set up Clerk authentication.'
      )
    }

    // Get Liveblocks public key for direct client connection
    const liveblocksPublicKey = config.liveblocksPublicKey || import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY

    if (!liveblocksPublicKey) {
      console.error('Missing VITE_LIVEBLOCKS_PUBLIC_KEY')
      throw new Error(
        'Missing VITE_LIVEBLOCKS_PUBLIC_KEY environment variable. ' +
        'Get this from https://liveblocks.io/dashboard'
      )
    }

    // Root provider stack - Clerk is now required
    console.log('[App Init] Creating root element...')
    const root = (
      <ClerkProvider publishableKey={clerkPubKey}>
        <LiveblocksProvider publicApiKey={liveblocksPublicKey}>
          <App />
        </LiveblocksProvider>
      </ClerkProvider>
    )

    console.log('[App Init] Rendering React app...')
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        {root}
      </StrictMode>,
    )
    console.log('[App Init] React app rendered successfully!')
  } catch (error) {
    console.error('[App Init] FATAL ERROR:', error)
    // Display error to user in DOM
    const rootEl = document.getElementById('root')
    if (rootEl) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : ''
      rootEl.innerHTML = `
        <div style="padding: 20px; font-family: monospace; color: #d32f2f; background: #fff3e0; border: 1px solid #ff9800; line-height: 1.6;">
          <h1 style="margin: 0 0 10px 0; color: #e65100;">❌ Initialization Failed</h1>
          <p style="margin: 5px 0;"><strong>Error:</strong> ${errorMsg}</p>
          <pre style="margin: 10px 0; font-size: 12px; overflow-x: auto; background: #fff; padding: 10px; border-radius: 4px;">${errorStack}</pre>
          <p style="margin: 10px 0; font-size: 12px; color: #666;">Check browser console (F12) for more details.</p>
        </div>
      `
    }
  }
}

// Start app initialization
initializeApp()
