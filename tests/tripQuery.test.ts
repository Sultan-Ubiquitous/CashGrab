import { describe, expect, it } from 'vitest'
import { likePattern, tripOrder, tripWhere } from '~/server/services/tripQuery'

describe('likePattern', () => {
  it('escapes LIKE wildcards so user input matches literally', () => {
    expect(likePattern('100% cotton_\\king')).toBe('%100\\% cotton\\_\\\\king%')
  })

  it('wraps plain text in wildcards', () => {
    expect(likePattern('sharma')).toBe('%sharma%')
  })
})

describe('tripOrder', () => {
  it('only ever emits whitelisted identifiers', () => {
    expect(tripOrder('revenue', 'desc').sql).toBe(
      'ORDER BY f."revenue" DESC, t."created_at" DESC, t."id" DESC',
    )
    expect(tripOrder('tripDate', 'asc').sql).toBe('ORDER BY t."trip_date" ASC, t."created_at" ASC, t."id" ASC')
    for (const sort of [
      'tripDate',
      'createdAt',
      'distance',
      'revenue',
      'totalTripCost',
      'netMarginEffective',
      'amountRemaining',
    ] as const) {
      expect(tripOrder(sort, 'asc').sql).toContain('ORDER BY')
    }
  })
})

describe('tripWhere', () => {
  it('always scopes to the session user id as bound values, never interpolated text', () => {
    const where = tripWhere('user-1', {})
    expect(where.values).toContain('user-1')
    expect(where.sql).toContain('"user_id"')
    expect(where.sql).not.toContain('user-1')
  })

  it('binds every filter as a value', () => {
    const where = tripWhere('user-1', {
      from: '2026-10-01',
      to: '2026-10-31',
      customerId: 'cust-9',
      paymentDue: true,
      q: '100%_x',
    })
    expect(where.values).toContain('cust-9')
    expect(where.values).toContain(true)
    expect(where.values).toContain('%100\\%\\_x%')
    expect(where.sql).not.toContain('cust-9')
  })
})
