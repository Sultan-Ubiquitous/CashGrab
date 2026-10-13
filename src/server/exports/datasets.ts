/**
 * Export datasets. Each dataset declares its columns and yields batches of
 * rows, reading the database in fixed-size keyset/cursor batches so memory
 * stays flat for any dataset size. Record ids and foreign keys are always
 * included so exported files can be re-joined.
 */
import type { z } from 'zod'
import type {
  bellaFilters,
  masterFilters,
  paymentFilters,
  TripFilters,
  TripTotalsDto,
  MonthlyDto,
} from '~/shared/schemas'
import type { DbOrTx } from '../db'
import { dbDateToIso } from '../lib/dates'
import { money, moneyOrNull } from '../lib/money'
import { bellaWhere } from '../services/bella'
import { truckCostPerKm, truckMileage } from '../services/calc'
import { customerWhere } from '../services/customers'
import { driverWhere } from '../services/drivers'
import { paymentWhere } from '../services/payments'
import { tripRowBatches, type TripSqlRow } from '../services/tripQuery'
import { truckWhere } from '../services/trucks'
import type { CellValue, Column } from './cells'

export const BATCH_SIZE = 1000

export type Row = Record<string, CellValue>
export interface Dataset {
  /** File / sheet base name. */
  name: string
  sheet: string
  columns: Column[]
  rows: () => AsyncGenerator<Row[]>
}

const col = (key: string, type: Column['type'], header = key): Column => ({ key, header, type })
const created = col('created_at_ist', 'datetime')

/** Generic created_at/id cursor batching for Prisma models. */
async function* cursorBatches<T extends { id: string }>(fetch: (args: { take: number; skip?: number; cursor?: { id: string } }) => Promise<T[]>) {
  let cursor: string | undefined
  for (;;) {
    const rows = await fetch({ take: BATCH_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) })
    if (rows.length === 0) return
    yield rows
    if (rows.length < BATCH_SIZE) return
    cursor = rows[rows.length - 1].id
  }
}
const ASC = [{ createdAt: 'asc' as const }, { id: 'asc' as const }]

// ---------------------------------------------------------------------------
export function trucksDataset(db: DbOrTx, userId: string, f: z.infer<typeof masterFilters>): Dataset {
  return {
    name: 'trucks',
    sheet: 'Trucks',
    columns: [
      col('id', 'text'),
      col('registration_number', 'text'),
      col('diesel_cost', 'money'),
      col('diesel_liters', 'decimal'),
      col('distance_traveled', 'decimal'),
      col('mileage_km_per_liter', 'decimal'),
      col('cost_per_km', 'money'),
      col('trip_count', 'int'),
      created,
    ],
    rows: async function* () {
      const where = truckWhere(userId, f)
      for await (const batch of cursorBatches((p) =>
        db.truck.findMany({ where, orderBy: ASC, include: { _count: { select: { trips: true } } }, ...p }),
      )) {
        yield batch.map((t) => ({
          id: t.id,
          registration_number: t.registrationNumber,
          diesel_cost: money(t.dieselCost),
          diesel_liters: money(t.dieselLiters),
          distance_traveled: money(t.distanceTraveled),
          mileage_km_per_liter: truckMileage(t.distanceTraveled, t.dieselLiters),
          cost_per_km: truckCostPerKm(t.dieselCost, t.distanceTraveled),
          trip_count: t._count.trips,
          created_at_ist: t.createdAt,
        }))
      }
    },
  }
}

export function driversDataset(db: DbOrTx, userId: string, f: z.infer<typeof masterFilters>): Dataset {
  return {
    name: 'drivers',
    sheet: 'Drivers',
    columns: [col('id', 'text'), col('name', 'text'), col('phone', 'text'), col('trip_count', 'int'), created],
    rows: async function* () {
      const where = driverWhere(userId, f)
      for await (const batch of cursorBatches((p) =>
        db.driver.findMany({ where, orderBy: ASC, include: { _count: { select: { trips: true } } }, ...p }),
      )) {
        yield batch.map((d) => ({ id: d.id, name: d.name, phone: d.phone, trip_count: d._count.trips, created_at_ist: d.createdAt }))
      }
    },
  }
}

export function customersDataset(db: DbOrTx, userId: string, f: z.infer<typeof masterFilters>): Dataset {
  return {
    name: 'customers',
    sheet: 'Customers',
    columns: [
      col('id', 'text'),
      col('name', 'text'),
      col('phone', 'text'),
      col('location', 'text'),
      col('trip_count', 'int'),
      created,
    ],
    rows: async function* () {
      const where = customerWhere(userId, f)
      for await (const batch of cursorBatches((p) =>
        db.customer.findMany({ where, orderBy: ASC, include: { _count: { select: { trips: true } } }, ...p }),
      )) {
        yield batch.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          location: c.location,
          trip_count: c._count.trips,
          created_at_ist: c.createdAt,
        }))
      }
    },
  }
}

export function bellaDataset(db: DbOrTx, userId: string, f: z.infer<typeof bellaFilters>): Dataset {
  return {
    name: 'bella',
    sheet: 'Bella',
    columns: [
      col('id', 'text'),
      col('trip_id', 'text'),
      col('trip_date', 'date'),
      col('source', 'text'),
      col('quantity', 'int'),
      col('cost_price_per_brick', 'money'),
      col('selling_price_per_brick', 'money'),
      col('source_ownership_own_kiln', 'bool'),
      created,
    ],
    rows: async function* () {
      const where = bellaWhere(userId, f)
      for await (const batch of cursorBatches((p) =>
        db.bella.findMany({ where, orderBy: ASC, include: { trip: { select: { id: true, tripDate: true } } }, ...p }),
      )) {
        yield batch.map((b) => ({
          id: b.id,
          trip_id: b.trip?.id ?? null,
          trip_date: b.trip ? dbDateToIso(b.trip.tripDate) : null,
          source: b.source,
          quantity: b.quantity,
          cost_price_per_brick: money(b.costPrice),
          selling_price_per_brick: money(b.sellingPrice),
          source_ownership_own_kiln: b.sourceOwnership,
          created_at_ist: b.createdAt,
        }))
      }
    },
  }
}

export function paymentsDataset(db: DbOrTx, userId: string, f: z.infer<typeof paymentFilters>): Dataset {
  return {
    name: 'payments',
    sheet: 'Payments',
    columns: [
      col('id', 'text'),
      col('trip_id', 'text'),
      col('trip_date', 'date'),
      col('customer_id', 'text'),
      col('customer_name', 'text'),
      col('amount', 'money'),
      col('paid_on', 'date'),
      col('note', 'text'),
      created,
    ],
    rows: async function* () {
      const where = paymentWhere(userId, f)
      for await (const batch of cursorBatches((p) =>
        db.payment.findMany({
          where,
          orderBy: ASC,
          include: { trip: { select: { tripDate: true, customer: { select: { id: true, name: true } } } } },
          ...p,
        }),
      )) {
        yield batch.map((p) => ({
          id: p.id,
          trip_id: p.tripId,
          trip_date: dbDateToIso(p.trip.tripDate),
          customer_id: p.trip.customer.id,
          customer_name: p.trip.customer.name,
          amount: money(p.amount),
          paid_on: dbDateToIso(p.paidOn),
          note: p.note,
          created_at_ist: p.createdAt,
        }))
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Trip-based datasets (same filter builder and view as the dashboard)
// ---------------------------------------------------------------------------
export const TRIP_COLUMNS: Column[] = [
  col('id', 'text'),
  col('trip_date', 'date'),
  col('customer_id', 'text'),
  col('customer_name', 'text'),
  col('truck_id', 'text'),
  col('truck_registration', 'text'),
  col('driver_id', 'text'),
  col('driver_name', 'text'),
  col('bella_id', 'text'),
  col('trip_cost_id', 'text'),
  col('start_point', 'text'),
  col('end_point', 'text'),
  col('distance_km', 'decimal'),
  col('bella_source', 'text'),
  col('brick_quantity', 'int'),
  col('brick_cost_price', 'money'),
  col('brick_selling_price', 'money'),
  col('brick_source_ownership_own_kiln', 'bool'),
  col('include_brick_cost', 'bool'),
  col('revenue', 'money'),
  col('brick_cost', 'money'),
  col('total_trip_cost', 'money'),
  col('net_margin_calculated', 'money'),
  col('net_margin_override', 'money'),
  col('net_margin_effective', 'money'),
  col('margin_is_manual_override', 'bool'),
  col('payment_due', 'bool'),
  col('amount_received', 'money'),
  col('amount_remaining', 'money'),
  created,
]

export function tripToRow(r: TripSqlRow): Row {
  return {
    id: r.id,
    trip_date: dbDateToIso(r.trip_date),
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    truck_id: r.truck_id,
    truck_registration: r.truck_registration,
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    bella_id: r.bella_id,
    trip_cost_id: r.trip_cost_id,
    start_point: r.start_point,
    end_point: r.end_point,
    distance_km: money(r.distance),
    bella_source: r.bella_source,
    brick_quantity: Number(r.brick_quantity),
    brick_cost_price: money(r.brick_cost_price),
    brick_selling_price: money(r.brick_selling_price),
    brick_source_ownership_own_kiln: r.brick_source_ownership,
    include_brick_cost: r.include_brick_cost,
    revenue: money(r.revenue),
    brick_cost: money(r.brick_cost),
    total_trip_cost: money(r.total_trip_cost),
    net_margin_calculated: money(r.net_margin_calculated),
    net_margin_override: moneyOrNull(r.net_margin_override),
    net_margin_effective: money(r.net_margin_effective),
    margin_is_manual_override: r.net_margin_override !== null,
    payment_due: r.payment_due,
    amount_received: money(r.amount_received),
    amount_remaining: money(r.amount_remaining),
    created_at_ist: new Date(r.created_at),
  }
}

export function tripsDataset(db: DbOrTx, userId: string, f: Partial<TripFilters>): Dataset {
  return {
    name: 'trips',
    sheet: 'Trips',
    columns: TRIP_COLUMNS,
    rows: async function* () {
      for await (const batch of tripRowBatches(db, userId, f, BATCH_SIZE)) yield batch.map(tripToRow)
    },
  }
}

export function tripCostsDataset(db: DbOrTx, userId: string, f: Partial<TripFilters>): Dataset {
  return {
    name: 'trip_costs',
    sheet: 'Trip costs',
    columns: [
      col('id', 'text'),
      col('trip_id', 'text'),
      col('trip_date', 'date'),
      col('diesel', 'money'),
      col('adblue', 'money'),
      col('royalty', 'money'),
      col('toll_taxes', 'money'),
      col('driver_salary', 'money'),
      col('miscellaneous', 'money'),
      col('labour', 'money'),
      col('total', 'money'),
    ],
    rows: async function* () {
      for await (const batch of tripRowBatches(db, userId, f, BATCH_SIZE)) {
        yield batch.map((r) => ({
          id: r.trip_cost_id,
          trip_id: r.id,
          trip_date: dbDateToIso(r.trip_date),
          diesel: money(r.diesel),
          adblue: money(r.adblue),
          royalty: money(r.royalty),
          toll_taxes: money(r.toll_taxes),
          driver_salary: money(r.driver_salary),
          miscellaneous: money(r.miscellaneous),
          labour: money(r.labour),
          total: money(r.total_trip_cost),
        }))
      }
    },
  }
}

/** Single-row dataset of report totals (same function as the dashboard). */
export function summaryDataset(totals: TripTotalsDto, f: Partial<TripFilters>): Dataset {
  const columns: Column[] = [
    col('filter_from', 'date'),
    col('filter_to', 'date'),
    col('filter_customer_id', 'text'),
    col('filter_truck_id', 'text'),
    col('filter_driver_id', 'text'),
    col('filter_payment_due', 'bool'),
    col('filter_source_ownership', 'bool'),
    col('filter_margin_overridden', 'bool'),
    col('filter_search', 'text'),
    col('trip_count', 'int'),
    col('revenue', 'money'),
    col('brick_cost', 'money'),
    col('total_trip_cost', 'money'),
    col('net_margin_calculated', 'money'),
    col('net_margin_effective', 'money'),
    col('overridden_count', 'int'),
    col('amount_received', 'money'),
    col('outstanding', 'money'),
    col('due_trip_count', 'int'),
  ]
  return {
    name: 'summary',
    sheet: 'Summary',
    columns,
    rows: async function* () {
      yield [
        {
          filter_from: f.from ?? null,
          filter_to: f.to ?? null,
          filter_customer_id: f.customerId ?? null,
          filter_truck_id: f.truckId ?? null,
          filter_driver_id: f.driverId ?? null,
          filter_payment_due: f.paymentDue ?? null,
          filter_source_ownership: f.sourceOwnership ?? null,
          filter_margin_overridden: f.marginOverridden ?? null,
          filter_search: f.q ?? null,
          trip_count: totals.tripCount,
          revenue: totals.revenue,
          brick_cost: totals.brickCost,
          total_trip_cost: totals.totalTripCost,
          net_margin_calculated: totals.netMarginCalculated,
          net_margin_effective: totals.netMarginEffective,
          overridden_count: totals.overriddenCount,
          amount_received: totals.amountReceived,
          outstanding: totals.outstanding,
          due_trip_count: totals.dueTripCount,
        },
      ]
    },
  }
}

export function monthlyDataset(m: MonthlyDto): Dataset {
  const money6 = ['diesel', 'adblue', 'royalty', 'toll_taxes', 'driver_salary', 'miscellaneous', 'labour', 'total'] as const
  return {
    name: 'monthly_summary',
    sheet: 'Monthly summary',
    columns: [col('month', 'text'), col('trip_count', 'int'), ...money6.map((k) => col(k, 'money')), col('change_from_previous', 'money')],
    rows: async function* () {
      yield m.months.map((r) => ({
        month: r.month,
        trip_count: r.tripCount,
        diesel: r.diesel,
        adblue: r.adblue,
        royalty: r.royalty,
        toll_taxes: r.tollTaxes,
        driver_salary: r.driverSalary,
        miscellaneous: r.miscellaneous,
        labour: r.labour,
        total: r.total,
        change_from_previous: r.changeFromPrevious,
      }))
    },
  }
}
