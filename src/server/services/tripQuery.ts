/**
 * The single trip filter/aggregation layer. Trip lists, dashboard totals,
 * monthly summaries, filtered reports and exports all build their SQL here,
 * on top of the "trip_financials" view, so every screen and file agrees.
 */
import { Prisma } from '~/generated/prisma/client'
import type { TripFilters, TripRowDto, TripTotalsDto } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { dbDateToIso } from '../lib/dates'
import { money, moneyOrNull } from '../lib/money'

const sql = Prisma.sql

export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

/** FROM clause shared by every trip query (aliases: t, f, c, cu, tr, dr, b). */
export const TRIP_FROM = sql`
  FROM "trip" t
  JOIN "trip_financials" f ON f."trip_id" = t."id"
  JOIN "trip_cost" c ON c."id" = t."trip_cost_id" AND c."user_id" = t."user_id"
  JOIN "customer" cu ON cu."id" = t."customer_id" AND cu."user_id" = t."user_id"
  JOIN "truck" tr ON tr."id" = t."truck_id" AND tr."user_id" = t."user_id"
  JOIN "driver" dr ON dr."id" = t."driver_id" AND dr."user_id" = t."user_id"
  JOIN "bella" b ON b."id" = t."bella_id" AND b."user_id" = t."user_id"`

/** WHERE clause. user_id always comes from the session, never the client. */
export function tripWhere(userId: string, f: Partial<TripFilters>): Prisma.Sql {
  const parts: Prisma.Sql[] = [sql`t."user_id" = ${userId}`]
  if (f.from) parts.push(sql`t."trip_date" >= ${f.from}::date`)
  if (f.to) parts.push(sql`t."trip_date" <= ${f.to}::date`)
  if (f.customerId) parts.push(sql`t."customer_id" = ${f.customerId}`)
  if (f.truckId) parts.push(sql`t."truck_id" = ${f.truckId}`)
  if (f.driverId) parts.push(sql`t."driver_id" = ${f.driverId}`)
  if (f.paymentDue !== undefined) parts.push(sql`t."payment_due" = ${f.paymentDue}`)
  if (f.sourceOwnership !== undefined) parts.push(sql`t."brick_source_ownership" = ${f.sourceOwnership}`)
  if (f.marginOverridden !== undefined) {
    parts.push(f.marginOverridden ? sql`t."net_margin_override" IS NOT NULL` : sql`t."net_margin_override" IS NULL`)
  }
  if (f.q) {
    const p = likePattern(f.q)
    parts.push(sql`(
      t."start_point" ILIKE ${p} OR t."end_point" ILIKE ${p} OR cu."name" ILIKE ${p}
      OR tr."registration_number" ILIKE ${p} OR dr."name" ILIKE ${p} OR b."source" ILIKE ${p}
    )`)
  }
  return sql`WHERE ${Prisma.join(parts, ' AND ')}`
}

const SORT_SQL = {
  tripDate: 't."trip_date"',
  createdAt: 't."created_at"',
  distance: 't."distance"',
  revenue: 'f."revenue"',
  totalTripCost: 'f."total_trip_cost"',
  netMarginEffective: 'f."net_margin_effective"',
  amountRemaining: 'f."amount_remaining"',
} as const
export type TripSort = keyof typeof SORT_SQL

export function tripOrder(sort: TripSort, order: 'asc' | 'desc') {
  const dir = order === 'asc' ? 'ASC' : 'DESC'
  // Whitelisted identifiers only; tie-break on created_at/id for stable pages.
  return Prisma.raw(`ORDER BY ${SORT_SQL[sort]} ${dir}, t."created_at" ${dir}, t."id" ${dir}`)
}

export const TRIP_COLUMNS = sql`
  t."id", t."trip_date", t."start_point", t."end_point", t."distance",
  t."brick_quantity", t."brick_cost_price", t."brick_selling_price", t."brick_source_ownership",
  t."include_brick_cost", t."payment_due", t."created_at", t."bella_id", t."trip_cost_id",
  t."customer_id", cu."name" AS "customer_name",
  t."truck_id", tr."registration_number" AS "truck_registration",
  t."driver_id", dr."name" AS "driver_name",
  b."source" AS "bella_source",
  c."diesel", c."adblue", c."royalty", c."toll_taxes", c."driver_salary", c."miscellaneous", c."labour",
  f."revenue", f."brick_cost", f."total_trip_cost", f."net_margin_calculated", f."net_margin_override",
  f."net_margin_effective", f."amount_received", f."amount_remaining"`

type Num = { toString(): string } | string | number
export interface TripSqlRow {
  id: string
  trip_date: Date
  start_point: string
  end_point: string
  distance: Num
  brick_quantity: number
  brick_cost_price: Num
  brick_selling_price: Num
  brick_source_ownership: boolean
  include_brick_cost: boolean
  payment_due: boolean
  created_at: Date
  bella_id: string
  trip_cost_id: string
  customer_id: string
  customer_name: string
  truck_id: string
  truck_registration: string
  driver_id: string
  driver_name: string
  bella_source: string
  diesel: Num
  adblue: Num
  royalty: Num
  toll_taxes: Num
  driver_salary: Num
  miscellaneous: Num
  labour: Num
  revenue: Num
  brick_cost: Num
  total_trip_cost: Num
  net_margin_calculated: Num
  net_margin_override: Num | null
  net_margin_effective: Num
  amount_received: Num
  amount_remaining: Num
}

export function toTripRowDto(r: TripSqlRow): TripRowDto {
  return {
    id: r.id,
    tripDate: dbDateToIso(r.trip_date),
    customer: { id: r.customer_id, name: r.customer_name },
    truck: { id: r.truck_id, registrationNumber: r.truck_registration },
    driver: { id: r.driver_id, name: r.driver_name },
    bellaId: r.bella_id,
    tripCostId: r.trip_cost_id,
    startPoint: r.start_point,
    endPoint: r.end_point,
    distance: money(r.distance),
    brickQuantity: Number(r.brick_quantity),
    brickCostPrice: money(r.brick_cost_price),
    brickSellingPrice: money(r.brick_selling_price),
    brickSourceOwnership: r.brick_source_ownership,
    includeBrickCost: r.include_brick_cost,
    paymentDue: r.payment_due,
    financials: {
      revenue: money(r.revenue),
      brickCost: money(r.brick_cost),
      totalTripCost: money(r.total_trip_cost),
      netMarginCalculated: money(r.net_margin_calculated),
      netMarginOverride: moneyOrNull(r.net_margin_override),
      netMarginEffective: money(r.net_margin_effective),
      isMarginOverridden: r.net_margin_override !== null,
      amountReceived: money(r.amount_received),
      amountRemaining: money(r.amount_remaining),
    },
    createdAt: new Date(r.created_at).toISOString(),
  }
}

export async function listTripRows(
  db: DbOrTx,
  userId: string,
  f: Partial<TripFilters>,
  opts: { sort: TripSort; order: 'asc' | 'desc'; page: number; pageSize: number },
) {
  const where = tripWhere(userId, f)
  const offset = (opts.page - 1) * opts.pageSize
  const [rows, count] = await Promise.all([
    db.$queryRaw<TripSqlRow[]>(
      sql`SELECT ${TRIP_COLUMNS} ${TRIP_FROM} ${where} ${tripOrder(opts.sort, opts.order)} LIMIT ${opts.pageSize} OFFSET ${offset}`,
    ),
    db.$queryRaw<{ n: bigint }[]>(sql`SELECT COUNT(*)::bigint AS n ${TRIP_FROM} ${where}`),
  ])
  return { rows, total: Number(count[0]?.n ?? 0) }
}

/**
 * Keyset batches ordered by (trip_date, created_at, id) for exports: constant
 * memory and no OFFSET scans regardless of dataset size.
 */
export async function* tripRowBatches(db: DbOrTx, userId: string, f: Partial<TripFilters>, batchSize = 1000) {
  let after: { d: string; c: Date; id: string } | null = null
  const where = tripWhere(userId, f)
  for (;;) {
    const cursor: Prisma.Sql = after
      ? sql`AND (t."trip_date", t."created_at", t."id") > (${after.d}::date, ${after.c}::timestamptz, ${after.id})`
      : sql``
    const rows: TripSqlRow[] = await db.$queryRaw<TripSqlRow[]>(
      sql`SELECT ${TRIP_COLUMNS} ${TRIP_FROM} ${where} ${cursor}
          ORDER BY t."trip_date" ASC, t."created_at" ASC, t."id" ASC LIMIT ${batchSize}`,
    )
    if (rows.length === 0) return
    yield rows
    if (rows.length < batchSize) return
    const last: TripSqlRow = rows[rows.length - 1]
    after = { d: dbDateToIso(last.trip_date), c: last.created_at, id: last.id }
  }
}

export async function tripTotals(db: DbOrTx, userId: string, f: Partial<TripFilters>): Promise<TripTotalsDto> {
  const rows = await db.$queryRaw<
    {
      trip_count: bigint
      revenue: Num
      brick_cost: Num
      total_trip_cost: Num
      net_margin_calculated: Num
      net_margin_effective: Num
      overridden_count: bigint
      amount_received: Num
      outstanding: Num
      due_trip_count: bigint
    }[]
  >(sql`
    SELECT
      COUNT(*)::bigint                                            AS trip_count,
      COALESCE(SUM(f."revenue"), 0)                               AS revenue,
      COALESCE(SUM(f."brick_cost"), 0)                            AS brick_cost,
      COALESCE(SUM(f."total_trip_cost"), 0)                       AS total_trip_cost,
      COALESCE(SUM(f."net_margin_calculated"), 0)                 AS net_margin_calculated,
      COALESCE(SUM(f."net_margin_effective"), 0)                  AS net_margin_effective,
      COUNT(*) FILTER (WHERE t."net_margin_override" IS NOT NULL)::bigint AS overridden_count,
      COALESCE(SUM(f."amount_received"), 0)                       AS amount_received,
      COALESCE(SUM(f."amount_remaining") FILTER (WHERE t."payment_due"), 0) AS outstanding,
      COUNT(*) FILTER (WHERE t."payment_due")::bigint             AS due_trip_count
    ${TRIP_FROM} ${tripWhere(userId, f)}`)
  const r = rows[0]
  return {
    tripCount: Number(r.trip_count),
    revenue: money(r.revenue),
    brickCost: money(r.brick_cost),
    totalTripCost: money(r.total_trip_cost),
    netMarginCalculated: money(r.net_margin_calculated),
    netMarginEffective: money(r.net_margin_effective),
    overriddenCount: Number(r.overridden_count),
    amountReceived: money(r.amount_received),
    outstanding: money(r.outstanding),
    dueTripCount: Number(r.due_trip_count),
  }
}
