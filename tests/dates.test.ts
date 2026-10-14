import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dateOnlyToDb,
  dbDateToIso,
  formatIstDateTime,
  isValidIsoDate,
  istDayEndExclusiveUtc,
  istDayStartUtc,
  istWallClock,
  monthsBetween,
  todayIst,
} from '~/shared/dates'

describe('IST date semantics', () => {
  it('today is an IST calendar date', () => {
    expect(todayIst()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('inclusive day ranges become [start, next-day) UTC instants', () => {
    expect(istDayStartUtc('2026-10-05').toISOString()).toBe('2026-10-04T18:30:00.000Z')
    expect(istDayEndExclusiveUtc('2026-10-05').toISOString()).toBe('2026-10-05T18:30:00.000Z')
  })

  it('monthsBetween and addMonths (month-start semantics)', () => {
    expect(monthsBetween('2026-08-17', '2026-10-01')).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(addMonths('2026-10-31', -5)).toBe('2026-05-01')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-01')
  })

  it('rejects impossible calendar dates', () => {
    expect(isValidIsoDate('2026-10-05')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('not-a-date')).toBe(false)
    expect(isValidIsoDate('2026-1-5')).toBe(false)
  })

  it('round-trips DATE columns without timezone drift', () => {
    expect(dbDateToIso(dateOnlyToDb('2026-10-05'))).toBe('2026-10-05')
    expect(() => dateOnlyToDb('2026-02-30')).toThrow('Invalid date')
  })

  it('formats instants in IST', () => {
    const d = new Date('2026-10-05T18:30:00.000Z')
    expect(formatIstDateTime(d)).toBe('2026-10-06 00:00:00')
    expect(istWallClock(d).toISOString()).toBe('2026-10-06T00:00:00.000Z')
  })

  it('monthsBetween covers a single month and caps runaway ranges', () => {
    expect(monthsBetween('2026-10-01', '2026-10-31')).toEqual(['2026-10'])
    expect(monthsBetween('2000-01-01', '2200-01-01').length).toBeLessThanOrEqual(601)
  })
})
