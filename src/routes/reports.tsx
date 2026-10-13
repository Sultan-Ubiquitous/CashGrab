import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '~/components/RequireAuth'
import { MonthlyTable } from '~/routes/index'
import { Badge, Button, Card, Field, Input, Select, Stat } from '~/components/ui'
import { api, qs } from '~/lib/api'
import { dateIst, money, qty } from '~/lib/format'
import type { CustomerDto, DriverDto, MonthlyDto, TruckDto, PageDto, TripTotalsDto } from '~/shared/schemas'

export const Route = createFileRoute('/reports')({
  component: () => (
    <RequireAuth>
      <ReportsPage />
    </RequireAuth>
  ),
})

function useFilters() {
  const [f, setF] = React.useState({ from: '', to: '', customerId: '', truckId: '', driverId: '', paymentDue: '' })
  const patch = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }))
  const params = { ...f, paymentDue: f.paymentDue === '' ? undefined : f.paymentDue }
  return { f, patch, params }
}

function ReportsPage() {
  const { f, patch, params } = useFilters()
  const [module, setModule] = React.useState('trips')

  const { data: totals } = useQuery({
    queryKey: ['reportsTotals', params],
    queryFn: () => api<TripTotalsDto>('GET', `/reports/trips/totals${qs(params)}`),
  })
  const { data: monthly } = useQuery({
    queryKey: ['reportsMonthly', params],
    queryFn: () => api<MonthlyDto>('GET', `/reports/monthly${qs(params)}`),
  })
  const { data: customers } = useQuery({ queryKey: ['customers', 'options'], queryFn: () => api<PageDto<CustomerDto>>('GET', '/customers?page=1&pageSize=100&sort=name&order=asc') })
  const { data: trucks } = useQuery({ queryKey: ['trucks', 'options'], queryFn: () => api<PageDto<TruckDto>>('GET', '/trucks?page=1&pageSize=100&sort=registrationNumber&order=asc') })
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'options'], queryFn: () => api<PageDto<DriverDto>>('GET', '/drivers?page=1&pageSize=100&sort=name&order=asc') })

  const reportQs = qs(params)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Reports & exports</h1>
        <p className="text-xs text-gray-500">Same filters, same formulas as the dashboard — exported files match what you see here.</p>
      </div>

      <Card title="Filters (apply to totals, monthly summary and report exports)">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Trip date from"><Input type="date" value={f.from} onChange={(e) => patch({ from: e.target.value })} className="w-36" /></Field>
          <Field label="to"><Input type="date" value={f.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" /></Field>
          <Field label="Customer">
            <Select value={f.customerId} onChange={(e) => patch({ customerId: e.target.value })} className="w-36">
              <option value="">All</option>
              {customers?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Truck">
            <Select value={f.truckId} onChange={(e) => patch({ truckId: e.target.value })} className="w-32">
              <option value="">All</option>
              {trucks?.items.map((t) => <option key={t.id} value={t.id}>{t.registrationNumber}</option>)}
            </Select>
          </Field>
          <Field label="Driver">
            <Select value={f.driverId} onChange={(e) => patch({ driverId: e.target.value })} className="w-32">
              <option value="">All</option>
              {drivers?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment">
            <Select value={f.paymentDue} onChange={(e) => patch({ paymentDue: e.target.value })} className="w-28">
              <option value="">All</option>
              <option value="true">Due</option>
              <option value="false">Paid</option>
            </Select>
          </Field>
        </div>
      </Card>

      {totals ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Trips" value={qty(totals.tripCount)} />
          <Stat label="Revenue" value={money(totals.revenue)} />
          <Stat label="Total trip expenses" value={money(totals.totalTripCost)} />
          <Stat label="Net margin (calculated)" value={money(totals.netMarginCalculated)} tone={Number(totals.netMarginCalculated) >= 0 ? 'pos' : 'neg'} />
          <Stat
            label="Net margin (effective)"
            value={money(totals.netMarginEffective)}
            sub={totals.overriddenCount ? `${totals.overriddenCount} overridden` : 'no overrides'}
            tone={Number(totals.netMarginEffective) >= 0 ? 'pos' : 'neg'}
          />
          <Stat label="Amount received" value={money(totals.amountReceived)} />
          <Stat label="Outstanding" value={money(totals.outstanding)} sub={`${qty(totals.dueTripCount)} due trips`} />
        </div>
      ) : null}

      <Card
        title="Monthly expense summary"
        right={monthly ? <Badge>{monthly.from ? `${dateIst(monthly.from)} – ${dateIst(monthly.to)}` : 'all months'}</Badge> : null}
      >
        {monthly ? <MonthlyTable months={monthly.months} /> : <p className="text-sm text-gray-500">Loading…</p>}
        {monthly && monthly.months.length > 0 ? (
          <div className="mt-3 flex justify-end text-sm tabular-nums">
            <span className="text-gray-500">Period total: <b>{money(monthly.totals.total)}</b></span>
          </div>
        ) : null}
      </Card>

      <Card title="Exports">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Complete data export (all modules):</span>
            <a href="/api/exports/full?format=csv"><Button variant="subtle">CSV (ZIP)</Button></a>
            <a href="/api/exports/full?format=xlsx"><Button variant="subtle">Excel workbook</Button></a>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Filtered report export (current filters):</span>
            <a href={`/api/exports/report?format=csv${reportQs}`}><Button variant="subtle">CSV (ZIP)</Button></a>
            <a href={`/api/exports/report?format=xlsx${reportQs}`}><Button variant="subtle">Excel workbook</Button></a>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Field label="Single module">
              <Select value={module} onChange={(e) => setModule(e.target.value)} className="w-40">
                <option value="trips">Trips</option>
                <option value="trip-costs">Trip costs</option>
                <option value="trucks">Trucks</option>
                <option value="drivers">Drivers</option>
                <option value="customers">Customers</option>
                <option value="bella">Bella</option>
                <option value="payments">Payments</option>
              </Select>
            </Field>
            <a href={`/api/exports/${module}?format=csv${module === 'trips' || module === 'trip-costs' ? reportQs : ''}`}><Button variant="subtle">Export CSV</Button></a>
            <a href={`/api/exports/${module}?format=xlsx${module === 'trips' || module === 'trip-costs' ? reportQs : ''}`}><Button variant="subtle">Export XLSX</Button></a>
          </div>
          <p className="text-[11px] text-gray-400">
            Exports stream from the database and include ids + foreign keys so datasets stay joinable. Text cells are
            formula-injection safe; amounts are exported as numbers with 2 decimals.
          </p>
        </div>
      </Card>
    </div>
  )
}
