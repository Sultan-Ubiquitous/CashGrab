import { Hono } from 'hono'
import { z } from 'zod'
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
    const res = await c.var.auth.api.updateUser({
      headers: c.req.raw.headers,
      body: {
        name: input.name,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
      },
    })
    if (!res) throw new AppError('UNAUTHORIZED', 'Sign in required')
    return c.json(res)
  })
