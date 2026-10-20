import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { username } from 'better-auth/plugins'
import type { Db } from './db'

export interface AuthConfig {
  secret: string
  baseURL: string
  googleClientId?: string
  googleClientSecret?: string
}

/** Created per request: the Prisma client (and its sockets) is request-scoped on Workers. */
export function createAuth(db: Db, cfg: AuthConfig) {
  return betterAuth({
    secret: cfg.secret,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [cfg.baseURL],
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    socialProviders:
      cfg.googleClientId && cfg.googleClientSecret
        ? { google: { clientId: cfg.googleClientId, clientSecret: cfg.googleClientSecret } }
        : {},
    // Google sign-in links to an existing account with the same email. Local
    // emails are never verified in this app, so the default check (local email
    // must be verified) is disabled — Google itself vouches for the address.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    user: {
      additionalFields: {
        phone: { type: 'string', required: false, input: true },
      },
    },
    plugins: [username()],
    advanced: {
      // Server-generated ids for auth tables (our schema has no DB defaults there).
      database: { generateId: () => crypto.randomUUID() },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
