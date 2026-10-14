import type { z } from 'zod'
import type { Prisma } from '~/generated/prisma/client'
import type { paymentFilters, paymentInput, paymentListQuery, paymentUpdate, PaymentRowDto } from '~/shared/schemas'
import type { Db, DbOrTx, Tx } from '../db'
import { dateOnlyToDb, dbDateToIso, todayIst } from '../lib/dates'
import { AppError, notFound } from '../lib/errors'
import { dec, money } from '../lib/money'
import { skipTake, toPage } from '../lib/pagination'
import { isPaymentDue, tripRevenue } from './calc'
import { insensitive } from './common'
import { getTrip, lockTrip } from './trips'

const TX_OPTS = { maxWait: 10_000, timeout: 20_000 } as const

/**
 * Validates the new payment total against the trip's revenue and re-syncs
 * trip.payment_due. Must run inside a transaction holding the trip row lock.
 */
async function applyAndSync(
  tx: Tx,
  userId: string,
  tripId: string,
  excludePaymentId: string | null,
  newAmount: string | null,
) {
  const trip = await tx.trip.findFirstOrThrow({
    where: { id: tripId, userId },
    select: { brickQuantity: true, brickSellingPrice: true },
  })
  const revenue = tripRevenue(trip.brickQuantity, trip.brickSellingPrice)
  const agg = await tx.payment.aggregate({
    where: { tripId, userId, ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}) },
    _sum: { amount: true },
  })
  const others = dec(agg._sum.amount)
  const total = newAmount === null ? others : others.plus(dec(newAmount))
  if (total.greaterThan(revenue)) {
    throw new AppError('OVERPAYMENT', `Payment exceeds the amount remaining (${money(revenue.minus(others))})`, {
      amountRemaining: money(revenue.minus(others)),
    })
  }
  await tx.trip.update({
    where: { id_userId: { id: tripId, userId } },
    data: { paymentDue: isPaymentDue(revenue, total) },
  })
}

export async function addPayment(db: Db, userId: string, tripId: string, input: z.infer<typeof paymentInput>) {
  await db.$transaction(async (tx) => {
    await lockTrip(tx, userId, tripId)
    await applyAndSync(tx, userId, tripId, null, input.amount)
    await tx.payment.create({
      data: {
        userId,
        tripId,
        amount: input.amount,
        paidOn: dateOnlyToDb(input.paidOn ?? todayIst()),
        note: input.note ?? null,
      },
    })
  }, TX_OPTS)
  return getTrip(db, userId, tripId)
}

async function findPayment(tx: Tx, userId: string, paymentId: string) {
  const p = await tx.payment.findFirst({
    where: { id: paymentId, userId },
    select: { id: true, tripId: true, amount: true },
  })
  if (!p) throw notFound('Payment')
  return p
}

export async function updatePayment(db: Db, userId: string, paymentId: string, input: z.infer<typeof paymentUpdate>) {
  const tripId = await db.$transaction(async (tx) => {
    const p = await findPayment(tx, userId, paymentId)
    await lockTrip(tx, userId, p.tripId)
    await applyAndSync(tx, userId, p.tripId, p.id, input.amount ?? money(p.amount))
    await tx.payment.update({
      where: { id: p.id },
      data: {
        amount: input.amount,
        paidOn: input.paidOn ? dateOnlyToDb(input.paidOn) : undefined,
        note: input.note,
      },
    })
    return p.tripId
  }, TX_OPTS)
  return getTrip(db, userId, tripId)
}

export async function deletePayment(db: Db, userId: string, paymentId: string) {
  const tripId = await db.$transaction(async (tx) => {
    const p = await findPayment(tx, userId, paymentId)
    await lockTrip(tx, userId, p.tripId)
    await tx.payment.delete({ where: { id: p.id } })
    await applyAndSync(tx, userId, p.tripId, null, null)
    return p.tripId
  }, TX_OPTS)
  return getTrip(db, userId, tripId)
}

// ---------------------------------------------------------------------------
// Payments module list / export
// ---------------------------------------------------------------------------
const withTrip = { trip: { select: { tripDate: true, customer: { select: { id: true, name: true } } } } } as const
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof withTrip }>

export function toPaymentRowDto(p: PaymentRow): PaymentRowDto {
  return {
    id: p.id,
    tripId: p.tripId,
    amount: money(p.amount),
    paidOn: dbDateToIso(p.paidOn),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    tripDate: dbDateToIso(p.trip.tripDate),
    customer: p.trip.customer,
  }
}

/** Payments are dated by paid_on. */
export function paymentWhere(userId: string, f: z.infer<typeof paymentFilters>): Prisma.PaymentWhereInput {
  const paidOn =
    f.from || f.to
      ? { ...(f.from ? { gte: dateOnlyToDb(f.from) } : {}), ...(f.to ? { lte: dateOnlyToDb(f.to) } : {}) }
      : undefined
  return {
    userId,
    ...(paidOn ? { paidOn } : {}),
    ...(f.tripId ? { tripId: f.tripId } : {}),
    ...(f.customerId ? { trip: { customerId: f.customerId } } : {}),
    ...(f.q ? { OR: [{ note: insensitive(f.q) }, { trip: { customer: { name: insensitive(f.q) } } }] } : {}),
  }
}

export function paymentOrder(
  sort: z.infer<typeof paymentListQuery>['sort'],
  order: 'asc' | 'desc',
): Prisma.PaymentOrderByWithRelationInput[] {
  return [{ [sort]: order }, { createdAt: order }, { id: order }]
}

export async function listPayments(db: DbOrTx, userId: string, q: z.infer<typeof paymentListQuery>) {
  const where = paymentWhere(userId, q)
  const [rows, total] = await Promise.all([
    db.payment.findMany({ where, include: withTrip, orderBy: paymentOrder(q.sort, q.order), ...skipTake(q) }),
    db.payment.count({ where }),
  ])
  return toPage(rows.map(toPaymentRowDto), total, q)
}
