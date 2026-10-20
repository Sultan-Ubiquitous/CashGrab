import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, Button, Card, Skeleton, Stat } from '~/components/ui'
import { ListRow } from '~/components/ListRow'
import { EmptyState } from '~/components/EmptyState'
import { PageHeader } from '~/components/PageHeader'
import { api } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { dateIst, money, qty, todayIso } from '~/lib/format'
import type { DashboardDto } from '~/shared/schemas'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Home · Quick Money' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardDto>('GET', '/reports/dashboard'),
  })

  if (isLoading) return <DashboardSkeleton />
  if (error || !data) return <p className="text-sm text-neg">Could not load the dashboard. Try refreshing the page.</p>

  const { totals, monthly } = data
  // IST calendar month, matching the server's monthly bucketing.
  const thisMonth = todayIso().slice(0, 7)
  const monthRow = monthly.months.find((m) => m.month === thisMonth)
  const recent = data.recentTrips.slice(0, 5)
  const profit = Number(totals.netMarginEffective)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        description="Only your own work is shown here."
        action={
          <Link to="/trips/new">
            <Button>New trip</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link to="/trips" search={{ paymentDue: 'true' }}>
          <Stat
            label="Money to collect"
            value={money(totals.outstanding)}
            sub={`${qty(totals.dueTripCount)} trips not fully paid`}
          />
        </Link>
        <Link to="/trips">
          <Stat
            label="Profit"
            value={money(totals.netMarginEffective)}
            sub={totals.overriddenCount ? `${totals.overriddenCount} adjusted by hand` : 'All trips'}
            tone={profit >= 0 ? 'pos' : 'neg'}
          />
        </Link>
        <Link to="/trips">
          <Stat label="Trips this month" value={qty(monthRow?.tripCount ?? 0)} sub="Current month" />
        </Link>
        <Link to="/reports">
          <Stat label="Costs this month" value={money(monthRow ? monthRow.total : '0')} sub="See reports" />
        </Link>
      </div>

      <Card
        title="Recent trips"
        right={
          <Link to="/trips" className="text-xs font-medium text-link">
            View all
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState
            title="No trips yet"
            description="Record your first trip to see it here."
            action={
              <Link to="/trips/new">
                <Button size="sm">New trip</Button>
              </Link>
            }
          />
        ) : (
          <ul className="-my-3 divide-y divide-line">
            {recent.map((t) => (
              <li key={t.id}>
                <Link to="/trips/$id" params={{ id: t.id }} className="-mx-2 block rounded-md px-2 hover:bg-subtle">
                  <ListRow>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.customer.name}</div>
                      <div className="text-xs text-fg-2">
                        {dateIst(t.tripDate)} ·{' '}
                        <span className="font-mono text-[13px]">{t.truck.registrationNumber}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums md:justify-end">
                      <span>
                        <span className="text-xs text-fg-2">Sale </span>
                        {money(t.financials.revenue)}
                      </span>
                      <span className={Number(t.financials.netMarginEffective) < 0 ? 'text-neg' : undefined}>
                        <span className="text-xs text-fg-2">Profit </span>
                        {money(t.financials.netMarginEffective)}
                      </span>
                      {t.paymentDue ? <Badge tone="red">To collect</Badge> : <Badge tone="green">Paid</Badge>}
                    </div>
                  </ListRow>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
