import Decimal from 'decimal.js'

/**
 * All money/quantity arithmetic goes through decimal.js (never JS floats).
 * Values coming from Prisma are Prisma.Decimal instances; they are converted
 * through their string form so the two Decimal implementations never mix.
 */
export type DecimalInput = Decimal.Value | { toString(): string }

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export type Dec = InstanceType<typeof D>

export function dec(v: DecimalInput | null | undefined): Dec {
  if (v === null || v === undefined) return new D(0)
  if (typeof v === 'number' || typeof v === 'string') return new D(v)
  if (v instanceof D) return v
  return new D(v.toString())
}

/** Rounds half-up to 2 places and returns a canonical string, e.g. "1234.50". */
export function money(v: DecimalInput | null | undefined): string {
  return dec(v).toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2)
}

export function moneyOrNull(v: DecimalInput | null | undefined): string | null {
  return v === null || v === undefined ? null : money(v)
}

export function sum(values: Iterable<DecimalInput | null | undefined>): Dec {
  let acc = new D(0)
  for (const v of values) acc = acc.plus(dec(v))
  return acc
}

export { D as Decimal }
