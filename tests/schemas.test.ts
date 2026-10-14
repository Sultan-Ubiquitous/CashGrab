import { describe, expect, it } from 'vitest'
import {
  bellaUpdate,
  isoDate,
  marginOverrideInput,
  measureIn,
  moneyIn,
  pageQuery,
  positiveMoneyIn,
  tripCreate,
  tripFilters,
} from '~/shared/schemas'

const validTripBase = {
  tripDate: '2026-10-05',
  distance: '120.5',
  startPoint: 'Kiln',
  endPoint: 'Depot',
  bella: { source: 'K', quantity: 10, costPrice: '5.00', sellingPrice: '8.00', sourceOwnership: false },
  costs: {},
}
const ids = { customer: { id: 'c1' }, truck: { id: 't1' }, driver: { id: 'd1' } }

describe('money inputs', () => {
  it('rejects negatives, >2 decimals and >12 integer digits', () => {
    expect(moneyIn.safeParse('1500.25').success).toBe(true)
    expect(moneyIn.safeParse(' 5.00 ').success).toBe(true)
    expect(moneyIn.safeParse('-5.00').success).toBe(false)
    expect(moneyIn.safeParse('1.234').success).toBe(false)
    expect(moneyIn.safeParse('123456789012.99').success).toBe(true)
    expect(moneyIn.safeParse('1234567890123').success).toBe(false)
  })

  it('positiveMoneyIn rejects zero without float math', () => {
    expect(positiveMoneyIn.safeParse('0').success).toBe(false)
    expect(positiveMoneyIn.safeParse('0.00').success).toBe(false)
    expect(positiveMoneyIn.safeParse('0.01').success).toBe(true)
  })

  it('measureIn bounds km/litres', () => {
    expect(measureIn.safeParse('120.50').success).toBe(true)
    expect(measureIn.safeParse('12345678901').success).toBe(false)
    expect(measureIn.safeParse('abc').success).toBe(false)
  })

  it('isoDate rejects impossible calendar dates', () => {
    expect(isoDate.safeParse('2026-10-05').success).toBe(true)
    expect(isoDate.safeParse('2026-02-30').success).toBe(false)
    expect(isoDate.safeParse('2026-13-01').success).toBe(false)
  })
})

describe('trip create/update contracts', () => {
  it('requires exactly one of id / new per master reference', () => {
    expect(tripCreate.safeParse({ ...validTripBase, ...ids }).success).toBe(true)
    expect(tripCreate.safeParse({ ...validTripBase, customer: {}, truck: { id: 't1' }, driver: { id: 'd1' } }).success).toBe(
      false,
    )
    expect(
      tripCreate.safeParse({
        ...validTripBase,
        customer: { id: 'c1', new: { name: 'N', phone: null, location: 'L' } },
        truck: { id: 't1' },
        driver: { id: 'd1' },
      }).success,
    ).toBe(false)
  })

  it('rejects inverted date ranges', () => {
    expect(tripFilters.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(false)
    expect(tripFilters.safeParse({ from: '2026-10-01', to: '2026-10-02' }).success).toBe(true)
    expect(tripFilters.safeParse({}).success).toBe(true)
  })

  it('bellaUpdate requires at least one field', () => {
    expect(bellaUpdate.safeParse({}).success).toBe(false)
    expect(bellaUpdate.safeParse({ source: 'K' }).success).toBe(true)
  })

  it('margin override accepts signed values and null (clear)', () => {
    expect(marginOverrideInput.safeParse({ netMarginOverride: '-5.00' }).success).toBe(true)
    expect(marginOverrideInput.safeParse({ netMarginOverride: null }).success).toBe(true)
    expect(marginOverrideInput.safeParse({}).success).toBe(false)
  })

  it('pageQuery bounds pagination', () => {
    expect(pageQuery.safeParse({ page: 0 }).success).toBe(false)
    expect(pageQuery.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(pageQuery.safeParse({ order: 'up' }).success).toBe(false)
    expect(pageQuery.safeParse({}).success).toBe(true)
  })
})
