import ky from 'ky'

// ky instance with automatic JWT header injection via Clerk
const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? '',
  hooks: {
    beforeRequest: [
      async (request) => {
        // Clerk exposes __clerk_session on window
        // The actual token will be injected by the auth hook
        const token = await getAuthToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
  },
})

// Token getter — set by the auth provider
let tokenGetter: (() => Promise<string | null>) | null = null

export function setTokenGetter(getter: () => Promise<string | null>): void {
  tokenGetter = getter
}

async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null
  return tokenGetter()
}

export default api
