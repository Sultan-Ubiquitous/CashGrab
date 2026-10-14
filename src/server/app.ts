import { buildApp } from './appFactory'
import { getEnv, waitUntil } from './env'

/** The /api app as served by the Cloudflare Worker. */
export const app = buildApp(getEnv(), (p) => waitUntil(p))
