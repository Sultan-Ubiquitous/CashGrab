import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import type { truckInput, truckListQuery, truckUpdate, TruckDto, masterFilters } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { AppError, notFound } from '../lib/errors'
import { money } from '../lib/money'
import { skipTake, toPage } from '../lib/pagination'
import { truckCostPerKm, truckMileage } from './calc'
import { createdAtRange, insensitive, normaliseRegistration } from './common'

type TruckRow = Prisma.TruckGetPayload<{ include: { _count: { select: { trips: true } } } }>

export function toTruckDto(t: TruckRow): TruckDto {
  return {
    id: t.id,
    registrationNumber: t.registrationNumber,
    dieselCost: money(t.dieselCost),
    dieselLiters: money(t.dieselLiters),
    distanceTraveled: money(t.distanceTraveled),
    mileageKmPerLiter: truckMileage(t.distanceTraveled, t.dieselLiters),
    costPerKm: truckCostPerKm(t.dieselCost, t.distanceTraveled),
    tripCount: t._count.trips,
    createdAt: t.createdAt.toISOString(),
  }
}

const withCount = { _count: { select: { trips: true } } } as const

export function truckWhere(userId: string, f: z.infer<typeof masterFilters>): Prisma.TruckWhereInput {
  return {
    userId,
    createdAt: createdAtRange(f.from, f.to),
    ...(f.q ? { registrationNumber: insensitive(f.q) } : {}),
  }
}

export function truckOrder(
  sort: z.infer<typeof truckListQuery>['sort'],
  order: 'asc' | 'desc',
): Prisma.TruckOrderByWithRelationInput[] {
  const primary: Prisma.TruckOrderByWithRelationInput =
    sort === 'tripCount' ? { trips: { _count: order } } : { [sort]: order }
  return [primary, { id: order }]
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
  const where = truckWhere(userId, q)
  const [rows, total] = await Promise.all([
    db.truck.findMany({ where, include: withCount, orderBy: truckOrder(q.sort, q.order), ...skipTake(q) }),
    db.truck.count({ where }),
  ])
  return toPage(rows.map(toTruckDto), total, q)
}

export async function getTruck(db: DbOrTx, userId: string, id: string) {
  const t = await db.truck.findFirst({ where: { id, userId }, include: withCount })
  if (!t) throw notFound('Truck')
  return toTruckDto(t)
}

export async function createTruck(db: DbOrTx, userId: string, input: z.infer<typeof truckInput>) {
  const registrationNumber = normaliseRegistration(input.registrationNumber)
  await assertUniqueRegistration(db, userId, registrationNumber)
  const t = await db.truck.create({
    data: {
      userId,
      registrationNumber,
      dieselCost: input.dieselCost,
      dieselLiters: input.dieselLiters,
      distanceTraveled: input.distanceTraveled,
    },
    include: withCount,
  })
  return toTruckDto(t)
}

export async function updateTruck(db: DbOrTx, userId: string, id: string, input: z.infer<typeof truckUpdate>) {
  const existing = await db.truck.findFirst({ where: { id, userId }, select: { id: true } })
  if (!existing) throw notFound('Truck')
  const registrationNumber = input.registrationNumber ? normaliseRegistration(input.registrationNumber) : undefined
  if (registrationNumber) await assertUniqueRegistration(db, userId, registrationNumber, id)
  const t = await db.truck.update({
    where: { id_userId: { id, userId } },
    data: {
      registrationNumber,
      dieselCost: input.dieselCost,
      dieselLiters: input.dieselLiters,
      distanceTraveled: input.distanceTraveled,
    },
    include: withCount,
  })
  return toTruckDto(t)
}

export async function deleteTruck(db: DbOrTx, userId: string, id: string) {
  const t = await db.truck.findFirst({ where: { id, userId }, include: withCount })
  if (!t) throw notFound('Truck')
  if (t._count.trips > 0) {
    throw new AppError('IN_USE', `This truck is used by ${t._count.trips} trip(s) and cannot be deleted`, {
      tripCount: t._count.trips,
    })
  }
  // The FK (NO ACTION) still rejects the delete if a trip was added meanwhile.
  await db.truck.delete({ where: { id_userId: { id, userId } } })
}
