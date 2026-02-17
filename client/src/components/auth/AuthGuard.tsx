import { useAuth, SignIn } from '@clerk/clerk-react'
import type { ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  // If Clerk isn't configured, skip auth check
  if (!clerkKey) {
    return <>{children}</>
  }

  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <SignIn />
      </div>
    )
  }

  return <>{children}</>
}
