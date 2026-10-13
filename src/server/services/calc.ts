/**
 * Business formulas — the ONLY place they are implemented in TypeScript.
 * The SQL view "trip_financials" (prisma/migrations/*_init) implements the
 * same rules for aggregation; tests assert both agree.
 *
 *   revenue            = brickQuantity × brickSellingPrice          (locked trip copy)
 *   brickCost          = includeBrickCost ? brickQuantity × brickCostPrice : 0
 *   totalTripCost      = diesel + adblue + royalty + tollTaxes + driverSalary + miscellaneous + labour
 *   netMarginCalculated= revenue − brickCost − totalTripCost
 *   netMarginEffective = netMarginOverride ?? netMarginCalculated
 *   amountReceived     = Σ payments.amount
 *   amountRemaining    = revenue − amountReceived
 *   paymentDue         = amountRemaining > 0
 *   truck mileage      = distanceTraveled / dieselLiters   (km per litre)
 *   truck cost per km  = dieselCost / distanceTraveled     (₹ per km)
 */
import { dec, money, moneyOrNull, sum, type Dec, type DecimalInput } from '../lib/money'

export const TRIP_COST_FIELDS = [
  'diesel',
  'adblue',
  'royalty',
  'tollTaxes',
  'driverSalary',
  'miscellaneous',
  'labour',
] as const
export type TripCostField = (typeof TRIP_COST_FIELDS)[number]
export type TripCostValues = Record<TripCostField, DecimalInput>

export function totalTripCost(cost: TripCostValues): Dec {
  return sum(TRIP_COST_FIELDS.map((f) => cost[f]))
}

export function tripRevenue(brickQuantity: number, brickSellingPrice: DecimalInput): Dec {
  return dec(brickQuantity).times(dec(brickSellingPrice))
}

export function tripBrickCost(brickQuantity: number, brickCostPrice: DecimalInput, includeBrickCost: boolean): Dec {
  return includeBrickCost ? dec(brickQuantity).times(dec(brickCostPrice)) : dec(0)
}

export interface TripMoneyInput {
  brickQuantity: number
  brickCostPrice: DecimalInput
  brickSellingPrice: DecimalInput
  includeBrickCost: boolean
  cost: TripCostValues
}

export function netMarginCalculated(t: TripMoneyInput): Dec {
  return tripRevenue(t.brickQuantity, t.brickSellingPrice)
    .minus(tripBrickCost(t.brickQuantity, t.brickCostPrice, t.includeBrickCost))
    .minus(totalTripCost(t.cost))
}

export function effectiveNetMargin(calculated: DecimalInput, override: DecimalInput | null | undefined): Dec {
  return override === null || override === undefined ? dec(calculated) : dec(override)
}

export function isPaymentDue(revenue: DecimalInput, amountReceived: DecimalInput): boolean {
  return dec(revenue).minus(dec(amountReceived)).greaterThan(0)
}

/** Brick cost may only be skipped when the bricks come from the user's own kiln. */
export function canSkipBrickCost(sourceOwnership: boolean): boolean {
  return sourceOwnership
}

export interface TripFinancials {
  revenue: string
  brickCost: string
  totalTripCost: string
  netMarginCalculated: string
  netMarginOverride: string | null
  netMarginEffective: string
  isMarginOverridden: boolean
  amountReceived: string
  amountRemaining: string
}

export function tripFinancials(
  t: TripMoneyInput & { netMarginCalculated: DecimalInput; netMarginOverride: DecimalInput | null },
  amountReceived: DecimalInput,
): TripFinancials {
  const revenue = tripRevenue(t.brickQuantity, t.brickSellingPrice)
  const received = dec(amountReceived)
  return {
    revenue: money(revenue),
    brickCost: money(tripBrickCost(t.brickQuantity, t.brickCostPrice, t.includeBrickCost)),
    totalTripCost: money(totalTripCost(t.cost)),
    netMarginCalculated: money(t.netMarginCalculated),
    netMarginOverride: moneyOrNull(t.netMarginOverride),
    netMarginEffective: money(effectiveNetMargin(t.netMarginCalculated, t.netMarginOverride)),
    isMarginOverridden: t.netMarginOverride !== null && t.netMarginOverride !== undefined,
    amountReceived: money(received),
    amountRemaining: money(revenue.minus(received)),
  }
}

/** km per litre; null when litres is 0. */
export function truckMileage(distanceTraveled: DecimalInput, dieselLiters: DecimalInput): string | null {
  const l = dec(dieselLiters)
  return l.isZero() ? null : money(dec(distanceTraveled).dividedBy(l))
}

/** ₹ per km; null when distance is 0. */
export function truckCostPerKm(dieselCost: DecimalInput, distanceTraveled: DecimalInput): string | null {
  const km = dec(distanceTraveled)
  return km.isZero() ? null : money(dec(dieselCost).dividedBy(km))
}
