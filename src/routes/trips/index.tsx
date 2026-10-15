import * as React from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { DataTable, FilterBar, cardCls, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Badge, Button, Card, Field, Input, Select, cx } from '~/components/ui'
import { api, qs } from '~/lib/api'
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
  component: () => (
    <RequireAuth>
      <TripsPage />
    </RequireAuth>
  ),
})

function TripsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
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

  // Deep-link filters seed the local list state once, then leave the URL clean.
  const deepLinked = React.useRef(false)
  React.useEffect(() => {
    if (deepLinked.current) return
    deepLinked.current = true
    if (Object.keys(search).length === 0) return
    void navigate({ to: '/trips', search: {}, replace: true })
  }, [search, navigate])

  const query = { ...state, sort: state.sort, order: state.order, page: state.page, pageSize: state.pageSize }
  const { data, isLoading, error } = useQuery({
    queryKey: ['trips', query],
    queryFn: () => api<PageDto<TripRowDto>>('GET', `/trips${qs(query)}`),
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
        <Link className="font-medium text-indigo-600 dark:text-indigo-400" to="/trips/$id" params={{ id: t.id }}>
          {dateIst(t.tripDate)}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (t) => t.customer.name },
    { key: 'truck', header: 'Truck', render: (t) => t.truck.registrationNumber },
    { key: 'driver', header: 'Driver', render: (t) => t.driver.name },
    {
      key: 'route',
      header: 'Route',
      render: (t) => (
        <span className="text-xs text-gray-500">
          {t.startPoint} → {t.endPoint}
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
        <span
          className={
            Number(t.financials.netMarginEffective) >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }
        >
          {money(t.financials.netMarginEffective)}
          {t.financials.isMarginOverridden ? <Badge tone="amber">fixed by hand</Badge> : null}
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
      header: 'Paid?',
      align: 'center',
      render: (t) => (t.paymentDue ? <Badge tone="red">due</Badge> : <Badge tone="green">paid</Badge>),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Trips</h1>
        <div className="flex gap-2">
          <a
            className="hidden min-h-11 items-center rounded-md bg-gray-100 px-3 text-sm font-medium hover:bg-gray-200 active:bg-gray-200 sm:inline-flex md:min-h-9 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-700"
            href={`/api/exports/trips?format=csv${qs(filterParams)}`}
          >
            Export CSV
          </a>
          <a
            className="hidden min-h-11 items-center rounded-md bg-gray-100 px-3 text-sm font-medium hover:bg-gray-200 active:bg-gray-200 sm:inline-flex md:min-h-9 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-700"
            href={`/api/exports/trips?format=xlsx${qs(filterParams)}`}
          >
            Export XLSX
          </a>
          <Link to="/trips/new">
            <Button>+ New trip</Button>
          </Link>
        </div>
      </div>

      {totals ? (
        <div className="flex flex-wrap gap-x-8 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm tabular-nums dark:border-gray-800 dark:bg-gray-900">
          <span className="text-gray-500">{qty(totals.tripCount)} trips</span>
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
            <Link
              to="/trips/$id"
              params={{ id: t.id }}
              className={cx(cardCls, 'block active:bg-gray-50 dark:active:bg-gray-800/60')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{dateIst(t.tripDate)}</span>
                {t.paymentDue ? <Badge tone="red">due</Badge> : <Badge tone="green">paid</Badge>}
              </div>
              <div className="mt-1 text-sm">{t.customer.name}</div>
              <div className="mt-0.5 truncate text-xs text-gray-500">
                {t.truck.registrationNumber} · {t.startPoint} → {t.endPoint}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs tabular-nums dark:border-gray-800">
                <span className="text-gray-500">
                  Sale <b className="text-gray-900 dark:text-gray-100">{money(t.financials.revenue)}</b>
                </span>
                <span
                  className={
                    Number(t.financials.netMarginEffective) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  Profit <b>{money(t.financials.netMarginEffective)}</b>
                </span>
                <span className="text-gray-500">
                  To collect <b className="text-gray-900 dark:text-gray-100">{money(t.financials.amountRemaining)}</b>
                </span>
              </div>
            </Link>
          )}
          toolbar={
            <FilterBar
              searchValue={String(state.q ?? '')}
              onSearch={(v) => patch({ q: v })}
              searchPlaceholder="Customer, truck, driver, places…"
              searchWidth="w-48"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter trips"
            >
              <Field label="Trip date from">
                <Input
                  type="date"
                  value={state.from}
                  onChange={(e) => patch({ from: e.target.value })}
                  className="w-36"
                />
              </Field>
              <Field label="to">
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
