import { Hono } from 'hono'
import { z } from 'zod'
import { isAPIError } from 'better-auth/api'
import { meOut, phone } from '~/shared/schemas'
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

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) throw new AppError('UNAUTHORIZED', 'Sign in required')
    const u = session.user as typeof session.user & { phone?: string | null }
    return ok(c, meOut, {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? null,
      phone: u.phone ?? null,
      image: u.image ?? null,
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
    const u = fresh?.user as typeof session.user & { username?: string | null; phone?: string | null }
    if (!u) throw new AppError('UNAUTHORIZED', 'Sign in required')
    return ok(c, meOut, {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? null,
      phone: u.phone ?? null,
      image: u.image ?? null,
    })
  })
