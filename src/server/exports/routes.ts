import { Hono } from 'hono'
import { z } from 'zod'
import { bellaListQuery, masterListQuery, paymentListQuery, tripFilters, tripListQuery } from '~/shared/schemas'
import { todayIst } from '../lib/dates'
import type { AppEnv, Ctx } from '../http'
import { v } from '../http'
import { monthlySummary } from '../services/reports'
import { tripTotals } from '../services/tripQuery'
import type { Dataset } from './datasets'
import {
  bellaDataset,
  customersDataset,
  driversDataset,
  monthlyDataset,
  paymentsDataset,
  summaryDataset,
  tripCostsDataset,
  tripsDataset,
  trucksDataset,
} from './datasets'
import type { Sink } from './writers'
import { writeCsv, writeCsvZip, writeXlsx } from './writers'

const formatQuery = z.object({ format: z.enum(['csv', 'xlsx']).default('csv') })
const MIME = {
  csv: 'text/csv; charset=utf-8',
  zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

/**
 * Streams a produced file. The producer owns the DB: it is closed only when
 * generation finishes (or fails / the client disconnects), never when the
 * route handler returns. Back-pressure keeps memory flat for large exports.
 */
function streamFile(c: Ctx, filename: string, mime: string, produce: (sink: Sink) => Promise<void>) {
  let cancelled = false
  const pending: (() => void)[] = []
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      pending.shift()?.()
    },
    cancel() {
      cancelled = true
      while (pending.length) pending.shift()!()
    },
    start(controller) {
      const sink: Sink = {
        write: (chunk) =>
          new Promise<void>((resolve, reject) => {
            if (cancelled) return reject(new Error('Client disconnected'))
            controller.enqueue(chunk)
            if (controller.desiredSize !== null && controller.desiredSize <= 0) pending.push(resolve)
            else resolve()
          }),
      }
      produce(sink)
        .catch((e) => {
          // Fail the stream instead of silently truncating the file.
          try {
            controller.error(e)
          } catch {
            /* already closed or cancelled */
          }
        })
        .finally(() => {
          try {
            if (!cancelled) controller.close()
          } catch {
            /* already closed */
          }
          void c.var.db.$disconnect()
        })
    },
  })
  c.header('Content-Type', mime)
  c.header('Content-Disposition', `attachment; filename="${filename}"`)
  c.header('Cache-Control', 'no-store')
  c.set('streamOwnsDb', true)
  return c.newResponse(stream)
}

const reportQuery = formatQuery.and(tripFilters)

export const exportRoutes = new Hono<AppEnv>()
  // A. Complete data export: every module the user owns (CSV = one file per
  // module inside a ZIP; XLSX = one worksheet per module).
  .get('/full', v('query', formatQuery), async (c) => {
    const { format } = c.req.valid('query')
    const { db, userId } = c.var
    const datasets: Dataset[] = [
      trucksDataset(db, userId, {}),
      driversDataset(db, userId, {}),
      customersDataset(db, userId, {}),
      bellaDataset(db, userId, {}),
      tripsDataset(db, userId, {}),
      tripCostsDataset(db, userId, {}),
      paymentsDataset(db, userId, {}),
    ]
    const ext = format === 'csv' ? 'zip' : 'xlsx'
    return streamFile(c, `quick-money-full-${todayIst()}.${ext}`, format === 'csv' ? MIME.zip : MIME.xlsx, (sink) =>
      format === 'csv' ? writeCsvZip(sink, datasets) : writeXlsx(sink, datasets),
    )
  })

  // B. Filtered report export: trips + trip costs + monthly summary + a
  // summary sheet whose totals come from the same function as the dashboard.
  .get('/report', v('query', reportQuery), async (c) => {
    const { format, ...filters } = c.req.valid('query')
    const { db, userId } = c.var
    const [totals, monthly] = await Promise.all([tripTotals(db, userId, filters), monthlySummary(db, userId, filters)])
    const datasets: Dataset[] = [
      summaryDataset(totals, filters),
      monthlyDataset(monthly),
      tripsDataset(db, userId, filters),
      tripCostsDataset(db, userId, filters),
    ]
    const ext = format === 'csv' ? 'zip' : 'xlsx'
    return streamFile(c, `quick-money-report-${todayIst()}.${ext}`, format === 'csv' ? MIME.zip : MIME.xlsx, (sink) =>
      format === 'csv' ? writeCsvZip(sink, datasets) : writeXlsx(sink, datasets),
    )
  })

  // C. Per-module export with that module's filters.
  .get('/:module', async (c) => {
    const module = c.req.param('module')
    const { db, userId } = c.var
    let ds: Dataset
    switch (module) {
      case 'trips': {
        const q = await tripListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = tripsDataset(db, userId, f)
        break
      }
      case 'trip-costs': {
        const q = await tripFilters.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        ds = tripCostsDataset(db, userId, q)
        break
      }
      case 'trucks': {
        const q = await masterListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = trucksDataset(db, userId, f)
        break
      }
      case 'drivers': {
        const q = await masterListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = driversDataset(db, userId, f)
        break
      }
      case 'customers': {
        const q = await masterListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = customersDataset(db, userId, f)
        break
      }
      case 'bella': {
        const q = await bellaListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = bellaDataset(db, userId, f)
        break
      }
      case 'payments': {
        const q = await paymentListQuery.parseAsync(Object.fromEntries(new URL(c.req.url).searchParams))
        const { sort: _s, order: _o, page: _p, pageSize: _ps, ...f } = q
        ds = paymentsDataset(db, userId, f)
        break
      }
      default:
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Unknown export module',
              details: { modules: ['trips', 'trip-costs', 'trucks', 'drivers', 'customers', 'bella', 'payments'] },
            },
          },
          404,
        )
    }
    const { format } = formatQuery.parse({
      format: new URL(c.req.url).searchParams.get('format') ?? undefined,
    })
    const dsWithMeta: Dataset = ds
    return streamFile(c, `${module}-${todayIst()}.${format}`, format === 'csv' ? MIME.csv : MIME.xlsx, (sink) =>
      format === 'csv' ? writeCsv(sink, dsWithMeta) : writeXlsx(sink, [dsWithMeta]),
    )
  })
