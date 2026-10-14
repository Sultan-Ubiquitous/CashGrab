import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Auth } from './auth'
import type { Db } from './db'
import { id } from '~/shared/schemas'

export interface AppVars {
  db: Db
  auth: Auth
  /** Authenticated user id — taken from the session only, never from input. */
  userId: string
  /** Set by streaming routes that close the DB themselves when the body ends. */
  streamOwnsDb?: boolean
}
export type AppEnv = { Variables: AppVars }
export type Ctx = Context<AppEnv>

/** Request validation; failures surface as uniform 422 errors via onError. */
export const v = <T extends z.ZodType, Target extends 'json' | 'query' | 'param'>(target: Target, schema: T) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw result.error
  })

/** Route id parameter, shared by every `:id` route. */
export const idParam = z.object({ id })

/** Response validation: the payload must satisfy its published contract. */
export function ok<T extends z.ZodType>(c: Ctx, schema: T, data: z.input<T>, status: ContentfulStatusCode = 200) {
  return c.json(schema.parse(data) as z.output<T>, status)
}
