import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Prisma } from '~/generated/prisma/client'
import { AppError, toErrorResponse } from '~/server/lib/errors'

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db failure', { code, clientVersion: 'test' })
}

describe('toErrorResponse', () => {
  it('passes AppError through with its status, message and details', () => {
    const { status, body } = toErrorResponse(new AppError('OVERPAYMENT', 'Too much', { amountRemaining: '5.00' }))
    expect(status).toBe(422)
    expect(body.error).toMatchObject({ code: 'OVERPAYMENT', message: 'Too much' })
    expect(body.error.details).toEqual({ amountRemaining: '5.00' })
  })

  it('maps ZodError to 422 with per-field details', () => {
    const parsed = z.object({ amount: z.string() }).safeParse({})
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    const { status, body } = toErrorResponse(parsed.error)
    expect(status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([{ path: 'amount', message: expect.any(String) }])
  })

  it('maps Prisma race guards to precise statuses', () => {
    expect(toErrorResponse(knownError('P2002')).status).toBe(409)
    expect(toErrorResponse(knownError('P2002')).body.error.code).toBe('DUPLICATE')
    expect(toErrorResponse(knownError('P2003')).status).toBe(409)
    expect(toErrorResponse(knownError('P2003')).body.error.code).toBe('IN_USE')
    expect(toErrorResponse(knownError('P2025')).status).toBe(404)
  })

  it('maps CHECK-constraint violations to a generic 422', () => {
    const err = new Error('new row violates check constraint "trip_skip_brick_cost_only_own_kiln_chk"')
    const { status, body } = toErrorResponse(err)
    expect(status).toBe(422)
    expect(body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'A value violates a data rule' })
  })

  it('never leaks internal messages on unexpected failures', () => {
    const leaked = toErrorResponse(new Error('connect ECONNREFUSED password=hunter2'))
    expect(leaked.status).toBe(500)
    expect(leaked.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' })
    const thrown = toErrorResponse('plain string throw')
    expect(thrown.status).toBe(500)
    expect(thrown.body.error.message).toBe('Something went wrong')
  })
})
