# Quick Money — Truck, Trip & Bella (Brick) Management Dashboard

Multi-user business management dashboard for a trucking + brick ("bella") operation:
trucks, drivers, customers, brick loads, trips with per-trip expense breakdowns,
payments, net-margin tracking, monthly summaries, and CSV/Excel exports.

**Stack:** TanStack Start (Cloudflare Workers) · Hono (`/api/*`) · Prisma 7 on
PostgreSQL (Neon) · Better Auth (email/password + Google + username) ·
decimal-only money math (INR, 2 dp) · IST date semantics.

---

## Quick start (local)

```bash
pnpm install
cp .env.example .env            # then fill in the values (see below)
pnpm prisma migrate deploy      # or: pnpm db:migrate for dev iterations
pnpm dev                        # http://localhost:3000
```

Sign up at `/signup` (email + password works without any Google setup), then
create trucks/drivers/customers and your first trip.

### Environment (`.env`, read by both Prisma CLI and wrangler dev)

| Variable                                    | Meaning                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | Pooled connection (Neon hostname contains `-pooler`) — used by the Worker at runtime |
| `DIRECT_URL`                                | Direct (unpooled) connection — used by the Prisma CLI for migrations                 |
| `TEST_DATABASE_URL`                         | Disposable database for tests (not needed anymore; reserved)                         |
| `BETTER_AUTH_SECRET`                        | `openssl rand -base64 32`                                                            |
| `BETTER_AUTH_URL`                           | App origin, e.g. `http://localhost:3000`                                             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth; authorise redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google`    |

---

## Scripts

| Command                                       | What it does                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                    | Dev server (Cloudflare Workers runtime via miniflare) on :3000                                                       |
| `pnpm build`                                  | Production worker build into `dist/`                                                                                 |
| `pnpm preview`                                | Serves the built worker locally (port 4173)                                                                          |
| `pnpm typecheck`                              | `tsc --noEmit`                                                                                                       |
| `pnpm test`                                   | Vitest unit tests (formulas, dates, export-cell hygiene)                                                             |
| `pnpm smoke`                                  | End-to-end HTTP suite against a running server (`SMOKE_BASE` to override origin)                                     |
| `pnpm seed [email]`                           | Seeds a demo account (`demo@quickmoney.test` / `demo-password-1`) with 10 trips across Aug–Oct; skips if data exists |
| `pnpm db:migrate` / `db:deploy` / `db:studio` | Prisma migrations                                                                                                    |
| `pnpm deploy`                                 | `build` + `wrangler deploy`                                                                                          |

---

## Deploy to Cloudflare Workers

```bash
pnpm dlx wrangler login
pnpm dlx wrangler secret put DATABASE_URL        # Neon pooled URL
pnpm dlx wrangler secret put BETTER_AUTH_SECRET
pnpm dlx wrangler secret put BETTER_AUTH_URL     # https://your-domain
pnpm dlx wrangler secret put GOOGLE_CLIENT_ID    # optional
pnpm dlx wrangler secret put GOOGLE_CLIENT_SECRET# optional
pnpm deploy
```

Notes:

- Migrations run from your machine against Neon: `DIRECT_URL=... pnpm prisma migrate deploy`.
- The bundle is ~2.2 MB gzipped (includes the Prisma WASM query compiler and
  ExcelJS). It fits the Workers 3 MB free-plan limit, but larger data plans
  allow raising `"limits": { "cpu_ms": ... }` in `wrangler.jsonc` for heavy exports.
- Each request creates (and closes) its own Prisma client — required on Workers.

---

## Business rules (implemented once, used everywhere)

All formulas live in `src/server/services/calc.ts` and, for aggregation, in the
`trip_financials` SQL view (see `prisma/migrations`). Lists, dashboard, reports
and exports all read from these, so numbers can never disagree.

- **Revenue** = `brickQuantity × brickSellingPrice` (locked copy on the trip)
- **Brick cost** = `brickQuantity × brickCostPrice`, included only when
  `includeBrickCost` — which may be false **only for own-kiln bricks**
  (`sourceOwnership = true`); enforced by service checks and a DB CHECK.
- **Total trip cost** = diesel + adblue + royalty + toll taxes + driver salary
  - miscellaneous + labour (never stored, always summed)
- **Net margin (calculated)** = revenue − brick cost − total trip cost
- **Net margin (effective)** = manual override ?? calculated. The override is
  stored separately, survives every recalculation, and is flagged "manual" in
  the UI; dashboards/reports/exports use the effective value.
- **Payments**: one row per instalment; `amountReceived` = sum of payments;
  `amountRemaining` = revenue − received; `paymentDue` is system-synced to
  `remaining > 0`; overpayments are rejected. **Outstanding** = Σ remaining of
  due trips.
- **Bella** records are 1:1 with trips and created inside the trip form. The
  trip keeps a **locked copy** of quantity/prices at creation:
  - correctable only while the trip has **no payments** (mirrored to the bella row);
  - the Bella page may edit only `source` / `sourceOwnership` — never money.
- **Trucks**: `dieselCost`, `dieselLiters`, `distanceTraveled` are manual;
  mileage (km/L) and ₹/km are derived. Registration is unique per user
  (normalised: trimmed, upper-cased).
- **Deletes**: truck/driver/customer referenced by trips → 409; deleting a trip
  removes its bella record, trip costs and payments in one transaction.
- **Dates**: `tripDate`/`paidOn` are Asia/Kolkata calendar dates; monthly
  summaries group by the trip's month; `createdAt` filters are IST days.
- **Historical accuracy**: editing a bella/truck record never rewrites an
  existing trip's stored figures.

## Exports

- `GET /api/exports/full?format=csv|xlsx` — every module (CSV = zipped
  per-module files; XLSX = one sheet per module).
- `GET /api/exports/report?format=…&<trip filters>` — trips, trip costs, monthly
  summary and a summary sheet whose totals come from the same function as the
  dashboard.
- `GET /api/exports/:module?format=…&<module filters>` — trips, trip-costs,
  trucks, drivers, customers, bella, payments.

All exports are user-scoped, streamed in 1000-row batches with back-pressure,
keep ids + foreign keys for re-joining, write amounts as numbers with 2 dp, and
prefix spreadsheet-formula-like text (`= + - @` tab/CR) with `'`.

## Layout

```
prisma/schema.prisma        # models + composite user FKs (ownership in the DB)
prisma/migrations/         # incl. CHECK constraints + trip_financials view
src/server/                 # Hono app: routes/, services/, exports/, lib/
src/shared/schemas.ts       # Zod request/response contracts (API + UI)
src/routes/                 # TanStack Start pages; routes/api/$.ts mounts Hono
scripts/smoke.mjs           # end-to-end HTTP suite
tests/calc.test.ts          # formula/date/export-cell unit tests
```

## Auth & isolation

Better Auth owns `user/session/account/verification`; the username plugin adds
unique usernames; `phone` is an additional user field editable via `PUT /api/me`.
Every business table carries `user_id` with `@@unique([id, user_id])`, and trips
reference their masters through `(id, user_id)` composite FKs — the database
itself refuses cross-user links. The session middleware supplies `userId`;
client-supplied ids are never trusted. Other users' records return 404.
