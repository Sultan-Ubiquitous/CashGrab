import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '~/components/RequireAuth'
import { Badge, Card, Stat } from '~/components/ui'
import { api, qs } from '~/lib/api'
import { dateIst, money, monthLabel, qty } from '~/lib/format'
import type { DashboardDto } from '~/shared/schemas'

export const Route = createFileRoute('/')({
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
})

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardDto>('GET', '/reports/dashboard'),
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error || !data) return <p className="text-sm text-red-600">Failed to load dashboard. Is the API running?</p>

  const { counts, totals, monthly } = data
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs text-gray-500">All figures are your own data only.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Link to="/trips"><Stat label="Trips" value={qty(counts.trips)} /></Link>
        <Link to="/trucks"><Stat label="Trucks" value={qty(counts.trucks)} /></Link>
        <Link to="/drivers"><Stat label="Drivers" value={qty(counts.drivers)} /></Link>
        <Link to="/customers"><Stat label="Customers" value={qty(counts.customers)} /></Link>
        <Link to="/bella"><Stat label="Bella records" value={qty(counts.bellas)} /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue" value={money(totals.revenue)} sub={`${qty(totals.tripCount)} trips`} />
        <Stat label="Total trip expenses" value={money(totals.totalTripCost)} />
        <Stat
          label="Net margin (calculated)"
          value={money(totals.netMarginCalculated)}
          sub={totals.overriddenCount ? `${totals.overriddenCount} manually overridden` : undefined}
          tone={Number(totals.netMarginCalculated) >= 0 ? 'pos' : 'neg'}
        />
        <Stat
          label="Net margin (effective)"
          value={money(totals.netMarginEffective)}
          sub="used in reports & exports"
          tone={Number(totals.netMarginEffective) >= 0 ? 'pos' : 'neg'}
        />
        <Stat label="Outstanding payments" value={money(totals.outstanding)} sub={`${qty(totals.dueTripCount)} trips due`} />
        <Stat label="Amount received" value={money(totals.amountReceived)} />
        <Stat label="Brick cost included" value={money(totals.brickCost)} />
        <Stat label="Revenue − costs − brick cost" value={money(totals.netMarginCalculated)} sub="margin formula" />
      </div>

      <Card title={`Monthly expenses ${monthly.from ? `(${dateIst(monthly.from)} – ${dateIst(monthly.to)})` : ''}`}>
        <MonthlyTable months={monthly.months} />
      </Card>

      <Card title="Recent trips" right={<Link to="/trips" className="text-xs text-indigo-600 dark:text-indigo-400">View all →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Truck</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Expenses</th>
                <th className="px-3 py-2 text-right">Net margin</th>
                <th className="px-3 py-2 text-center">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recentTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">
                    No trips yet — <Link to="/trips/new" className="text-indigo-600 dark:text-indigo-400">create your first trip</Link>
                  </td>
                </tr>
              ) : (
                data.recentTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2"><Link className="text-indigo-600 dark:text-indigo-400" to="/trips/$id" params={{ id: t.id }}>{dateIst(t.tripDate)}</Link></td>
                    <td className="px-3 py-2">{t.customer.name}</td>
                    <td className="px-3 py-2">{t.truck.registrationNumber}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.financials.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.financials.totalTripCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(t.financials.netMarginEffective)} {t.financials.isMarginOverridden && <Badge tone="amber">manual</Badge>}
                    </td>
                    <td className="px-3 py-2 text-center">{t.paymentDue ? <Badge tone="red">due</Badge> : <Badge tone="green">paid</Badge>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function MonthlyTable({ months }: { months: DashboardDto['monthly']['months'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2 text-right">Diesel</th>
            <th className="px-3 py-2 text-right">AdBlue</th>
            <th className="px-3 py-2 text-right">Royalty</th>
            <th className="px-3 py-2 text-right">Tolls & taxes</th>
            <th className="px-3 py-2 text-right">Driver salary</th>
            <th className="px-3 py-2 text-right">Misc</th>
            <th className="px-3 py-2 text-right">Labour</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Δ prev</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
          {months.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-400">No trips in this period</td></tr>
          ) : (
            months.map((m) => (
              <tr key={m.month}>
                <td className="px-3 py-2 font-medium">{monthLabel(m.month)}</td>
                <td className="px-3 py-2 text-right">{money(m.diesel)}</td>
                <td className="px-3 py-2 text-right">{money(m.adblue)}</td>
                <td className="px-3 py-2 text-right">{money(m.royalty)}</td>
                <td className="px-3 py-2 text-right">{money(m.tollTaxes)}</td>
                <td className="px-3 py-2 text-right">{money(m.driverSalary)}</td>
                <td className="px-3 py-2 text-right">{money(m.miscellaneous)}</td>
                <td className="px-3 py-2 text-right">{money(m.labour)}</td>
                <td className="px-3 py-2 text-right font-semibold">{money(m.total)}</td>
                <td className="px-3 py-2 text-right">
                  {m.changeFromPrevious === null ? '—' : <span className={Number(m.changeFromPrevious) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{money(m.changeFromPrevious)}</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
