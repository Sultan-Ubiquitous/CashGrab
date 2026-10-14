import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import type { bellaFilters, bellaListQuery, bellaUpdate, BellaDto } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { dbDateToIso } from '~/shared/dates'
import { notFound } from '../lib/errors'
import { money } from '../lib/money'
import { skipTake, toPage } from '../lib/pagination'
import { insensitive } from './common'

const withTrip = { trip: { select: { id: true, tripDate: true } } } as const
type BellaRow = Prisma.BellaGetPayload<{ include: typeof withTrip }>

export function toBellaDto(b: BellaRow): BellaDto {
  return {
    id: b.id,
    tripId: b.trip?.id ?? null,
    tripDate: b.trip ? dbDateToIso(b.trip.tripDate) : null,
    source: b.source,
    quantity: b.quantity,
    costPrice: money(b.costPrice),
    sellingPrice: money(b.sellingPrice),
    sourceOwnership: b.sourceOwnership,
    createdAt: b.createdAt.toISOString(),
  }
}

/** Bella records are dated by their trip's trip_date (same basis as reports). */
export function bellaWhere(userId: string, f: z.infer<typeof bellaFilters>): Prisma.BellaWhereInput {
  const tripDate =
    f.from || f.to
      ? {
          ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}),
          ...(f.to ? { lte: new Date(`${f.to}T00:00:00Z`) } : {}),
        }
      : undefined
  return {
    userId,
    ...(tripDate ? { trip: { is: { tripDate } } } : {}),
    ...(f.sourceOwnership !== undefined ? { sourceOwnership: f.sourceOwnership } : {}),
    ...(f.q ? { source: insensitive(f.q) } : {}),
  }
}

export function bellaOrder(
  sort: z.infer<typeof bellaListQuery>['sort'],
  order: 'asc' | 'desc',
): Prisma.BellaOrderByWithRelationInput[] {
  const primary: Prisma.BellaOrderByWithRelationInput =
    sort === 'tripDate' ? { trip: { tripDate: order } } : { [sort]: order }
  return [primary, { id: order }]
}

export async function listBella(db: DbOrTx, userId: string, q: z.infer<typeof bellaListQuery>) {
  const where = bellaWhere(userId, q)
  const [rows, total] = await Promise.all([
    db.bella.findMany({ where, include: withTrip, orderBy: bellaOrder(q.sort, q.order), ...skipTake(q) }),
    db.bella.count({ where }),
  ])
  return toPage(rows.map(toBellaDto), total, q)
}

export async function getBella(db: DbOrTx, userId: string, id: string) {
  const b = await db.bella.findFirst({ where: { id, userId }, include: withTrip })
  if (!b) throw notFound('Bella record')
  return toBellaDto(b)
}

/**
 * Rule 2b: only `source` and `sourceOwnership` are editable here. Neither
 * touches the trip's locked brick copy or its net margin; the brick-cost skip
 * rule is always evaluated against the trip's locked sourceOwnership.
 */
export async function updateBella(db: DbOrTx, userId: string, id: string, input: z.infer<typeof bellaUpdate>) {
  const res = await db.bella.updateMany({
    where: { id, userId },
    data: { source: input.source, sourceOwnership: input.sourceOwnership },
  })
  if (res.count === 0) throw notFound('Bella record')
  return getBella(db, userId, id)
}
