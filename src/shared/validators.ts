/**
 * Input format rules — the single source shared by the zod contracts
 * (shared/schemas.ts, enforced on the server) and the lightweight predicates
 * used by client forms, so the two can never drift apart.
 */
export const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/
export const SIGNED_MONEY_RE = /^-?\d{1,12}(\.\d{1,2})?$/
/** km, litres, quantities-with-decimals: non-negative, 2 dp, max 10 integer digits. */
export const MEASURE_RE = /^\d{1,10}(\.\d{1,2})?$/
/** Whole brick quantities: 0 .. 100,000,000 (matches the server's int bounds). */
export const QUANTITY_RE = /^\d{1,9}$/
export const QUANTITY_MAX = 100_000_000

export const isMoneyStr = (v: string) => MONEY_RE.test(v.trim())
export const isSignedMoneyStr = (v: string) => SIGNED_MONEY_RE.test(v.trim())
export const isMeasureStr = (v: string) => MEASURE_RE.test(v.trim())
export const isQuantityStr = (v: string) => QUANTITY_RE.test(v.trim()) && Number(v.trim()) <= QUANTITY_MAX
export const isNonEmptyStr = (v: string) => v.trim().length > 0
