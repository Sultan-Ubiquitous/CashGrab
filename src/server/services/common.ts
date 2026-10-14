import { istDayEndExclusiveUtc, istDayStartUtc } from '~/shared/dates'

/** Inclusive IST calendar range -> Prisma filter on a timestamptz column. */
export function createdAtRange(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: istDayStartUtc(from) } : {}),
    ...(to ? { lt: istDayEndExclusiveUtc(to) } : {}),
  }
}

export const insensitive = (q: string) => ({ contains: q, mode: 'insensitive' as const })

/** Normalises a registration number so "mh 12 ab 1234" and "MH 12 AB  1234" collide. */
export function normaliseRegistration(s: string) {
  return s.trim().replace(/\s+/g, ' ').toUpperCase()
}
