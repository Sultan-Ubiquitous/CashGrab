import { Hono } from 'hono'
import { z } from 'zod'
import {
  customerInput,
  customerOut,
  customerUpdate,
  driverInput,
  driverOut,
  driverUpdate,
  masterListQuery,
  pageOut,
  tripListQuery,
  tripRowOut,
  truckInput,
  truckListQuery,
  truckOut,
  truckUpdate,
} from '~/shared/schemas'
import { ok, v, type AppEnv } from '../http'
import * as customers from '../services/customers'
import * as drivers from '../services/drivers'
import * as trips from '../services/trips'
import * as trucks from '../services/trucks'

const idParam = z.object({ id: z.string().min(1).max(64) })
const tripHistoryQuery = tripListQuery

export const trucksRoutes = new Hono<AppEnv>()
  .get('/', v('query', truckListQuery), async (c) =>
    ok(c, pageOut(truckOut), await trucks.listTrucks(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .post('/', v('json', truckInput), async (c) =>
    ok(c, truckOut, await trucks.createTruck(c.var.db, c.var.userId, c.req.valid('json')), 201),
  )
  .get('/:id', v('param', idParam), async (c) =>
    ok(c, truckOut, await trucks.getTruck(c.var.db, c.var.userId, c.req.valid('param').id)),
  )
  .patch('/:id', v('param', idParam), v('json', truckUpdate), async (c) =>
    ok(c, truckOut, await trucks.updateTruck(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/:id', v('param', idParam), async (c) => {
    await trucks.deleteTruck(c.var.db, c.var.userId, c.req.valid('param').id)
    return c.body(null, 204)
  })
  .get('/:id/trips', v('param', idParam), v('query', tripHistoryQuery), async (c) => {
    const { id } = c.req.valid('param')
    await trucks.getTruck(c.var.db, c.var.userId, id)
    return ok(c, pageOut(tripRowOut), await trips.listTrips(c.var.db, c.var.userId, { ...c.req.valid('query'), truckId: id }))
  })

export const driversRoutes = new Hono<AppEnv>()
  .get('/', v('query', masterListQuery), async (c) =>
    ok(c, pageOut(driverOut), await drivers.listDrivers(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .post('/', v('json', driverInput), async (c) =>
    ok(c, driverOut, await drivers.createDriver(c.var.db, c.var.userId, c.req.valid('json')), 201),
  )
  .get('/:id', v('param', idParam), async (c) =>
    ok(c, driverOut, await drivers.getDriver(c.var.db, c.var.userId, c.req.valid('param').id)),
  )
  .patch('/:id', v('param', idParam), v('json', driverUpdate), async (c) =>
    ok(c, driverOut, await drivers.updateDriver(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/:id', v('param', idParam), async (c) => {
    await drivers.deleteDriver(c.var.db, c.var.userId, c.req.valid('param').id)
    return c.body(null, 204)
  })
  .get('/:id/trips', v('param', idParam), v('query', tripHistoryQuery), async (c) => {
    const { id } = c.req.valid('param')
    await drivers.getDriver(c.var.db, c.var.userId, id)
    return ok(c, pageOut(tripRowOut), await trips.listTrips(c.var.db, c.var.userId, { ...c.req.valid('query'), driverId: id }))
  })

export const customersRoutes = new Hono<AppEnv>()
  .get('/', v('query', masterListQuery), async (c) =>
    ok(c, pageOut(customerOut), await customers.listCustomers(c.var.db, c.var.userId, c.req.valid('query'))),
  )
  .post('/', v('json', customerInput), async (c) =>
    ok(c, customerOut, await customers.createCustomer(c.var.db, c.var.userId, c.req.valid('json')), 201),
  )
  .get('/:id', v('param', idParam), async (c) =>
    ok(c, customerOut, await customers.getCustomer(c.var.db, c.var.userId, c.req.valid('param').id)),
  )
  .patch('/:id', v('param', idParam), v('json', customerUpdate), async (c) =>
    ok(c, customerOut, await customers.updateCustomer(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/:id', v('param', idParam), async (c) => {
    await customers.deleteCustomer(c.var.db, c.var.userId, c.req.valid('param').id)
    return c.body(null, 204)
  })
  .get('/:id/trips', v('param', idParam), v('query', tripHistoryQuery), async (c) => {
    const { id } = c.req.valid('param')
    await customers.getCustomer(c.var.db, c.var.userId, id)
    return ok(c, pageOut(tripRowOut), await trips.listTrips(c.var.db, c.var.userId, { ...c.req.valid('query'), customerId: id }))
  })
