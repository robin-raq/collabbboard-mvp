import { useUser as useClerkUser } from '@clerk/clerk-react'

/**
 * Safe wrapper for useUser that handles the case where ClerkProvider isn't present
 * Returns null user when Clerk isn't configured instead of throwing an error
 */
export function useOptionalUser() {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  // If Clerk isn't configured, return a null user object
  if (!clerkKey) {
    return { user: null, isLoaded: true, isSignedIn: false }
  }

  // Otherwise, use the real Clerk hook
  return useClerkUser()
}
