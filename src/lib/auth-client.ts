import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [usernameClient()],
})

export const { signIn, signUp, signOut } = authClient
