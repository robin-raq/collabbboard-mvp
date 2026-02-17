import { useUser as useClerkUser } from '@clerk/clerk-react'

/**
 * Hook to get the current authenticated user from Clerk
 * Clerk is now required for all users (see main.tsx)
 */
export function useOptionalUser() {
  return useClerkUser()
}
