import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '~/components/RequireAuth'
import { MonthlyTable } from '~/components/MonthlyTable'
import { Badge, Button, Card, Stat } from '~/components/ui'
import { api } from '~/lib/api'
import { dateIst, money, qty, todayIso } from '~/lib/format'
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
  // IST calendar month, matching the server's monthly bucketing.
  const thisMonth = todayIso().slice(0, 7)
  const monthRow = monthly.months.find((m) => m.month === thisMonth)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Home</h1>
          <p className="text-xs text-gray-500">Only your own work is shown here.</p>
        </div>
        <Link to="/trips/new">
          <Button>+ New trip</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link to="/trips" search={{ paymentDue: 'true' }}>
          <Stat
            label="Money to collect"
            value={money(totals.outstanding)}
            sub={`${qty(totals.dueTripCount)} trips not fully paid — tap to see`}
          />
        </Link>
        <Link to="/reports">
          <Stat
            label="Costs this month"
            value={monthRow ? money(monthRow.total) : money('0')}
            sub={monthRow ? `${qty(monthRow.tripCount)} trips this month — tap for reports` : 'No trips this month yet'}
          />
        </Link>
        <Link to="/trips">
          <Stat label="Trips" value={qty(totals.tripCount)} sub="Tap to see all trips" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Link to="/trips">
          <Stat label="Trips" value={qty(counts.trips)} />
        </Link>
        <Link to="/trucks">
          <Stat label="Trucks" value={qty(counts.trucks)} />
        </Link>
        <Link to="/drivers">
          <Stat label="Drivers" value={qty(counts.drivers)} />
        </Link>
        <Link to="/customers">
          <Stat label="Customers" value={qty(counts.customers)} />
        </Link>
        <Link to="/bella">
          <Stat label="Brick loads" value={qty(counts.bellas)} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total sales" value={money(totals.revenue)} sub={`${qty(totals.tripCount)} trips`} />
        <Stat label="Total trip costs" value={money(totals.totalTripCost)} />
        <Stat
          label="Profit (worked out)"
          value={money(totals.netMarginCalculated)}
          sub={totals.overriddenCount ? `${totals.overriddenCount} fixed by hand` : undefined}
          tone={Number(totals.netMarginCalculated) >= 0 ? 'pos' : 'neg'}
        />
        <Stat
          label="Final profit"
          value={money(totals.netMarginEffective)}
          sub="used in reports & downloads"
          tone={Number(totals.netMarginEffective) >= 0 ? 'pos' : 'neg'}
        />
        <Link to="/trips" search={{ paymentDue: 'true' }}>
          <Stat label="Money to collect" value={money(totals.outstanding)} sub={`${qty(totals.dueTripCount)} trips`} />
        </Link>
        <Stat label="Money received" value={money(totals.amountReceived)} />
        <Stat label="Brick buying cost" value={money(totals.brickCost)} />
        <Stat label="Profit maths" value={money(totals.netMarginCalculated)} sub="sales − costs − brick cost" />
      </div>

      <Card title={`Monthly costs ${monthly.from ? `(${dateIst(monthly.from)} – ${dateIst(monthly.to)})` : ''}`}>
        <MonthlyTable months={monthly.months} />
      </Card>

      <Card
        title="Recent trips"
        right={
          <Link to="/trips" className="text-xs text-indigo-600 dark:text-indigo-400">
            View all →
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Truck</th>
                <th className="px-3 py-2 text-right">Sale</th>
                <th className="px-3 py-2 text-right">Costs</th>
                <th className="px-3 py-2 text-right">Profit</th>
                <th className="px-3 py-2 text-center">Paid?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recentTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">
                    No trips yet —{' '}
                    <Link to="/trips/new" className="text-indigo-600 dark:text-indigo-400">
                      create your first trip
                    </Link>
                  </td>
                </tr>
              ) : (
                data.recentTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2">
                      <Link className="text-indigo-600 dark:text-indigo-400" to="/trips/$id" params={{ id: t.id }}>
                        {dateIst(t.tripDate)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{t.customer.name}</td>
                    <td className="px-3 py-2">{t.truck.registrationNumber}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.financials.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.financials.totalTripCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(t.financials.netMarginEffective)}{' '}
                      {t.financials.isMarginOverridden && <Badge tone="amber">fixed by hand</Badge>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.paymentDue ? <Badge tone="red">to collect</Badge> : <Badge tone="green">paid</Badge>}
                    </td>
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
