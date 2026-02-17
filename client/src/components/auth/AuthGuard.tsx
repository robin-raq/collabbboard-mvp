import { useAuth, SignIn } from '@clerk/clerk-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const [loadTimeout, setLoadTimeout] = useState(false)

  useEffect(() => {
    console.log('[AuthGuard] Auth state:', { isLoaded, isSignedIn })
    const timer = setTimeout(() => {
      if (!isLoaded) {
        console.warn('[AuthGuard] Clerk took too long to load (>5s), showing timeout message')
        setLoadTimeout(true)
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [isLoaded, isSignedIn])

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div className="text-gray-500 mb-4">Loading...</div>
          {loadTimeout && (
            <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '10px' }}>
              <p>Clerk is taking longer than expected to initialize.</p>
              <p>This might indicate a configuration issue.</p>
              <p>Check the browser console (F12) for errors.</p>
            </div>
          )}
        </div>
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
