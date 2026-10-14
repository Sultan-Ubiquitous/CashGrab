import type { z } from 'zod'
import { Prisma } from '~/generated/prisma/client'
import type {
  customerInput,
  driverInput,
  marginOverrideInput,
  truckInput,
  tripCreate,
  tripListQuery,
  tripUpdate,
  TripDetailDto,
  TripFilters,
} from '~/shared/schemas'
import type { Db, Tx } from '../db'
import { dateOnlyToDb, dbDateToIso } from '~/shared/dates'
import { AppError, notFound } from '../lib/errors'
import { dec, money, sum } from '../lib/money'
import { toPage } from '../lib/pagination'
import {
  TRIP_COST_FIELDS,
  canSkipBrickCost,
  isPaymentDue,
  netMarginCalculated,
  totalTripCost,
  tripFinancials,
  tripRevenue,
  type TripCostValues,
} from './calc'
import { listTripRows, toTripRowDto, type TripSort } from './tripQuery'
import { createCustomer } from './customers'
import { createDriver } from './drivers'
import { createTruck } from './trucks'

const TX_OPTS = { maxWait: 10_000, timeout: 20_000 } as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Row lock that serialises every money-affecting change to one trip. */
export async function lockTrip(tx: Tx, userId: string, tripId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "trip" WHERE "id" = ${tripId} AND "user_id" = ${userId} FOR UPDATE`,
  )
  if (rows.length === 0) throw notFound('Trip')
}

/** Creates a master record inline with a trip (the zod contract guarantees one is present). */
async function createInlineCustomer(tx: Tx, userId: string, input: z.infer<typeof customerInput> | undefined) {
  if (!input) throw new AppError('VALIDATION_ERROR', 'Pick an existing customer or fill in a new one')
  return (await createCustomer(tx, userId, input)).id
}
async function createInlineTruck(tx: Tx, userId: string, input: z.infer<typeof truckInput> | undefined) {
  if (!input) throw new AppError('VALIDATION_ERROR', 'Pick an existing truck or fill in a new one')
  return (await createTruck(tx, userId, input)).id
}
async function createInlineDriver(tx: Tx, userId: string, input: z.infer<typeof driverInput> | undefined) {
  if (!input) throw new AppError('VALIDATION_ERROR', 'Pick an existing driver or fill in a new one')
  return (await createDriver(tx, userId, input)).id
}

/** Every referenced record must belong to the authenticated user. */
async function assertRefsOwned(
  tx: Tx,
  userId: string,
  refs: { customerId?: string; truckId?: string; driverId?: string },
) {
  const [customer, truck, driver] = await Promise.all([
    refs.customerId ? tx.customer.findFirst({ where: { id: refs.customerId, userId }, select: { id: true } }) : true,
    refs.truckId ? tx.truck.findFirst({ where: { id: refs.truckId, userId }, select: { id: true } }) : true,
    refs.driverId ? tx.driver.findFirst({ where: { id: refs.driverId, userId }, select: { id: true } }) : true,
  ])
  const bad: string[] = []
  if (!customer) bad.push('customerId')
  if (!truck) bad.push('truckId')
  if (!driver) bad.push('driverId')
  if (bad.length) throw new AppError('INVALID_REFERENCE', `Unknown ${bad.join(', ')}`, { fields: bad })
}

function assertBrickCostRule(includeBrickCost: boolean, sourceOwnership: boolean) {
  if (!includeBrickCost && !canSkipBrickCost(sourceOwnership)) {
    throw new AppError(
      'BRICK_COST_SKIP_NOT_ALLOWED',
      'Brick cost can only be skipped when the bricks are from your own kiln (source ownership)',
      { field: 'includeBrickCost' },
    )
  }
}

async function amountReceived(tx: Tx, tripId: string) {
  const agg = await tx.payment.aggregate({ where: { tripId }, _sum: { amount: true }, _count: true })
  return { received: dec(agg._sum.amount), count: agg._count }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const detailInclude = {
  customer: { select: { id: true, name: true } },
  truck: { select: { id: true, registrationNumber: true } },
  driver: { select: { id: true, name: true } },
  bella: true,
  tripCost: true,
  payments: { orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.TripInclude

type TripDetailRow = Prisma.TripGetPayload<{ include: typeof detailInclude }>

function costValues(c: TripDetailRow['tripCost']): TripCostValues {
  return Object.fromEntries(TRIP_COST_FIELDS.map((k) => [k, c[k]])) as TripCostValues
}

export function toTripDetailDto(t: TripDetailRow): TripDetailDto {
  const cost = costValues(t.tripCost)
  const received = sum(t.payments.map((p) => p.amount))
  return {
    id: t.id,
    tripDate: dbDateToIso(t.tripDate),
    customer: t.customer,
    truck: t.truck,
    driver: t.driver,
    bellaId: t.bellaId,
    tripCostId: t.tripCostId,
    startPoint: t.startPoint,
    endPoint: t.endPoint,
    distance: money(t.distance),
    brickQuantity: t.brickQuantity,
    brickCostPrice: money(t.brickCostPrice),
    brickSellingPrice: money(t.brickSellingPrice),
    brickSourceOwnership: t.brickSourceOwnership,
    includeBrickCost: t.includeBrickCost,
    paymentDue: t.paymentDue,
    financials: tripFinancials(
      {
        brickQuantity: t.brickQuantity,
        brickCostPrice: t.brickCostPrice,
        brickSellingPrice: t.brickSellingPrice,
        includeBrickCost: t.includeBrickCost,
        cost,
        netMarginCalculated: t.netMarginCalculated,
        netMarginOverride: t.netMarginOverride,
      },
      received,
    ),
    bella: {
      id: t.bella.id,
      tripId: t.id,
      tripDate: dbDateToIso(t.tripDate),
      source: t.bella.source,
      quantity: t.bella.quantity,
      costPrice: money(t.bella.costPrice),
      sellingPrice: money(t.bella.sellingPrice),
      sourceOwnership: t.bella.sourceOwnership,
      createdAt: t.bella.createdAt.toISOString(),
    },
    costs: {
      id: t.tripCost.id,
      ...(Object.fromEntries(TRIP_COST_FIELDS.map((k) => [k, money(cost[k])])) as Record<
        (typeof TRIP_COST_FIELDS)[number],
        string
      >),
      total: money(totalTripCost(cost)),
    },
    payments: t.payments.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      amount: money(p.amount),
      paidOn: dbDateToIso(p.paidOn),
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
    canEditBrickFigures: t.payments.length === 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export async function getTrip(db: Db | Tx, userId: string, tripId: string) {
  const t = await db.trip.findFirst({ where: { id: tripId, userId }, include: detailInclude })
  if (!t) throw notFound('Trip')
  return toTripDetailDto(t)
}

export async function listTrips(db: Db | Tx, userId: string, q: z.infer<typeof tripListQuery>) {
  const filters: TripFilters = q
  const { rows, total } = await listTripRows(db, userId, filters, {
    sort: q.sort as TripSort,
    order: q.order,
    page: q.page,
    pageSize: q.pageSize,
  })
  return toPage(rows.map(toTripRowDto), total, q)
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createTrip(db: Db, userId: string, input: z.infer<typeof tripCreate>) {
  assertBrickCostRule(input.includeBrickCost, input.bella.sourceOwnership)
  const id = await db.$transaction(async (tx) => {
    // Existing references must belong to the user; inline records are
    // created here so the whole trip succeeds or fails together.
    await assertRefsOwned(tx, userId, {
      customerId: input.customer.id,
      truckId: input.truck.id,
      driverId: input.driver.id,
    })
    const customerId = input.customer.id ?? (await createInlineCustomer(tx, userId, input.customer.new))
    const truckId = input.truck.id ?? (await createInlineTruck(tx, userId, input.truck.new))
    const driverId = input.driver.id ?? (await createInlineDriver(tx, userId, input.driver.new))
    const bella = await tx.bella.create({
      data: {
        userId,
        source: input.bella.source,
        quantity: input.bella.quantity,
        costPrice: input.bella.costPrice,
        sellingPrice: input.bella.sellingPrice,
        sourceOwnership: input.bella.sourceOwnership,
      },
    })
    const cost = await tx.tripCost.create({ data: { userId, ...input.costs } })
    const margin = netMarginCalculated({
      brickQuantity: input.bella.quantity,
      brickCostPrice: input.bella.costPrice,
      brickSellingPrice: input.bella.sellingPrice,
      includeBrickCost: input.includeBrickCost,
      cost: input.costs,
    })
    const revenue = tripRevenue(input.bella.quantity, input.bella.sellingPrice)
    const trip = await tx.trip.create({
      data: {
        userId,
        customerId,
        truckId,
        driverId,
        bellaId: bella.id,
        tripCostId: cost.id,
        tripDate: dateOnlyToDb(input.tripDate),
        distance: input.distance,
        startPoint: input.startPoint,
        endPoint: input.endPoint,
        // Locked copy of the brick figures at creation time.
        brickQuantity: input.bella.quantity,
        brickCostPrice: input.bella.costPrice,
        brickSellingPrice: input.bella.sellingPrice,
        brickSourceOwnership: input.bella.sourceOwnership,
        includeBrickCost: input.includeBrickCost,
        netMarginCalculated: money(margin),
        netMarginOverride: input.netMarginOverride ?? null,
        paymentDue: isPaymentDue(revenue, 0),
      },
      select: { id: true },
    })
    return trip.id
  }, TX_OPTS)
  return getTrip(db, userId, id)
}

export async function updateTrip(db: Db, userId: string, tripId: string, input: z.infer<typeof tripUpdate>) {
  await db.$transaction(async (tx) => {
    await lockTrip(tx, userId, tripId)
    const t = await tx.trip.findFirstOrThrow({
      where: { id: tripId, userId },
      include: { tripCost: true, bella: true },
    })
    await assertRefsOwned(tx, userId, input)

    const b = input.bella ?? {}
    const next = {
      brickQuantity: b.quantity ?? t.brickQuantity,
      brickCostPrice: b.costPrice ?? money(t.brickCostPrice),
      brickSellingPrice: b.sellingPrice ?? money(t.brickSellingPrice),
      brickSourceOwnership: b.sourceOwnership ?? t.brickSourceOwnership,
      includeBrickCost: input.includeBrickCost ?? t.includeBrickCost,
    }
    const figuresChanged =
      next.brickQuantity !== t.brickQuantity ||
      !dec(next.brickCostPrice).equals(dec(t.brickCostPrice)) ||
      !dec(next.brickSellingPrice).equals(dec(t.brickSellingPrice))

    const { received, count } = await amountReceived(tx, tripId)
    // Rule 1b: brick quantity/prices are correctable only while no payment exists.
    if (figuresChanged && count > 0) {
      throw new AppError(
        'TRIP_HAS_PAYMENTS',
        'Brick quantity and prices cannot be changed after a payment has been recorded. Delete the payments first.',
        { paymentCount: count },
      )
    }
    assertBrickCostRule(next.includeBrickCost, next.brickSourceOwnership)

    const cost: TripCostValues = {
      ...(Object.fromEntries(TRIP_COST_FIELDS.map((k) => [k, t.tripCost[k]])) as TripCostValues),
      ...(input.costs ?? {}),
    }
    const margin = netMarginCalculated({ ...next, cost })
    const revenue = tripRevenue(next.brickQuantity, next.brickSellingPrice)

    if (input.costs && Object.keys(input.costs).length) {
      await tx.tripCost.update({ where: { id_userId: { id: t.tripCostId, userId } }, data: input.costs })
    }
    if (Object.keys(b).length) {
      // Keep the bella record identical to the trip's locked copy.
      await tx.bella.update({
        where: { id_userId: { id: t.bellaId, userId } },
        data: {
          source: b.source,
          quantity: b.quantity,
          costPrice: b.costPrice,
          sellingPrice: b.sellingPrice,
          sourceOwnership: b.sourceOwnership,
        },
      })
    }
    await tx.trip.update({
      where: { id_userId: { id: tripId, userId } },
      data: {
        customerId: input.customerId,
        truckId: input.truckId,
        driverId: input.driverId,
        tripDate: input.tripDate ? dateOnlyToDb(input.tripDate) : undefined,
        distance: input.distance,
        startPoint: input.startPoint,
        endPoint: input.endPoint,
        ...next,
        // Recalculated every time; the manual override is never touched here.
        netMarginCalculated: money(margin),
        paymentDue: isPaymentDue(revenue, received),
      },
    })
  }, TX_OPTS)
  return getTrip(db, userId, tripId)
}

export async function setMarginOverride(
  db: Db,
  userId: string,
  tripId: string,
  input: z.infer<typeof marginOverrideInput>,
) {
  const res = await db.trip.updateMany({
    where: { id: tripId, userId },
    data: { netMarginOverride: input.netMarginOverride },
  })
  if (res.count === 0) throw notFound('Trip')
  return getTrip(db, userId, tripId)
}

export async function deleteTrip(db: Db, userId: string, tripId: string) {
  await db.$transaction(async (tx) => {
    await lockTrip(tx, userId, tripId)
    const t = await tx.trip.findFirstOrThrow({
      where: { id: tripId, userId },
      select: { bellaId: true, tripCostId: true },
    })
    // Payments cascade with the trip; the 1:1 bella and trip_cost go with it.
    await tx.trip.delete({ where: { id_userId: { id: tripId, userId } } })
    await tx.bella.delete({ where: { id_userId: { id: t.bellaId, userId } } })
    await tx.tripCost.delete({ where: { id_userId: { id: t.tripCostId, userId } } })
  }, TX_OPTS)
}
