// Seeds a demo account with realistic data so the dashboard has life.
// Usage: node scripts/seed.mjs [email]
// Runs against SMOKE_BASE (default http://localhost:3000). Re-running adds
// another copy of the demo data; delete the demo user to start over.
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000'
const ORIGIN = BASE
const DEMO_EMAIL = process.argv[2] ?? 'demo@quickmoney.test'

// Seeding writes a well-known demo account: only ever run it against a local
// dev server unless explicitly overridden.
if (process.env.ALLOW_REMOTE_SEED !== '1' && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(BASE)) {
  console.error(`Refusing to seed non-local server ${BASE}. Set ALLOW_REMOTE_SEED=1 to override.`)
  process.exit(1)
}

let cookie = ''
async function req(method, path, body, expect = 200) {
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
    cookie = [...new Set([...cookie.split('; ').filter(Boolean), ...sc.map((c) => c.split(';')[0])])].join('; ')
  }
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON body */
  }
  const ok = typeof expect === 'number' ? res.status === expect : expect.includes(res.status)
  if (!ok) {
    throw new Error(`${method} ${path} -> ${res.status} (expected ${expect})\n${text.slice(0, 400)}`)
  }
  return json
}

const demo = { name: 'Demo Owner', email: DEMO_EMAIL, password: 'demo-password-1', username: 'demoowner' }
try {
  await req('POST', '/api/auth/sign-up/email', demo)
  console.log('signed up', DEMO_EMAIL)
} catch {
  await req('POST', '/api/auth/sign-in/email', { email: demo.email, password: demo.password })
  console.log('signed in', DEMO_EMAIL)
}

const existing = await req('GET', '/api/trips?page=1&pageSize=1')
if (existing.total > 0) {
  console.log('demo data already present for', DEMO_EMAIL, '- nothing to do (delete the demo user to re-seed)')
  process.exit(0)
}

async function findOrCreate(path, matchKey, matchValue, body) {
  const list = await req('GET', `/api/${path}?q=${encodeURIComponent(matchValue)}&page=1&pageSize=10`)
  const hit = list.items.find((x) => x[matchKey] === matchValue)
  if (hit) {
    return hit
  }
  return req('POST', `/api/${path}`, body, 201)
}

const truck = async (registrationNumber) =>
  findOrCreate('trucks', 'registrationNumber', registrationNumber, {
    registrationNumber,
  })
const driver = async (name, phone) => findOrCreate('drivers', 'name', name, { name, phone })
const customer = async (name, phone, location) => findOrCreate('customers', 'name', name, { name, phone, location })

const t1 = await truck('MH 12 AB 1234')
const t2 = await truck('MH 14 CD 5678')
const d1 = await driver('Raju Yadav', '+919822011111')
const d2 = await driver('Santosh Pawar', '+919822022222')
const c1 = await customer('Sharma Building Material', '+912531234567', 'Nashik')
const c2 = await customer('Patil Traders', '+912021112222', 'Pune')
const c3 = await customer('Khan Suppliers', '+912226663333', 'Mumbai')

const trips = [
  {
    d: '2026-08-04',
    c: c1,
    t: t1,
    w: d1,
    km: '118',
    from: 'Pimpalgaon kiln',
    to: 'Sharma yard',
    qty: 3000,
    cp: '4.50',
    sp: '7.00',
    own: false,
    costs: { diesel: '4200', tollTaxes: '650', driverSalary: '1500', labour: '900' },
    pay: 'full',
  },
  {
    d: '2026-08-12',
    c: c2,
    t: t2,
    w: d2,
    km: '96',
    from: 'Own kiln',
    to: 'Patil site',
    qty: 2500,
    cp: '3.80',
    sp: '6.80',
    own: true,
    skip: true,
    costs: { diesel: '3500', royalty: '800', driverSalary: '1500' },
    pay: 'full',
  },
  {
    d: '2026-08-21',
    c: c1,
    t: t1,
    w: d1,
    km: '124',
    from: 'Sinnar kiln',
    to: 'Sharma yard',
    qty: 3200,
    cp: '4.60',
    sp: '7.10',
    own: false,
    costs: { diesel: '4400', adblue: '300', tollTaxes: '650', driverSalary: '1500', labour: '950' },
    pay: 'part',
  },
  {
    d: '2026-09-02',
    c: c3,
    t: t2,
    w: d2,
    km: '210',
    from: 'Own kiln',
    to: 'Khan depot',
    qty: 4000,
    cp: '3.80',
    sp: '7.20',
    own: true,
    skip: false,
    costs: { diesel: '6800', tollTaxes: '1200', driverSalary: '2000', miscellaneous: '500' },
    pay: 'none',
  },
  {
    d: '2026-09-09',
    c: c2,
    t: t1,
    w: d1,
    km: '102',
    from: 'Nashik Road kiln',
    to: 'Patil site',
    qty: 2800,
    cp: '4.75',
    sp: '7.00',
    own: false,
    costs: { diesel: '3800', royalty: '600', driverSalary: '1500' },
    pay: 'full',
  },
  {
    d: '2026-09-17',
    c: c1,
    t: t2,
    w: d2,
    km: '118',
    from: 'Pimpalgaon kiln',
    to: 'Sharma yard',
    qty: 3000,
    cp: '4.50',
    sp: '7.00',
    own: false,
    costs: { diesel: '4200', tollTaxes: '650', driverSalary: '1500', labour: '900' },
    pay: 'part',
  },
  {
    d: '2026-09-25',
    c: c3,
    t: t1,
    w: d1,
    km: '205',
    from: 'Igatpuri kiln',
    to: 'Khan depot',
    qty: 3800,
    cp: '5.00',
    sp: '7.50',
    own: false,
    costs: { diesel: '6600', adblue: '350', tollTaxes: '1200', driverSalary: '2000' },
    pay: 'none',
  },
  {
    d: '2026-10-03',
    c: c2,
    t: t2,
    w: d2,
    km: '98',
    from: 'Own kiln',
    to: 'Patil site',
    qty: 2600,
    cp: '3.80',
    sp: '6.80',
    own: true,
    skip: true,
    costs: { diesel: '3600', driverSalary: '1500' },
    pay: 'full',
  },
  {
    d: '2026-10-08',
    c: c1,
    t: t1,
    w: d1,
    km: '120',
    from: 'Sinnar kiln',
    to: 'Sharma yard',
    qty: 3100,
    cp: '4.60',
    sp: '7.10',
    own: false,
    costs: { diesel: '4300', tollTaxes: '650', driverSalary: '1500', labour: '900' },
    pay: 'part',
  },
  {
    d: '2026-10-11',
    c: c3,
    t: t2,
    w: d2,
    km: '208',
    from: 'Own kiln',
    to: 'Khan depot',
    qty: 3900,
    cp: '3.80',
    sp: '7.20',
    own: true,
    skip: false,
    costs: { diesel: '6700', tollTaxes: '1200', driverSalary: '2000', miscellaneous: '400' },
    pay: 'none',
  },
]

let overrideDone = false
for (const s of trips) {
  const created = await req(
    'POST',
    '/api/trips',
    {
      customer: { id: s.c.id },
      truck: { id: s.t.id },
      driver: { id: s.w.id },
      tripDate: s.d,
      distance: s.km,
      startPoint: s.from,
      endPoint: s.to,
      includeBrickCost: s.skip ? false : true,
      bella: { source: s.from, quantity: s.qty, costPrice: s.cp, sellingPrice: s.sp, sourceOwnership: s.own },
      costs: s.costs,
    },
    201,
  )
  const revenue = Number(created.financials.revenue)
  if (s.pay === 'full') {
    await req('POST', `/api/trips/${created.id}/payments`, { amount: revenue.toFixed(2), paidOn: s.d }, 201)
  } else if (s.pay === 'part') {
    await req('POST', `/api/trips/${created.id}/payments`, { amount: (revenue / 2).toFixed(2), paidOn: s.d }, 201)
  }
  if (!overrideDone) {
    const calc = Number(created.financials.netMarginCalculated)
    await req('PUT', `/api/trips/${created.id}/margin-override`, { netMarginOverride: (calc + 500).toFixed(2) })
    overrideDone = true
  }
  console.log('trip', s.d, 'ok')
}

console.log(`SEED OK — sign in as ${DEMO_EMAIL} / demo-password-1`)
