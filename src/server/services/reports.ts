import type { z } from 'zod'
import { Prisma } from '~/generated/prisma/client'
import type { DashboardDto, MonthlyDto, MonthlyRowDto, TripFilters, tripFilters } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { addMonths, monthsBetween, todayIst } from '../lib/dates'
import { dec, money } from '../lib/money'
import { TRIP_COST_FIELDS } from './calc'
import { TRIP_FROM, listTripRows, toTripRowDto, tripTotals, tripWhere } from './tripQuery'

const sql = Prisma.sql
type Num = { toString(): string }

type MonthSql = { month: string; trip_count: bigint; total: Num } & Record<
  'diesel' | 'adblue' | 'royalty' | 'toll_taxes' | 'driver_salary' | 'miscellaneous' | 'labour',
  Num
>

const SNAKE = {
  diesel: 'diesel',
  adblue: 'adblue',
  royalty: 'royalty',
  tollTaxes: 'toll_taxes',
  driverSalary: 'driver_salary',
  miscellaneous: 'miscellaneous',
  labour: 'labour',
} as const

/**
 * Monthly expense summary aggregated from trip_cost rows, bucketed by the
 * trip's trip_date (IST calendar month). Nothing is stored; it always
 * reflects the current trip records.
 */
export async function monthlySummary(db: DbOrTx, userId: string, f: Partial<TripFilters>): Promise<MonthlyDto> {
  const rows = await db.$queryRaw<MonthSql[]>(sql`
    SELECT
      to_char(t."trip_date", 'YYYY-MM')      AS month,
      COUNT(*)::bigint                        AS trip_count,
      COALESCE(SUM(c."diesel"), 0)            AS diesel,
      COALESCE(SUM(c."adblue"), 0)            AS adblue,
      COALESCE(SUM(c."royalty"), 0)           AS royalty,
      COALESCE(SUM(c."toll_taxes"), 0)        AS toll_taxes,
      COALESCE(SUM(c."driver_salary"), 0)     AS driver_salary,
      COALESCE(SUM(c."miscellaneous"), 0)     AS miscellaneous,
      COALESCE(SUM(c."labour"), 0)            AS labour,
      COALESCE(SUM(f."total_trip_cost"), 0)   AS total
    ${TRIP_FROM} ${tripWhere(userId, f)}
    GROUP BY 1 ORDER BY 1`)

  const byMonth = new Map(rows.map((r) => [r.month, r]))
  const first = f.from ?? (rows[0] ? `${rows[0].month}-01` : null)
  const last = f.to ?? (rows.length ? `${rows[rows.length - 1].month}-01` : null)
  const monthKeys = first && last ? monthsBetween(first, last) : []

  let prevTotal: ReturnType<typeof dec> | null = null
  const months: MonthlyRowDto[] = monthKeys.map((m) => {
    const r = byMonth.get(m)
    const total = dec(r?.total ?? 0)
    const row: MonthlyRowDto = {
      month: m,
      tripCount: Number(r?.trip_count ?? 0),
      ...(Object.fromEntries(TRIP_COST_FIELDS.map((k) => [k, money(r?.[SNAKE[k]] ?? 0)])) as Record<
        (typeof TRIP_COST_FIELDS)[number],
        string
      >),
      total: money(total),
      changeFromPrevious: prevTotal === null ? null : money(total.minus(prevTotal)),
    }
    prevTotal = total
    return row
  })

  const totals = {
    tripCount: months.reduce((a, m) => a + m.tripCount, 0),
    ...(Object.fromEntries(
      TRIP_COST_FIELDS.map((k) => [k, money(months.reduce((a, m) => a.plus(dec(m[k])), dec(0)))]),
    ) as Record<(typeof TRIP_COST_FIELDS)[number], string>),
    total: money(months.reduce((a, m) => a.plus(dec(m.total)), dec(0))),
  }
  return { from: f.from ?? null, to: f.to ?? null, months, totals }
}

export async function dashboard(db: DbOrTx, userId: string, f: z.infer<typeof tripFilters>): Promise<DashboardDto> {
  // Monthly chart defaults to the last 6 IST months when no range is given.
  const today = todayIst()
  const monthlyFilters = f.from || f.to ? f : { ...f, from: addMonths(today, -5), to: today }
  const [trucks, drivers, customers, bellas, totals, monthly, recent] = await Promise.all([
    db.truck.count({ where: { userId } }),
    db.driver.count({ where: { userId } }),
    db.customer.count({ where: { userId } }),
    db.bella.count({ where: { userId } }),
    tripTotals(db, userId, f),
    monthlySummary(db, userId, monthlyFilters),
    listTripRows(db, userId, f, { sort: 'tripDate', order: 'desc', page: 1, pageSize: 10 }),
  ])
  return {
    counts: { trips: totals.tripCount, trucks, drivers, customers, bellas },
    totals,
    monthly,
    recentTrips: recent.rows.map(toTripRowDto),
  }
}
