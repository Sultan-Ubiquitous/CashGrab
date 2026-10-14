import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import type { driverInput, driverUpdate, masterFilters, masterListQuery, DriverDto } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { AppError, notFound } from '../lib/errors'
import { skipTake, toPage } from '../lib/pagination'
import { createdAtRange, insensitive } from './common'

type DriverRow = Prisma.DriverGetPayload<{ include: { _count: { select: { trips: true } } } }>
const withCount = { _count: { select: { trips: true } } } as const

export function toDriverDto(d: DriverRow): DriverDto {
  return { id: d.id, name: d.name, phone: d.phone, tripCount: d._count.trips, createdAt: d.createdAt.toISOString() }
}

export function driverWhere(userId: string, f: z.infer<typeof masterFilters>): Prisma.DriverWhereInput {
  return {
    userId,
    createdAt: createdAtRange(f.from, f.to),
    ...(f.q ? { OR: [{ name: insensitive(f.q) }, { phone: { contains: f.q } }] } : {}),
  }
}

export function driverOrder(
  sort: z.infer<typeof masterListQuery>['sort'],
  order: 'asc' | 'desc',
): Prisma.DriverOrderByWithRelationInput[] {
  const primary: Prisma.DriverOrderByWithRelationInput =
    sort === 'tripCount' ? { trips: { _count: order } } : { [sort]: order }
  return [primary, { id: order }]
}

export async function listDrivers(db: DbOrTx, userId: string, q: z.infer<typeof masterListQuery>) {
  const where = driverWhere(userId, q)
  const [rows, total] = await Promise.all([
    db.driver.findMany({ where, include: withCount, orderBy: driverOrder(q.sort, q.order), ...skipTake(q) }),
    db.driver.count({ where }),
  ])
  return toPage(rows.map(toDriverDto), total, q)
}

export async function getDriver(db: DbOrTx, userId: string, id: string) {
  const d = await db.driver.findFirst({ where: { id, userId }, include: withCount })
  if (!d) throw notFound('Driver')
  return toDriverDto(d)
}

export async function createDriver(db: DbOrTx, userId: string, input: z.infer<typeof driverInput>) {
  const d = await db.driver.create({ data: { userId, name: input.name, phone: input.phone }, include: withCount })
  return toDriverDto(d)
}

export async function updateDriver(db: DbOrTx, userId: string, id: string, input: z.infer<typeof driverUpdate>) {
  const existing = await db.driver.findFirst({ where: { id, userId }, select: { id: true } })
  if (!existing) throw notFound('Driver')
  const d = await db.driver.update({
    where: { id_userId: { id, userId } },
    data: { name: input.name, phone: input.phone },
    include: withCount,
  })
  return toDriverDto(d)
}

export async function deleteDriver(db: DbOrTx, userId: string, id: string) {
  const d = await db.driver.findFirst({ where: { id, userId }, include: withCount })
  if (!d) throw notFound('Driver')
  if (d._count.trips > 0) {
    throw new AppError('IN_USE', `This driver is assigned to ${d._count.trips} trip(s) and cannot be deleted`, {
      tripCount: d._count.trips,
    })
  }
  await db.driver.delete({ where: { id_userId: { id, userId } } })
}
