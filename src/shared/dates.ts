/**
 * Date semantics
 * - Business dates (trip_date, paid_on) are calendar dates in Asia/Kolkata,
 *   exchanged as "YYYY-MM-DD" and stored in Postgres DATE columns. Prisma maps
 *   DATE to a JS Date at 00:00 UTC of that day, so conversion is pure string work.
 * - Timestamps (created_at) are stored in UTC (timestamptz) and shown in IST.
 * - Date range filters are inclusive on both ends: from <= date <= to.
 *   For timestamps this becomes [from 00:00 IST, (to + 1 day) 00:00 IST).
 *
 * This module is pure (no runtime dependencies), so both the server and the
 * shared request/response contracts can import it.
 */
export const BUSINESS_TZ = 'Asia/Kolkata'
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000 // IST has no DST.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** "YYYY-MM-DD" -> Date at 00:00 UTC (the representation Prisma uses for DATE). */
export function dateOnlyToDb(s: string): Date {
  if (!isValidIsoDate(s)) throw new Error(`Invalid date: ${s}`)
  return new Date(`${s}T00:00:00.000Z`)
}

/** DATE column value -> "YYYY-MM-DD". */
export function dbDateToIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Today's calendar date in Asia/Kolkata as "YYYY-MM-DD". */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Start of an IST calendar day as a UTC instant. */
export function istDayStartUtc(s: string): Date {
  return new Date(dateOnlyToDb(s).getTime() - IST_OFFSET_MS)
}

/** Exclusive upper bound for an inclusive IST "to" date. */
export function istDayEndExclusiveUtc(s: string): Date {
  return new Date(istDayStartUtc(s).getTime() + 24 * 60 * 60 * 1000)
}

/** UTC instant -> IST wall clock "YYYY-MM-DD HH:mm:ss". */
export function formatIstDateTime(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ')
}

/** UTC instant -> a Date whose UTC fields equal the IST wall clock (for spreadsheets). */
export function istWallClock(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS)
}

/** "YYYY-MM" for every month from `from` to `to` (inclusive, by month). */
export function monthsBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  let y = +fromIso.slice(0, 4)
  let m = +fromIso.slice(5, 7)
  const endY = +toIso.slice(0, 4)
  const endM = +toIso.slice(5, 7)
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
    if (out.length > 600) break
  }
  return out
}

export function addMonths(iso: string, n: number): string {
  const d = dateOnlyToDb(iso)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  return dbDateToIso(target)
}
