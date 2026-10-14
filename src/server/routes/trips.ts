import { Hono } from 'hono'
import { z } from 'zod'
import {
  bellaListQuery,
  bellaOut,
  bellaUpdate,
  dashboardOut,
  marginOverrideInput,
  monthlyOut,
  monthlyQuery,
  pageOut,
  paymentInput,
  paymentListQuery,
  paymentRowOut,
  paymentUpdate,
  tripCreate,
  tripDetailOut,
  tripFilters,
  tripListQuery,
  tripRowOut,
  tripTotalsOut,
  tripUpdate,
} from '~/shared/schemas'
import { ok, v, type AppEnv } from '../http'
import * as bella from '../services/bella'
import * as payments from '../services/payments'
import * as reports from '../services/reports'
import * as trips from '../services/trips'
import { tripTotals } from '../services/tripQuery'

const idParam = z.object({ id: z.string().min(1).max(64) })

export const tripsRoutes = new Hono<AppEnv>()
  .get('/', v('query', tripListQuery), async (c) =>
    ok(c, pageOut(tripRowOut), await trips.listTrips(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .post('/', v('json', tripCreate), async (c) =>
    ok(c, tripDetailOut, await trips.createTrip(c.var.db, c.var.userId, c.req.valid('json')), 201),
  )
  .get('/:id', v('param', idParam), async (c) =>
    ok(c, tripDetailOut, await trips.getTrip(c.var.db, c.var.userId, c.req.valid('param').id)),
  )
  .patch('/:id', v('param', idParam), v('json', tripUpdate), async (c) =>
    ok(c, tripDetailOut, await trips.updateTrip(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json'))),
  )
  .put('/:id/margin-override', v('param', idParam), v('json', marginOverrideInput), async (c) =>
    ok(
      c,
      tripDetailOut,
      await trips.setMarginOverride(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')),
    ),
  )
  .delete('/:id', v('param', idParam), async (c) => {
    await trips.deleteTrip(c.var.db, c.var.userId, c.req.valid('param').id)
    return c.body(null, 204)
  })
  .post('/:id/payments', v('param', idParam), v('json', paymentInput), async (c) =>
    ok(
      c,
      tripDetailOut,
      await payments.addPayment(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')),
      201,
    ),
  )

export const paymentsRoutes = new Hono<AppEnv>()
  .get('/', v('query', paymentListQuery), async (c) =>
    ok(c, pageOut(paymentRowOut), await payments.listPayments(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .patch('/:id', v('param', idParam), v('json', paymentUpdate), async (c) =>
    ok(
      c,
      tripDetailOut,
      await payments.updatePayment(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')),
    ),
  )
  .delete('/:id', v('param', idParam), async (c) =>
    ok(c, tripDetailOut, await payments.deletePayment(c.var.db, c.var.userId, c.req.valid('param').id)),
  )

export const bellaRoutes = new Hono<AppEnv>()
  .get('/', v('query', bellaListQuery), async (c) =>
    ok(c, pageOut(bellaOut), await bella.listBella(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .get('/:id', v('param', idParam), async (c) =>
    ok(c, bellaOut, await bella.getBella(c.var.db, c.var.userId, c.req.valid('param').id)),
  )
  .patch('/:id', v('param', idParam), v('json', bellaUpdate), async (c) =>
    ok(c, bellaOut, await bella.updateBella(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json'))),
  )

export const reportsRoutes = new Hono<AppEnv>()
  .get('/dashboard', v('query', tripFilters), async (c) =>
    ok(c, dashboardOut, await reports.dashboard(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .get('/monthly', v('query', monthlyQuery), async (c) =>
    ok(c, monthlyOut, await reports.monthlySummary(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .get('/trips/totals', v('query', tripFilters), async (c) =>
    ok(c, tripTotalsOut, await tripTotals(c.var.db, c.var.userId, c.req.valid('query'))),
  )
