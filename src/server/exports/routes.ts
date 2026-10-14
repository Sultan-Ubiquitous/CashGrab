import { Hono } from 'hono'
import { z } from 'zod'
import { bellaListQuery, masterListQuery, paymentListQuery, tripFilters, tripListQuery } from '~/shared/schemas'
import { todayIst } from '~/shared/dates'
import type { AppEnv, Ctx } from '../http'
import { v } from '../http'
import type { Db } from '../db'
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
    const build = MODULE_EXPORTS[module]
    if (!build) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Unknown export module',
            details: { modules: Object.keys(MODULE_EXPORTS) },
          },
        },
        404,
      )
    }
    const params = Object.fromEntries(new URL(c.req.url).searchParams)
    const ds = await build(c.var.db, c.var.userId, params)
    const { format } = formatQuery.parse({ format: params.format })
    return streamFile(c, `${module}-${todayIst()}.${format}`, format === 'csv' ? MIME.csv : MIME.xlsx, (sink) =>
      format === 'csv' ? writeCsv(sink, ds) : writeXlsx(sink, [ds]),
    )
  })

type UrlParams = Record<string, string>

/** Pagination/sort keys accepted by the list queries but irrelevant to exports. */
function stripPaging<T extends { sort?: unknown; order?: unknown; page?: unknown; pageSize?: unknown }>(
  q: T,
): Omit<T, 'sort' | 'order' | 'page' | 'pageSize'> {
  const { sort: _sort, order: _order, page: _page, pageSize: _pageSize, ...filters } = q
  return filters
}

/**
 * One entry per exportable module: its filter contract and how to build the
 * dataset. Unknown modules fall through to the 404 above.
 */
const MODULE_EXPORTS: Record<string, (db: Db, userId: string, params: UrlParams) => Promise<Dataset>> = {
  trips: async (db, userId, p) => tripsDataset(db, userId, stripPaging(await tripListQuery.parseAsync(p))),
  'trip-costs': async (db, userId, p) => tripCostsDataset(db, userId, await tripFilters.parseAsync(p)),
  trucks: async (db, userId, p) => trucksDataset(db, userId, stripPaging(await masterListQuery.parseAsync(p))),
  drivers: async (db, userId, p) => driversDataset(db, userId, stripPaging(await masterListQuery.parseAsync(p))),
  customers: async (db, userId, p) => customersDataset(db, userId, stripPaging(await masterListQuery.parseAsync(p))),
  bella: async (db, userId, p) => bellaDataset(db, userId, stripPaging(await bellaListQuery.parseAsync(p))),
  payments: async (db, userId, p) => paymentsDataset(db, userId, stripPaging(await paymentListQuery.parseAsync(p))),
}
