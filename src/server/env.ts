import { env as cfEnv, waitUntil as cfWaitUntil } from 'cloudflare:workers'

export interface AppEnv {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

export function getEnv(): AppEnv {
  const e = cfEnv as unknown as Partial<AppEnv>
  const missing = (['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const).filter((k) => !e[k])
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}`)
  return e as AppEnv
}

/** Keep the Worker alive for background work (e.g. closing DB connections). */
export function waitUntil(p: Promise<unknown>) {
  try {
    cfWaitUntil(p)
  } catch {
    void p
  }
}
