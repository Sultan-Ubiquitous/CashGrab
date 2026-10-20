import 'dotenv/config'
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000'
const ORIGIN = BASE

function client() {
  let cookie = ''
  return async function req(method, path, body, expect = 200) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        Origin: ORIGIN,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const sc = res.headers.getSetCookie?.() ?? []
    if (sc.length) {
      // Last write wins per cookie name (sign-out empties the session cookie,
      // the next sign-in replaces it).
      const jar = new Map()
      for (const pair of [...cookie.split('; ').filter(Boolean), ...sc.map((c) => c.split(';')[0])]) {
        const [k, v] = pair.split(/=(.*)/s)
        jar.set(k, v)
      }
      cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const text = buf.toString('utf8')
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* binary body (zip/xlsx) or non-JSON response */
    }
    const okStatus = typeof expect === 'number' ? res.status === expect : expect.includes(res.status)
    if (!okStatus) {
      throw new Error(`${method} ${path} -> ${res.status} (expected ${expect})\n${text.slice(0, 500)}`)
    }
    return { status: res.status, json, text, buf, headers: res.headers }
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERT: ' + msg)
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`ASSERT ${msg}: ${a} !== ${b}`)
}

const A = client(),
  B = client()
const uniq = Date.now()
const aEmail = `a${uniq}@test.dev`,
  bEmail = `b${uniq}@test.dev`

// --- sign up both users
await A('POST', '/api/auth/sign-up/email', {
  name: 'User A',
  email: aEmail,
  password: 'password1',
  username: `a${uniq}`,
})
await B('POST', '/api/auth/sign-up/email', {
  name: 'User B',
  email: bEmail,
  password: 'password1',
  username: `b${uniq}`,
})

// --- profile: update name/phone/username; taken username rejected
const me1 = await A('GET', '/api/me')
assert(me1.json.username === `a${uniq}`, 'me username')
const meUpd = await A('PUT', '/api/me', { name: 'User A2', phone: '+91 98765 43210', username: `a${uniq}x` })
assert(
  meUpd.status === 200 && meUpd.json.phone === '+91 98765 43210' && meUpd.json.username === `a${uniq}x`,
  'me update',
)
const meTaken = await A('PUT', '/api/me', { username: `b${uniq}` }, 422)
assert(meTaken.status === 422 && meTaken.json.error.code === 'VALIDATION_ERROR', 'taken username rejected')

// --- sign-in methods: password flag + add-password flow (OAuth-style user)
eq(me1.json.hasPassword, true, 'email signup has password')
eq(me1.json.googleLinked, false, 'no google linked yet')

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  max: 1,
})
// Simulate a Google-only user by removing the credential account row directly.
await pgPool.query('DELETE FROM account WHERE user_id = $1 AND provider_id = $2', [me1.json.id, 'credential'])
const meNoPw = await A('GET', '/api/me')
eq(meNoPw.json.hasPassword, false, 'hasPassword false without credential account')
const setPw = await A('POST', '/api/me/set-password', { newPassword: 'new-password-1' }, 200)
assert(setPw.json.status === true, 'set-password succeeds')
const mePw = await A('GET', '/api/me')
eq(mePw.json.hasPassword, true, 'hasPassword true after set-password')
await A('POST', '/api/auth/sign-out', {}, 200)
const relogin = await A('POST', '/api/auth/sign-in/email', { email: aEmail, password: 'new-password-1' }, 200)
assert(relogin.json.user, 'email+password login works after adding a password')
await pgPool.end()

// --- A creates masters
const reg = 'MH 12 AB ' + String(uniq % 10000).padStart(4, '0')
const truck = (await A('POST', '/api/trucks', { registrationNumber: reg }, 201)).json
eq(truck.dieselCost, '0.00', 'truck diesel starts at 0')
eq(truck.distanceTraveled, '0.00', 'truck distance starts at 0')
eq(truck.costPerKm, null, 'cost/km null with no trips')
eq(truck.tripCount, 0, 'truck tripCount')
const driver = (await A('POST', '/api/drivers', { name: 'Raju', phone: '+919876543210' }, 201)).json
const customer = (
  await A('POST', '/api/customers', { name: 'Bella Depot', phone: '0221234567', location: 'Kiln Road, Nashik' }, 201)
).json

// --- isolation: B cannot see or use A's records
await B('GET', `/api/trucks/${truck.id}`, undefined, 404)
const crossRef = await B(
  'POST',
  '/api/trips',
  {
    customer: { id: customer.id },
    truck: { id: truck.id },
    driver: { id: driver.id },
    tripDate: '2026-10-05',
    distance: '120.5',
    startPoint: 'Kiln',
    endPoint: 'Depot',
    includeBrickCost: true,
    bella: { source: 'Nashik kiln', quantity: 100, costPrice: '5.00', sellingPrice: '8.00', sourceOwnership: false },
    costs: { diesel: '100' },
  },
  422,
)
eq(crossRef.json.error.code, 'INVALID_REFERENCE', 'cross-user reference rejected')

// --- inline creation: new customer/truck/driver saved with the trip in one go
const inlineTrip = (
  await A(
    'POST',
    '/api/trips',
    {
      customer: { new: { name: 'Inline Depot', phone: null, location: 'Igatpuri' } },
      truck: { new: { registrationNumber: reg + '-IN' } },
      driver: { new: { name: 'Inline Driver', phone: '+919999999999' } },
      tripDate: '2026-10-09',
      distance: '50',
      startPoint: 'Kiln',
      endPoint: 'Depot',
      includeBrickCost: true,
      bella: { source: 'Inline kiln', quantity: 200, costPrice: '5.00', sellingPrice: '8.00', sourceOwnership: false },
      costs: { diesel: '500' },
    },
    201,
  )
).json
eq(inlineTrip.customer.name, 'Inline Depot', 'inline customer')
eq(inlineTrip.truck.registrationNumber, reg + '-IN', 'inline truck')
eq(inlineTrip.driver.name, 'Inline Driver', 'inline driver')
eq(inlineTrip.financials.revenue, '1600.00', 'inline revenue')
const dupInline = await A(
  'POST',
  '/api/trips',
  {
    customer: { id: customer.id },
    truck: { new: { registrationNumber: reg + '-IN' } },
    driver: { id: driver.id },
    tripDate: '2026-10-09',
    distance: '50',
    startPoint: 'Kiln',
    endPoint: 'Depot',
    bella: { source: 'x', quantity: 10, costPrice: '1', sellingPrice: '2', sourceOwnership: false },
    costs: {},
  },
  409,
)
eq(dupInline.json.error.code, 'DUPLICATE', 'inline duplicate truck rejected')
await A('DELETE', `/api/trips/${inlineTrip.id}`, undefined, 204)

// --- A creates a trip (third-party bricks => brick cost included)
const trip = (
  await A(
    'POST',
    '/api/trips',
    {
      customer: { id: customer.id },
      truck: { id: truck.id },
      driver: { id: driver.id },
      tripDate: '2026-10-05',
      distance: '120.50',
      startPoint: 'Kiln',
      endPoint: 'Depot',
      includeBrickCost: true,
      bella: { source: 'Nashik kiln', quantity: 1000, costPrice: '5.00', sellingPrice: '8.00', sourceOwnership: false },
      costs: {
        diesel: '1500.25',
        adblue: '100',
        royalty: '200',
        tollTaxes: '50',
        driverSalary: '500',
        miscellaneous: '49.75',
        labour: '100',
      },
    },
    201,
  )
).json
eq(trip.financials.revenue, '8000.00', 'revenue')
eq(trip.financials.brickCost, '5000.00', 'brick cost')
eq(trip.financials.totalTripCost, '2500.00', 'total trip cost')
eq(trip.financials.netMarginCalculated, '500.00', 'calculated margin')
eq(trip.financials.netMarginEffective, '500.00', 'effective margin')
eq(trip.financials.amountRemaining, '8000.00', 'remaining')
eq(trip.paymentDue, true, 'paymentDue')

// --- margin override + unrelated edit keeps override
const overridden = (await A('PUT', `/api/trips/${trip.id}/margin-override`, { netMarginOverride: '650.00' })).json
eq(overridden.financials.netMarginEffective, '650.00', 'override effective')
const edited = (await A('PATCH', `/api/trips/${trip.id}`, { startPoint: 'Kiln 2' })).json
eq(edited.financials.netMarginOverride, '650.00', 'override preserved')
eq(edited.financials.netMarginEffective, '650.00', 'effective still overridden')
eq(edited.startPoint, 'Kiln 2', 'start updated')

// --- own-kiln trip allows skipping brick cost; third-party refuses
const ownTrip = (
  await A(
    'POST',
    '/api/trips',
    {
      customer: { id: customer.id },
      truck: { id: truck.id },
      driver: { id: driver.id },
      tripDate: '2026-09-20',
      distance: '80',
      startPoint: 'Own kiln',
      endPoint: 'Depot',
      includeBrickCost: false,
      bella: { source: 'Own kiln', quantity: 500, costPrice: '4.00', sellingPrice: '7.50', sourceOwnership: true },
      costs: { diesel: '800' },
    },
    201,
  )
).json
eq(ownTrip.financials.revenue, '3750.00', 'own revenue')
eq(ownTrip.financials.brickCost, '0.00', 'brick cost skipped')
eq(ownTrip.financials.netMarginCalculated, '2950.00', 'own margin')
const skipRejected = await A(
  'POST',
  '/api/trips',
  {
    customer: { id: customer.id },
    truck: { id: truck.id },
    driver: { id: driver.id },
    tripDate: '2026-09-21',
    distance: '80',
    startPoint: 'X',
    endPoint: 'Y',
    includeBrickCost: false,
    bella: { source: 'Bought kiln', quantity: 10, costPrice: '4.00', sellingPrice: '7.50', sourceOwnership: false },
    costs: {},
  },
  422,
)
eq(skipRejected.json.error.code, 'BRICK_COST_SKIP_NOT_ALLOWED', 'skip only for own kiln')

// --- truck aggregates derive from its trips (diesel + distance)
const truckAgg = (await A('GET', `/api/trucks/${truck.id}`)).json
eq(truckAgg.dieselCost, '2300.25', 'truck diesel = sum of trips (1500.25+800)')
eq(truckAgg.distanceTraveled, '200.50', 'truck distance = sum of trips (120.50+80)')
eq(truckAgg.costPerKm, '11.47', 'cost/km derived from aggregates')
eq(truckAgg.tripCount, 2, 'truck tripCount after trips')

// --- payments: partial, overpay rejected, full clears paymentDue
const p1 = (
  await A('POST', `/api/trips/${trip.id}/payments`, { amount: '3000.00', paidOn: '2026-10-08', note: 'advance' }, 201)
).json
eq(p1.financials.amountReceived, '3000.00', 'received')
eq(p1.financials.amountRemaining, '5000.00', 'remaining')
eq(p1.paymentDue, true, 'still due')
await A('POST', `/api/trips/${trip.id}/payments`, { amount: '5000.01' }, 422)
const p2 = (await A('POST', `/api/trips/${trip.id}/payments`, { amount: '5000.00' }, 201)).json
eq(p2.paymentDue, false, 'fully paid')
eq(p2.financials.amountRemaining, '0.00', 'nothing remaining')

// --- brick figures locked once payments exist
const locked = await A('PATCH', `/api/trips/${trip.id}`, { bella: { quantity: 999 } }, 409)
eq(locked.json.error.code, 'TRIP_HAS_PAYMENTS', 'brick figures locked')

// --- reports: totals and monthly over BOTH trips? no: filters by default month range applies only to monthly.
const dash = (await A('GET', '/api/reports/dashboard')).json
eq(dash.counts.trips, 2, 'dashboard trip count')
eq(dash.totals.revenue, '11750.00', 'dashboard revenue')
eq(dash.totals.netMarginCalculated, '3450.00', 'dashboard calc margin (500+2950)')
eq(dash.totals.netMarginEffective, '3600.00', 'dashboard eff margin (650+2950)')
eq(dash.totals.outstanding, '3750.00', 'outstanding (ownTrip unpaid)')
eq(dash.totals.amountReceived, '8000.00', 'received')
const monthly = (await A('GET', '/api/reports/monthly?from=2026-09-01&to=2026-10-31')).json
const sep = monthly.months.find((m) => m.month === '2026-09')
const oct = monthly.months.find((m) => m.month === '2026-10')
eq(sep.total, '800.00', 'sep costs')
eq(oct.total, '2500.00', 'oct costs')
eq(monthly.totals.total, '3300.00', 'monthly totals = dashboard totalTripCost')
eq(monthly.totals.total, dash.totals.totalTripCost, 'monthly consistent with dashboard')

// --- exports
const fullZip = await A('GET', '/api/exports/full?format=csv', undefined, 200)
eq(fullZip.headers.get('content-type'), 'application/zip', 'zip mime')
console.log('full zip bytes:', fullZip.buf.length)

const repX = await A('GET', '/api/exports/report?format=xlsx&from=2026-09-01&to=2026-10-31', undefined, 200)
eq(repX.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx mime')
console.log('report xlsx bytes:', repX.buf.length)
const repCsv = await A('GET', '/api/exports/report?format=csv&from=2026-09-01&to=2026-10-31', undefined, 200)
console.log('report csv zip bytes:', repCsv.buf.length)
const { unzipSync } = await import('fflate')
const files = unzipSync(new Uint8Array(repCsv.buf))
const summaryCsv = Buffer.from(files['summary.csv']).toString('utf8')
assert(summaryCsv.includes('3600.00'), 'export summary matches dashboard effective margin')
assert(summaryCsv.includes('3300.00'), 'export summary matches dashboard total cost')

const modCsv = await A('GET', '/api/exports/trucks?format=csv', undefined, 200)
eq(modCsv.headers.get('content-type'), 'text/csv; charset=utf-8', 'csv mime')
assert(modCsv.text.includes(reg), 'truck export contains registration')
assert(modCsv.text.includes('id,registration_number'), 'truck export headers')

// B's exports must not contain A's data. ZIP bodies are deflate-compressed, so
// searching the raw bytes for plaintext proves nothing — unzip first, and keep
// a positive control so the negative check cannot pass vacuously.
const bExport = await B('GET', '/api/exports/full?format=csv', undefined, 200)
const aFiles = unzipSync(new Uint8Array(fullZip.buf))
const bFiles = unzipSync(new Uint8Array(bExport.buf))
const aTrucksCsv = Buffer.from(aFiles['trucks.csv']).toString('utf8')
const bTrucksCsv = Buffer.from(bFiles['trucks.csv']).toString('utf8')
assert(aTrucksCsv.includes(reg), 'control: A export contains A registration')
assert(!bTrucksCsv.includes(reg), 'isolation in exports')

// --- delete in use / cascade
await A('DELETE', `/api/trucks/${truck.id}`, undefined, 409)
await A('DELETE', `/api/trips/${trip.id}`, undefined, 204)
const bellaAfter = await A('GET', `/api/bella?from=2026-09-01&to=2026-10-31`, undefined, 200)
eq(bellaAfter.json.total, 1, 'bella row deleted with its trip (only ownTrip remains)')

// unauthenticated
const anon = client()
await anon('GET', '/api/trips', undefined, 401)

console.log('SMOKE OK')
