import { Hono } from 'hono'
import { createAuth } from './auth'
import { createDb, type Db } from './db'
import type { AppEnv } from './env'
import { toErrorResponse } from './lib/errors'
import { exportRoutes } from './exports/routes'
import { customersRoutes, driversRoutes, trucksRoutes } from './routes/master'
import { meRoutes } from './routes/me'
import { bellaRoutes, paymentsRoutes, reportsRoutes, tripsRoutes } from './routes/trips'
import type { AppVars } from './http'

/**
 * Builds the whole /api app. Runtime-agnostic: the caller supplies the
 * environment and a `waitUntil` (Cloudflare) or a no-op (tests/Node).
 * (The import of './env' is type-only and erased at build time.)
 */
export function buildApp(env: AppEnv, keepAlive: (p: Promise<unknown>) => void = (p) => void p) {
  const app = new Hono<{ Variables: AppVars }>().basePath('/api')

  // Security headers on every API response (JSON and streamed files alike).
  // Prepared before the handler runs so they merge into constructed responses.
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Referrer-Policy', 'no-referrer')
    await next()
  })

  // Request scope: a fresh Prisma client (and auth instance) per request.
  // The client is closed in `finally` — unless a route streams a response
  // and takes over ownership of the connection.
  app.use('*', async (c, next) => {
    const db: Db = createDb(env.DATABASE_URL)
    const auth = createAuth(db, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    })
    c.set('db', db)
    c.set('auth', auth)
    c.set('userId', '')
    try {
      return await next()
    } finally {
      if (!c.get('streamOwnsDb')) keepAlive(db.$disconnect())
    }
  })

  // Better Auth (email/password + Google + username). Mounted before the
  // session guard; /api/auth/** needs no session.
  app.on(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))

  // Everything below requires a session. The user id comes from the session
  // only; any user id supplied by the client is ignored.
  const authed = new Hono<{ Variables: AppVars }>()
  authed.use('*', async (c, next) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401)
    c.set('userId', session.user.id)
    return next()
  })

  authed.route('/me', meRoutes)
  authed.route('/trucks', trucksRoutes)
  authed.route('/drivers', driversRoutes)
  authed.route('/customers', customersRoutes)
  authed.route('/trips', tripsRoutes)
  authed.route('/payments', paymentsRoutes)
  authed.route('/bella', bellaRoutes)
  authed.route('/reports', reportsRoutes)
  authed.route('/exports', exportRoutes)
  app.get('/health', (c) => c.json({ ok: true }))

  app.route('/', authed)

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'No such API endpoint' } }, 404))

  app.onError((err, c) => {
    const { status, body } = toErrorResponse(err)
    return c.json(body, status)
  })

  return app
}
