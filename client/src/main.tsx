import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { LiveblocksProvider } from '@liveblocks/react'
import './index.css'
import App from './App.tsx'

// Initialize app by fetching configuration from backend
async function initializeApp() {
  try {
    // Fetch configuration from backend API
    const response = await fetch('/api/config')
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`)
    }
    const config = await response.json()

    // Get Clerk key from API response or fall back to environment variables
    const clerkPubKey = config.clerkPublishableKey || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

    // Log for debugging
    console.log('Clerk Key:', clerkPubKey ? '✓ Set' : '✗ Missing')
    console.log('Liveblocks Auth:', 'Configured via authEndpoint')
    console.log('API URL:', config.apiUrl || '/api')

    // Clerk is now required for authentication
    if (!clerkPubKey) {
      console.error('Missing VITE_CLERK_PUBLISHABLE_KEY')
      throw new Error(
        'Missing VITE_CLERK_PUBLISHABLE_KEY environment variable. ' +
        'See SETUP_CLERK.md for instructions on how to set up Clerk authentication.'
      )
    }

    // Root provider stack - Clerk is now required
    const root = (
      <ClerkProvider publishableKey={clerkPubKey}>
        <LiveblocksProvider
          authEndpoint={async (room) => {
            // Request auth token from backend
            // IMPORTANT: credentials: 'include' sends the Clerk session cookie
            const response = await fetch('/api/liveblocks-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ room }),
            })

            if (!response.ok) {
              throw new Error(`Auth failed with status ${response.status}`)
            }

            return await response.json()
          }}
        >
          <App />
        </LiveblocksProvider>
      </ClerkProvider>
    )

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        {root}
      </StrictMode>,
    )
  } catch (error) {
    console.error('Failed to initialize app:', error)
    // Display error to user in DOM
    const rootEl = document.getElementById('root')
    if (rootEl) {
      rootEl.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif; color: #d32f2f;">
          <h1>Failed to Initialize App</h1>
          <p>${error instanceof Error ? error.message : String(error)}</p>
          <p>Please check your server configuration and try again.</p>
        </div>
      `
    }
  }
}

// Start app initialization
initializeApp()
