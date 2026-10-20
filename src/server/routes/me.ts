import { Hono } from 'hono'
import { z } from 'zod'
import { isAPIError } from 'better-auth/api'
import { meOut, phone } from '~/shared/schemas'
import type { Db } from '../db'
import { AppError } from '../lib/errors'
import { ok, v, type AppEnv } from '../http'

const meUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: phone.nullable().optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, - and _ only')
    .optional(),
})

const setPasswordInput = z.object({
  newPassword: z.string().min(8, 'At least 8 characters').max(128),
})

/** Which sign-in methods the user already has (password + Google link). */
async function signInFlags(db: Db, userId: string) {
  const [credential, google] = await Promise.all([
    db.account.findFirst({
      where: { userId, providerId: 'credential', password: { not: null } },
      select: { id: true },
    }),
    db.account.findFirst({ where: { userId, providerId: 'google' }, select: { id: true } }),
  ])
  return { hasPassword: credential !== null, googleLinked: google !== null }
}

type SessionUser = {
  id: string
  name: string
  email: string
  username?: string | null
  phone?: string | null
  image?: string | null
}

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) throw new AppError('UNAUTHORIZED', 'Sign in required')
    const u = session.user as SessionUser
    const flags = await signInFlags(c.var.db, u.id)
    return ok(c, meOut, {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? null,
      phone: u.phone ?? null,
      image: u.image ?? null,
      ...flags,
    })
  })
  .put('/', v('json', meUpdate), async (c) => {
    const input = c.req.valid('json')
    const headers = c.req.raw.headers
    const session = await c.var.auth.api.getSession({ headers })
    if (!session) throw new AppError('UNAUTHORIZED', 'Sign in required')

    // `username` is owned by the Better Auth username plugin, which validates
    // format, length and uniqueness on /update-user. APIErrors there carry
    // user-facing messages and are mapped to a uniform 422 below; anything
    // else is an internal failure whose message must not reach the client.
    try {
      await c.var.auth.api.updateUser({
        headers,
        body: {
          name: input.name,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
        },
      })
    } catch (e) {
      if (e instanceof AppError) {
        throw e
      }
      const msg = isAPIError(e) ? e.message : 'Update failed'
      throw new AppError('VALIDATION_ERROR', msg, { cause: 'better-auth' })
    }
    const fresh = await c.var.auth.api.getSession({ headers })
    const u = fresh?.user as SessionUser | undefined
    if (!u) throw new AppError('UNAUTHORIZED', 'Sign in required')
    const flags = await signInFlags(c.var.db, u.id)
    return ok(c, meOut, {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? null,
      phone: u.phone ?? null,
      image: u.image ?? null,
      ...flags,
    })
  })
  // Better Auth's setPassword is server-only, so it is re-exposed here for a
  // Google-only user to add a password. Errors (password already set, session
  // not fresh) carry user-facing messages and map to a uniform 422.
  .post('/set-password', v('json', setPasswordInput), async (c) => {
    const headers = c.req.raw.headers
    const session = await c.var.auth.api.getSession({ headers })
    if (!session) throw new AppError('UNAUTHORIZED', 'Sign in required')
    try {
      await c.var.auth.api.setPassword({ headers, body: { newPassword: c.req.valid('json').newPassword } })
    } catch (e) {
      if (e instanceof AppError) throw e
      const msg = isAPIError(e) ? e.message : 'Could not set the password'
      throw new AppError('VALIDATION_ERROR', msg, { cause: 'better-auth' })
    }
    return c.json({ status: true })
  })
