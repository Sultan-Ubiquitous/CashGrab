import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import type { customerInput, customerUpdate, masterFilters, masterListQuery, CustomerDto } from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { AppError, notFound } from '../lib/errors'
import { skipTake, toPage } from '../lib/pagination'
import { createdAtRange, insensitive } from './common'

type CustomerRow = Prisma.CustomerGetPayload<{ include: { _count: { select: { trips: true } } } }>
const withCount = { _count: { select: { trips: true } } } as const

export function toCustomerDto(c: CustomerRow): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    location: c.location,
    tripCount: c._count.trips,
    createdAt: c.createdAt.toISOString(),
  }
}

export function customerWhere(userId: string, f: z.infer<typeof masterFilters>): Prisma.CustomerWhereInput {
  return {
    userId,
    createdAt: createdAtRange(f.from, f.to),
    ...(f.q ? { OR: [{ name: insensitive(f.q) }, { location: insensitive(f.q) }, { phone: { contains: f.q } }] } : {}),
  }
}

export function customerOrder(
  sort: z.infer<typeof masterListQuery>['sort'],
  order: 'asc' | 'desc',
): Prisma.CustomerOrderByWithRelationInput[] {
  const primary: Prisma.CustomerOrderByWithRelationInput =
    sort === 'tripCount' ? { trips: { _count: order } } : { [sort]: order }
  return [primary, { id: order }]
}

export async function listCustomers(db: DbOrTx, userId: string, q: z.infer<typeof masterListQuery>) {
  const where = customerWhere(userId, q)
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, include: withCount, orderBy: customerOrder(q.sort, q.order), ...skipTake(q) }),
    db.customer.count({ where }),
  ])
  return toPage(rows.map(toCustomerDto), total, q)
}

export async function getCustomer(db: DbOrTx, userId: string, id: string) {
  const c = await db.customer.findFirst({ where: { id, userId }, include: withCount })
  if (!c) throw notFound('Customer')
  return toCustomerDto(c)
}

export async function createCustomer(db: DbOrTx, userId: string, input: z.infer<typeof customerInput>) {
  const c = await db.customer.create({
    data: { userId, name: input.name, phone: input.phone ?? null, location: input.location },
    include: withCount,
  })
  return toCustomerDto(c)
}

export async function updateCustomer(db: DbOrTx, userId: string, id: string, input: z.infer<typeof customerUpdate>) {
  const existing = await db.customer.findFirst({ where: { id, userId }, select: { id: true } })
  if (!existing) throw notFound('Customer')
  const c = await db.customer.update({
    where: { id_userId: { id, userId } },
    data: { name: input.name, phone: input.phone, location: input.location },
    include: withCount,
  })
  return toCustomerDto(c)
}

export async function deleteCustomer(db: DbOrTx, userId: string, id: string) {
  const c = await db.customer.findFirst({ where: { id, userId }, include: withCount })
  if (!c) throw notFound('Customer')
  if (c._count.trips > 0) {
    throw new AppError('IN_USE', `This customer has ${c._count.trips} trip(s) and cannot be deleted`, {
      tripCount: c._count.trips,
    })
  }
  await db.customer.delete({ where: { id_userId: { id, userId } } })
}
