/**
 * Request and response contracts shared by the Hono API and the React UI.
 * Money and measured quantities travel as strings ("1234.50") so no value is
 * ever converted to a binary float.
 */
import { z } from 'zod'
import { isValidIsoDate } from './dates'
import { MONEY_RE, MEASURE_RE, QUANTITY_MAX, SIGNED_MONEY_RE } from './validators'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
export const moneyIn = z.string().trim().regex(MONEY_RE, 'Enter a non-negative amount with at most 2 decimals')
export const signedMoneyIn = z.string().trim().regex(SIGNED_MONEY_RE, 'Enter an amount with at most 2 decimals')
// Non-negative and contains a non-zero digit => strictly positive (no float math).
export const positiveMoneyIn = moneyIn.refine((v) => /[1-9]/.test(v), 'Amount must be greater than 0')
/** km, litres: non-negative, 2 decimals, max 10 integer digits. */
export const measureIn = z
  .string()
  .trim()
  .regex(MEASURE_RE, 'Enter a non-negative number with at most 2 decimals')
export const isoDate = z.string().refine(isValidIsoDate, 'Use a valid date (YYYY-MM-DD)')
export const id = z.string().trim().min(1).max(64)
const text = (max: number) => z.string().trim().min(1, 'Required').max(max)
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,19}$/, 'Enter a valid phone number')

const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional()

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export const truckInput = z.object({
  registrationNumber: text(20),
  dieselCost: moneyIn,
  dieselLiters: measureIn,
  distanceTraveled: measureIn,
})
export const truckUpdate = truckInput.partial()

export const driverInput = z.object({ name: text(120), phone })
export const driverUpdate = driverInput.partial()

export const customerInput = z.object({
  name: text(120),
  phone: phone.nullable().optional(),
  location: text(200),
})
export const customerUpdate = customerInput.partial()

/** Bella page edits (rule 2b): informational fields only. */
export const bellaUpdate = z
  .object({ source: text(200), sourceOwnership: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

export const tripCostInput = z.object({
  diesel: moneyIn.default('0'),
  adblue: moneyIn.default('0'),
  royalty: moneyIn.default('0'),
  tollTaxes: moneyIn.default('0'),
  driverSalary: moneyIn.default('0'),
  miscellaneous: moneyIn.default('0'),
  labour: moneyIn.default('0'),
})

export const tripBellaInput = z.object({
  source: text(200),
  quantity: z.number().int().min(0).max(QUANTITY_MAX),
  costPrice: moneyIn,
  sellingPrice: moneyIn,
  sourceOwnership: z.boolean(),
})

const tripBase = {
  tripDate: isoDate,
  distance: measureIn,
  startPoint: text(200),
  endPoint: text(200),
}

/** Either an existing record id or a new record to create inline with the trip. */
const refOrNew = <T extends z.ZodTypeAny>(input: T) =>
  z
    .object({ id: id.optional(), new: input.optional() })
    .refine((v) => (v.id ? !v.new : !!v.new), 'Pick an existing record or fill in a new one')

export const tripCreate = z.object({
  ...tripBase,
  customer: refOrNew(customerInput),
  truck: refOrNew(truckInput),
  driver: refOrNew(driverInput),
  includeBrickCost: z.boolean().default(true),
  bella: tripBellaInput,
  costs: tripCostInput,
  netMarginOverride: signedMoneyIn.nullable().optional(),
})

export const tripUpdate = z
  .object({
    ...tripBase,
    customerId: id.optional(),
    truckId: id.optional(),
    driverId: id.optional(),
    includeBrickCost: z.boolean(),
    bella: tripBellaInput.partial(),
    costs: z
      .object({
        diesel: moneyIn,
        adblue: moneyIn,
        royalty: moneyIn,
        tollTaxes: moneyIn,
        driverSalary: moneyIn,
        miscellaneous: moneyIn,
        labour: moneyIn,
      })
      .partial(),
  })
  .partial()

export const marginOverrideInput = z.object({ netMarginOverride: signedMoneyIn.nullable() })

export const paymentInput = z.object({
  amount: positiveMoneyIn,
  paidOn: isoDate.optional(),
  note: z.string().trim().max(500).nullable().optional(),
})
export const paymentUpdate = paymentInput.partial()

// ---------------------------------------------------------------------------
// List queries
// ---------------------------------------------------------------------------
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().max(100).optional(),
})

const dateRange = {
  from: isoDate.optional(),
  to: isoDate.optional(),
}
const checkRange = (v: { from?: string; to?: string }) => !v.from || !v.to || v.from <= v.to
const rangeMsg = { message: '"from" must be on or before "to"', path: ['from'] }

export const tripFilters = z
  .object({
    ...dateRange,
    customerId: id.optional(),
    truckId: id.optional(),
    driverId: id.optional(),
    paymentDue: boolQuery,
    sourceOwnership: boolQuery,
    marginOverridden: boolQuery,
    q: z.string().trim().max(100).optional(),
  })
  .refine(checkRange, rangeMsg)
export type TripFilters = z.infer<typeof tripFilters>

export const TRIP_SORTS = [
  'tripDate',
  'createdAt',
  'distance',
  'revenue',
  'totalTripCost',
  'netMarginEffective',
  'amountRemaining',
] as const
export const tripListQuery = pageQuery
  .omit({ q: true })
  .extend({ sort: z.enum(TRIP_SORTS).default('tripDate') })
  .and(tripFilters)

/** Filters for truck/driver/customer lists (created_at range, IST). */
export const masterFilters = z
  .object({ ...dateRange, q: z.string().trim().max(100).optional() })
  .refine(checkRange, rangeMsg)
export const masterListQuery = pageQuery
  .omit({ q: true })
  .extend({ sort: z.enum(['createdAt', 'name', 'tripCount']).default('createdAt') })
  .and(masterFilters)
export const truckListQuery = pageQuery
  .omit({ q: true })
  .extend({
    sort: z
      .enum(['createdAt', 'registrationNumber', 'distanceTraveled', 'dieselCost', 'tripCount'])
      .default('createdAt'),
  })
  .and(masterFilters)

/** Bella / trip-cost lists are dated by their trip's trip_date. */
export const bellaFilters = z
  .object({ ...dateRange, sourceOwnership: boolQuery, q: z.string().trim().max(100).optional() })
  .refine(checkRange, rangeMsg)
export const bellaListQuery = pageQuery
  .omit({ q: true })
  .extend({ sort: z.enum(['tripDate', 'createdAt', 'quantity', 'source']).default('tripDate') })
  .and(bellaFilters)

export const paymentFilters = z
  .object({ ...dateRange, tripId: id.optional(), customerId: id.optional(), q: z.string().trim().max(100).optional() })
  .refine(checkRange, rangeMsg)
export const paymentListQuery = pageQuery
  .omit({ q: true })
  .extend({ sort: z.enum(['paidOn', 'amount', 'createdAt']).default('paidOn') })
  .and(paymentFilters)

export const monthlyQuery = z
  .object({
    ...dateRange,
    customerId: id.optional(),
    truckId: id.optional(),
    driverId: id.optional(),
    paymentDue: boolQuery,
  })
  .refine(checkRange, rangeMsg)

// ---------------------------------------------------------------------------
// Response contracts
// ---------------------------------------------------------------------------
const moneyOut = z.string().regex(/^-?\d+\.\d{2}$/)
const dateOut = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const tsOut = z.string() // ISO-8601 UTC

export const truckOut = z.object({
  id: z.string(),
  registrationNumber: z.string(),
  dieselCost: moneyOut,
  dieselLiters: moneyOut,
  distanceTraveled: moneyOut,
  mileageKmPerLiter: moneyOut.nullable(),
  costPerKm: moneyOut.nullable(),
  tripCount: z.number().int(),
  createdAt: tsOut,
})
export type TruckDto = z.infer<typeof truckOut>

export const driverOut = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  tripCount: z.number().int(),
  createdAt: tsOut,
})
export type DriverDto = z.infer<typeof driverOut>

export const customerOut = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  location: z.string(),
  tripCount: z.number().int(),
  createdAt: tsOut,
})
export type CustomerDto = z.infer<typeof customerOut>

export const tripCostOut = z.object({
  id: z.string(),
  diesel: moneyOut,
  adblue: moneyOut,
  royalty: moneyOut,
  tollTaxes: moneyOut,
  driverSalary: moneyOut,
  miscellaneous: moneyOut,
  labour: moneyOut,
  total: moneyOut,
})
export type TripCostDto = z.infer<typeof tripCostOut>

export const bellaOut = z.object({
  id: z.string(),
  tripId: z.string().nullable(),
  tripDate: dateOut.nullable(),
  source: z.string(),
  quantity: z.number().int(),
  costPrice: moneyOut,
  sellingPrice: moneyOut,
  sourceOwnership: z.boolean(),
  createdAt: tsOut,
})
export type BellaDto = z.infer<typeof bellaOut>

export const financialsOut = z.object({
  revenue: moneyOut,
  brickCost: moneyOut,
  totalTripCost: moneyOut,
  netMarginCalculated: moneyOut,
  netMarginOverride: moneyOut.nullable(),
  netMarginEffective: moneyOut,
  isMarginOverridden: z.boolean(),
  amountReceived: moneyOut,
  amountRemaining: moneyOut,
})

export const tripRowOut = z.object({
  id: z.string(),
  tripDate: dateOut,
  customer: z.object({ id: z.string(), name: z.string() }),
  truck: z.object({ id: z.string(), registrationNumber: z.string() }),
  driver: z.object({ id: z.string(), name: z.string() }),
  bellaId: z.string(),
  tripCostId: z.string(),
  startPoint: z.string(),
  endPoint: z.string(),
  distance: moneyOut,
  brickQuantity: z.number().int(),
  brickCostPrice: moneyOut,
  brickSellingPrice: moneyOut,
  brickSourceOwnership: z.boolean(),
  includeBrickCost: z.boolean(),
  paymentDue: z.boolean(),
  financials: financialsOut,
  createdAt: tsOut,
})
export type TripRowDto = z.infer<typeof tripRowOut>

export const paymentOut = z.object({
  id: z.string(),
  tripId: z.string(),
  amount: moneyOut,
  paidOn: dateOut,
  note: z.string().nullable(),
  createdAt: tsOut,
})
export type PaymentDto = z.infer<typeof paymentOut>

export const paymentRowOut = paymentOut.extend({
  tripDate: dateOut,
  customer: z.object({ id: z.string(), name: z.string() }),
})
export type PaymentRowDto = z.infer<typeof paymentRowOut>

export const tripDetailOut = tripRowOut.extend({
  bella: bellaOut,
  costs: tripCostOut,
  payments: z.array(paymentOut),
  canEditBrickFigures: z.boolean(),
  updatedAt: tsOut,
})
export type TripDetailDto = z.infer<typeof tripDetailOut>

export const pageOut = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
export interface PageDto<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export const tripTotalsOut = z.object({
  tripCount: z.number().int(),
  revenue: moneyOut,
  brickCost: moneyOut,
  totalTripCost: moneyOut,
  netMarginCalculated: moneyOut,
  netMarginEffective: moneyOut,
  overriddenCount: z.number().int(),
  amountReceived: moneyOut,
  outstanding: moneyOut,
  dueTripCount: z.number().int(),
})
export type TripTotalsDto = z.infer<typeof tripTotalsOut>

export const monthlyRowOut = z.object({
  month: z.string(),
  tripCount: z.number().int(),
  diesel: moneyOut,
  adblue: moneyOut,
  royalty: moneyOut,
  tollTaxes: moneyOut,
  driverSalary: moneyOut,
  miscellaneous: moneyOut,
  labour: moneyOut,
  total: moneyOut,
  /** total − previous month's total; null for the first month in range. */
  changeFromPrevious: moneyOut.nullable(),
})
export type MonthlyRowDto = z.infer<typeof monthlyRowOut>

export const monthlyOut = z.object({
  from: dateOut.nullable(),
  to: dateOut.nullable(),
  months: z.array(monthlyRowOut),
  totals: monthlyRowOut.omit({ month: true, changeFromPrevious: true }),
})
export type MonthlyDto = z.infer<typeof monthlyOut>

export const dashboardOut = z.object({
  counts: z.object({
    trips: z.number().int(),
    trucks: z.number().int(),
    drivers: z.number().int(),
    customers: z.number().int(),
    bellas: z.number().int(),
  }),
  totals: tripTotalsOut,
  monthly: monthlyOut,
  recentTrips: z.array(tripRowOut),
})
export type DashboardDto = z.infer<typeof dashboardOut>

export const meOut = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  phone: z.string().nullable(),
  image: z.string().nullable(),
})
export type MeDto = z.infer<typeof meOut>
