import { Link, createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { DataTable, FilterBar, cardCls, useListState, type Column } from '~/components/DataTable'
import { PageHeader } from '~/components/PageHeader'
import { Badge, Button, Card, Field, Input, Select, cx } from '~/components/ui'
import { api, qs } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { dateIst, money, qty } from '~/lib/format'
import { useMasterOptions } from '~/lib/masterOptions'
import type { PageDto, TripRowDto, TripTotalsDto } from '~/shared/schemas'

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  customerId: z.string().optional(),
  truckId: z.string().optional(),
  driverId: z.string().optional(),
  paymentDue: z.string().optional(),
  sourceOwnership: z.string().optional(),
  marginOverridden: z.string().optional(),
  q: z.string().optional(),
})

export const Route = createFileRoute('/trips/')({
  // Malformed deep links fall back to no filters instead of throwing.
  validateSearch: (s) => {
    const parsed = searchSchema.safeParse(s)
    return parsed.success ? parsed.data : {}
  },
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Trips · Quick Money' }] }),
  component: TripsPage,
})

function TripsPage() {
  const search = Route.useSearch()
  const [state, patch] = useListState('tripDate', {
    q: search.q ?? '',
    from: search.from ?? '',
    to: search.to ?? '',
    customerId: search.customerId ?? '',
    truckId: search.truckId ?? '',
    driverId: search.driverId ?? '',
    paymentDue: search.paymentDue ?? '',
    sourceOwnership: search.sourceOwnership ?? '',
    marginOverridden: search.marginOverridden ?? '',
  })

  const query = { ...state, sort: state.sort, order: state.order, page: state.page, pageSize: state.pageSize }
  const { data, isLoading, error } = useQuery({
    queryKey: ['trips', query],
    queryFn: () => api<PageDto<TripRowDto>>('GET', `/trips${qs(query)}`),
    placeholderData: keepPreviousData,
  })
  const filterParams = {
    from: state.from,
    to: state.to,
    customerId: state.customerId,
    truckId: state.truckId,
    driverId: state.driverId,
    paymentDue: state.paymentDue,
    sourceOwnership: state.sourceOwnership,
    marginOverridden: state.marginOverridden,
    q: state.q,
  }
  const { data: totals } = useQuery({
    queryKey: ['tripsTotals', filterParams],
    queryFn: () => api<TripTotalsDto>('GET', `/reports/trips/totals${qs(filterParams)}`),
    placeholderData: keepPreviousData,
  })
  const { customers, trucks, drivers } = useMasterOptions()

  const filterCount = [
    state.from,
    state.to,
    state.customerId,
    state.truckId,
    state.driverId,
    state.paymentDue,
    state.sourceOwnership,
    state.marginOverridden,
  ].filter((v) => v !== '' && v !== undefined).length
  const clearFilters = () =>
    patch({
      from: '',
      to: '',
      customerId: '',
      truckId: '',
      driverId: '',
      paymentDue: '',
      sourceOwnership: '',
      marginOverridden: '',
    })

  const columns: Column<TripRowDto>[] = [
    {
      key: 'tripDate',
      header: 'Date',
      sortable: true,
      render: (t) => (
        <Link className="font-medium text-link" to="/trips/$id" params={{ id: t.id }}>
          {dateIst(t.tripDate)}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (t) => t.customer.name },
    {
      key: 'truck',
      header: 'Truck',
      render: (t) => <span className="font-mono text-[13px]">{t.truck.registrationNumber}</span>,
    },
    { key: 'driver', header: 'Driver', render: (t) => t.driver.name },
    {
      key: 'route',
      header: 'Route',
      render: (t) => (
        <span className="text-xs text-fg-2">
          {t.startPoint} to {t.endPoint}
        </span>
      ),
    },
    { key: 'distance', header: 'Km', sortable: true, align: 'right', render: (t) => qty(Number(t.distance)) },
    { key: 'revenue', header: 'Sale', sortable: true, align: 'right', render: (t) => money(t.financials.revenue) },
    {
      key: 'totalTripCost',
      header: 'Costs',
      sortable: true,
      align: 'right',
      render: (t) => money(t.financials.totalTripCost),
    },
    {
      key: 'netMarginEffective',
      header: 'Profit',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className={Number(t.financials.netMarginEffective) >= 0 ? 'text-pos' : 'text-neg'}>
          {money(t.financials.netMarginEffective)}
          {t.financials.isMarginOverridden ? <Badge tone="amber">Adjusted</Badge> : null}
        </span>
      ),
    },
    {
      key: 'amountRemaining',
      header: 'Left to collect',
      sortable: true,
      align: 'right',
      render: (t) => money(t.financials.amountRemaining),
    },
    {
      key: 'paymentDue',
      header: 'Status',
      align: 'center',
      render: (t) => (t.paymentDue ? <Badge tone="red">To collect</Badge> : <Badge tone="green">Paid</Badge>),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trips"
        action={
          <div className="flex flex-wrap gap-2">
            <a
              className="hidden min-h-9 items-center rounded-md border border-line-control px-3 text-sm font-medium hover:bg-subtle active:bg-subtle-strong sm:inline-flex"
              href={`/api/exports/trips?format=csv${qs(filterParams)}`}
            >
              Export CSV
            </a>
            <a
              className="hidden min-h-9 items-center rounded-md border border-line-control px-3 text-sm font-medium hover:bg-subtle active:bg-subtle-strong sm:inline-flex"
              href={`/api/exports/trips?format=xlsx${qs(filterParams)}`}
            >
              Export XLSX
            </a>
            <Link to="/trips/new">
              <Button>New trip</Button>
            </Link>
          </div>
        }
      />

      {totals ? (
        <div className="card-flip flex flex-wrap gap-x-8 gap-y-1 rounded-lg px-4 py-2.5 text-sm tabular-nums shadow-card">
          <span className="text-fg-2">{qty(totals.tripCount)} trips</span>
          <span>
            Sale <b>{money(totals.revenue)}</b>
          </span>
          <span>
            Costs <b>{money(totals.totalTripCost)}</b>
          </span>
          <span>
            Profit <b>{money(totals.netMarginEffective)}</b>
            {totals.overriddenCount ? <Badge tone="amber">{totals.overriddenCount} fixed by hand</Badge> : null}
          </span>
          <span>
            To collect <b>{money(totals.outstanding)}</b>
          </span>
        </div>
      ) : null}

      <Card>
        <DataTable
          columns={columns}
          page={data}
          loading={isLoading}
          error={error}
          state={state}
          onState={patch}
          card={(t) => (
            <Link to="/trips/$id" params={{ id: t.id }} className={cx(cardCls, 'block active:bg-subtle')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{dateIst(t.tripDate)}</span>
                {t.paymentDue ? <Badge tone="red">To collect</Badge> : <Badge tone="green">Paid</Badge>}
              </div>
              <div className="mt-1 text-sm">{t.customer.name}</div>
              <div className="mt-0.5 truncate text-xs text-fg-2">
                <span className="font-mono text-[13px]">{t.truck.registrationNumber}</span> · {t.startPoint} to{' '}
                {t.endPoint}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-xs tabular-nums">
                <span className="text-fg-2">
                  Sale <b className="text-fg">{money(t.financials.revenue)}</b>
                </span>
                <span className={Number(t.financials.netMarginEffective) >= 0 ? 'text-pos' : 'text-neg'}>
                  Profit <b>{money(t.financials.netMarginEffective)}</b>
                </span>
                <span className="text-fg-2">
                  To collect <b className="text-fg">{money(t.financials.amountRemaining)}</b>
                </span>
              </div>
            </Link>
          )}
          toolbar={
            <FilterBar
              searchValue={String(state.q ?? '')}
              onSearch={(v) => patch({ q: v })}
              searchPlaceholder="Customer, truck, driver, places…"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter trips"
            >
              <Field label="From date">
                <Input
                  type="date"
                  value={state.from}
                  onChange={(e) => patch({ from: e.target.value })}
                  className="w-36"
                />
              </Field>
              <Field label="To date">
                <Input type="date" value={state.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" />
              </Field>
              <Field label="Customer">
                <Select
                  value={state.customerId}
                  onChange={(e) => patch({ customerId: e.target.value })}
                  className="w-36"
                >
                  <option value="">All</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Truck">
                <Select value={state.truckId} onChange={(e) => patch({ truckId: e.target.value })} className="w-32">
                  <option value="">All</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.registrationNumber}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Driver">
                <Select value={state.driverId} onChange={(e) => patch({ driverId: e.target.value })} className="w-32">
                  <option value="">All</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment">
                <Select
                  value={state.paymentDue}
                  onChange={(e) => patch({ paymentDue: e.target.value })}
                  className="w-28"
                >
                  <option value="">All</option>
                  <option value="true">Due</option>
                  <option value="false">Paid</option>
                </Select>
              </Field>
              <Field label="Bricks">
                <Select
                  value={state.sourceOwnership}
                  onChange={(e) => patch({ sourceOwnership: e.target.value })}
                  className="w-32"
                >
                  <option value="">All</option>
                  <option value="true">Own kiln</option>
                  <option value="false">Third-party</option>
                </Select>
              </Field>
              <Field label="Profit">
                <Select
                  value={state.marginOverridden}
                  onChange={(e) => patch({ marginOverridden: e.target.value })}
                  className="w-32"
                >
                  <option value="">All</option>
                  <option value="true">Fixed by hand</option>
                  <option value="false">Worked out</option>
                </Select>
              </Field>
            </FilterBar>
          }
        />
      </Card>
    </div>
  )
}
