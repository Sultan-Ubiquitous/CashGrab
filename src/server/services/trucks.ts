import type { z } from 'zod'
import { Prisma } from '~/generated/prisma/client'
import type { truckInput, truckListQuery, truckUpdate, TruckDto, masterFilters } from '~/shared/schemas'
import { istDayEndExclusiveUtc, istDayStartUtc } from '~/shared/dates'
import type { DbOrTx } from '../db'
import { AppError, notFound } from '../lib/errors'
import { money } from '../lib/money'
import { toPage } from '../lib/pagination'
import { truckCostPerKm } from './calc'
import { normaliseRegistration } from './common'
import { likePattern } from './tripQuery'

/**
 * Truck reads go through the "truck_financials" view: a truck's diesel cost
 * and distance are the sums of its trips' diesel cost and distance. Nothing
 * derived is ever stored on the truck itself.
 */

const sql = Prisma.sql

export type TruckSort = z.infer<typeof truckListQuery>['sort']

const TRUCK_COLUMNS = sql`
  tr."id", tr."registration_number", tr."created_at",
  f."diesel_cost", f."distance_traveled", f."trip_count"`

const TRUCK_FROM = sql`
  FROM "truck" tr
  JOIN "truck_financials" f ON f."truck_id" = tr."id"`

/** WHERE clause. user_id always comes from the session, never the client. */
export function truckWhereSql(userId: string, f: z.infer<typeof masterFilters>): Prisma.Sql {
  const parts: Prisma.Sql[] = [sql`tr."user_id" = ${userId}`]
  if (f.from) parts.push(sql`tr."created_at" >= ${istDayStartUtc(f.from)}`)
  if (f.to) parts.push(sql`tr."created_at" < ${istDayEndExclusiveUtc(f.to)}`)
  if (f.q) parts.push(sql`tr."registration_number" ILIKE ${likePattern(f.q)}`)
  return sql`WHERE ${Prisma.join(parts, ' AND ')}`
}

const SORT_SQL = {
  createdAt: 'tr."created_at"',
  registrationNumber: 'tr."registration_number"',
  distanceTraveled: 'f."distance_traveled"',
  dieselCost: 'f."diesel_cost"',
  tripCount: 'f."trip_count"',
} as const

function truckOrder(sort: TruckSort, order: 'asc' | 'desc') {
  const dir = order === 'asc' ? 'ASC' : 'DESC'
  // Whitelisted identifiers only; tie-break on created_at/id for stable pages.
  return Prisma.raw(`ORDER BY ${SORT_SQL[sort]} ${dir}, tr."created_at" ${dir}, tr."id" ${dir}`)
}

type Num = { toString(): string } | string | number
export interface TruckSqlRow {
  id: string
  registration_number: string
  created_at: Date
  diesel_cost: Num
  distance_traveled: Num
  trip_count: bigint
}

export function toTruckRowDto(r: TruckSqlRow): TruckDto {
  return {
    id: r.id,
    registrationNumber: r.registration_number,
    dieselCost: money(r.diesel_cost),
    distanceTraveled: money(r.distance_traveled),
    costPerKm: truckCostPerKm(r.diesel_cost, r.distance_traveled),
    tripCount: Number(r.trip_count),
    createdAt: new Date(r.created_at).toISOString(),
  }
}

async function assertUniqueRegistration(db: DbOrTx, userId: string, reg: string, exceptId?: string) {
  const clash = await db.truck.findFirst({
    where: { userId, registrationNumber: reg, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  })
  if (clash)
    throw new AppError('DUPLICATE', `A truck with registration ${reg} already exists`, { field: 'registrationNumber' })
}

export async function listTrucks(db: DbOrTx, userId: string, q: z.infer<typeof truckListQuery>) {
  const where = truckWhereSql(userId, q)
  const offset = (q.page - 1) * q.pageSize
  const [rows, count] = await Promise.all([
    db.$queryRaw<TruckSqlRow[]>(
      sql`SELECT ${TRUCK_COLUMNS} ${TRUCK_FROM} ${where} ${truckOrder(q.sort, q.order)} LIMIT ${q.pageSize} OFFSET ${offset}`,
    ),
    db.$queryRaw<{ n: bigint }[]>(sql`SELECT COUNT(*)::bigint AS n ${TRUCK_FROM} ${where}`),
  ])
  return toPage(rows.map(toTruckRowDto), Number(count[0]?.n ?? 0), q)
}

export async function getTruck(db: DbOrTx, userId: string, id: string) {
  const rows = await db.$queryRaw<TruckSqlRow[]>(
    sql`SELECT ${TRUCK_COLUMNS} ${TRUCK_FROM} WHERE tr."id" = ${id} AND tr."user_id" = ${userId}`,
  )
  if (rows.length === 0) throw notFound('Truck')
  return toTruckRowDto(rows[0])
}

/**
 * Keyset batches ordered by (created_at, id) for exports: constant memory and
 * no OFFSET scans regardless of dataset size.
 */
export async function* truckBatches(
  db: DbOrTx,
  userId: string,
  f: z.infer<typeof masterFilters>,
  batchSize = 1000,
): AsyncGenerator<TruckSqlRow[]> {
  let after: { c: Date; id: string } | null = null
  const where = truckWhereSql(userId, f)
  for (;;) {
    const cursor: Prisma.Sql = after
      ? sql`AND (tr."created_at", tr."id") > (${after.c}::timestamptz, ${after.id})`
      : sql``
    const rows: TruckSqlRow[] = await db.$queryRaw<TruckSqlRow[]>(
      sql`SELECT ${TRUCK_COLUMNS} ${TRUCK_FROM} ${where} ${cursor}
          ORDER BY tr."created_at" ASC, tr."id" ASC LIMIT ${batchSize}`,
    )
    if (rows.length === 0) return
    yield rows
    if (rows.length < batchSize) return
    const last = rows[rows.length - 1]
    after = { c: last.created_at, id: last.id }
  }
}

/** A freshly created truck has no trips, so its aggregates are all zero. */
function emptyTruckDto(t: { id: string; registrationNumber: string; createdAt: Date }): TruckDto {
  return {
    id: t.id,
    registrationNumber: t.registrationNumber,
    dieselCost: '0.00',
    distanceTraveled: '0.00',
    costPerKm: null,
    tripCount: 0,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function createTruck(db: DbOrTx, userId: string, input: z.infer<typeof truckInput>) {
  const registrationNumber = normaliseRegistration(input.registrationNumber)
  await assertUniqueRegistration(db, userId, registrationNumber)
  const t = await db.truck.create({ data: { userId, registrationNumber } })
  return emptyTruckDto(t)
}

export async function updateTruck(db: DbOrTx, userId: string, id: string, input: z.infer<typeof truckUpdate>) {
  const existing = await db.truck.findFirst({ where: { id, userId }, select: { id: true } })
  if (!existing) throw notFound('Truck')
  const registrationNumber = input.registrationNumber ? normaliseRegistration(input.registrationNumber) : undefined
  if (registrationNumber) await assertUniqueRegistration(db, userId, registrationNumber, id)
  await db.truck.update({
    where: { id_userId: { id, userId } },
    data: { registrationNumber },
  })
  return getTruck(db, userId, id)
}

export async function deleteTruck(db: DbOrTx, userId: string, id: string) {
  const rows = await db.$queryRaw<{ trip_count: bigint }[]>(
    sql`SELECT "trip_count" FROM "truck_financials" WHERE "truck_id" = ${id} AND "user_id" = ${userId}`,
  )
  if (rows.length === 0) throw notFound('Truck')
  const tripCount = Number(rows[0].trip_count)
  if (tripCount > 0) {
    throw new AppError('IN_USE', `This truck is used by ${tripCount} trip(s) and cannot be deleted`, { tripCount })
  }
  // The FK (NO ACTION) still rejects the delete if a trip was added meanwhile.
  await db.truck.delete({ where: { id_userId: { id, userId } } })
}
