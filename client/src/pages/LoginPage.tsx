import { SignIn } from '@clerk/clerk-react'

export function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">CollabBoard AI</h1>
        <SignIn />
      </div>
    </div>
  )
}
