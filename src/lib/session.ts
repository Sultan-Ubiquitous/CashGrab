import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'

export interface SessionData {
  user: { id: string; name: string; email: string }
}

/**
 * Reads the Better Auth session from the request cookies. Runs on the server
 * (SSR and the client's RPC call), so protected pages are decided before render.
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(async (): Promise<SessionData | null> => {
  const { getEnv, waitUntil } = await import('~/server/env')
  const { createDb } = await import('~/server/db')
  const { createAuth } = await import('~/server/auth')
  const env = getEnv()
  const db = createDb(env.DATABASE_URL)
  try {
    const auth = createAuth(db, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    })
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return null
    const { id, name, email } = session.user
    return { user: { id, name, email } }
  } finally {
    waitUntil(db.$disconnect())
  }
})

/** Session is cached per router instance; sign-in/out and profile edits clear it. */
export const sessionQuery = {
  queryKey: ['session'] as const,
  queryFn: () => getSessionFn(),
  staleTime: 60_000,
}

/** Protected routes: bounce to login (remembering where the user was going). */
export function guardSession(context: { session: SessionData | null }, href: string) {
  if (!context.session) throw redirect({ to: '/login', search: { redirect: href } })
}

/** Only same-origin relative paths may be used as post-login targets. */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/'
  return target
}
