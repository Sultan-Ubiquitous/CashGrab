import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { Badge, Button, Card, ErrorNote, Field, Input, Skeleton, Stat, TextArea } from '~/components/ui'
import { Dialog } from '~/components/Dialog'
import { ListRow } from '~/components/ListRow'
import { PageHeader } from '~/components/PageHeader'
import { ArrowLeftIcon, PlusIcon } from '~/components/icons'
import { api, errMessage } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { dateIst, dateTimeIst, money, qty, todayIso } from '~/lib/format'
import type { TripDetailDto } from '~/shared/schemas'

export const Route = createFileRoute('/trips/$id/')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Trip · Quick Money' }] }),
  component: TripDetailPage,
})

function TripDetailPage() {
  const { id } = useParams({ from: '/trips/$id/' })
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [addingPayment, setAddingPayment] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api<TripDetailDto>('GET', `/trips/${id}`),
  })

  const del = useMutation({
    mutationFn: () => api('DELETE', `/trips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries()
      navigate({ to: '/trips' })
    },
  })

  if (isLoading) return <TripDetailSkeleton />
  if (error || !trip) return <p className="text-sm text-neg">{errMessage(error ?? new Error('Trip not found'))}</p>

  const f = trip.financials
  const profit = Number(f.netMarginEffective)
  return (
    <div className="space-y-5">
      <Link to="/trips" className="inline-flex items-center gap-1 text-xs text-fg-2">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Trips
      </Link>

      <PageHeader
        title={`Trip · ${dateIst(trip.tripDate)}`}
        description={`${trip.customer.name} · ${trip.truck.registrationNumber} · ${trip.driver.name} · ${trip.startPoint} to ${trip.endPoint} (${qty(Number(trip.distance))} km)`}
        action={
          <div className="flex gap-2">
            <Link to="/trips/$id/edit" params={{ id }}>
              <Button variant="subtle">Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </div>
        }
      />
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-2">
        {trip.paymentDue ? <Badge tone="red">Money to collect</Badge> : <Badge tone="green">Paid</Badge>}
        <span>Created {dateTimeIst(trip.createdAt)}</span>
      </div>
      {del.error ? <ErrorNote error={del.error} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue" value={money(f.revenue)} sub={`${qty(trip.brickQuantity)} bricks`} />
        <Stat
          label="Trip expenses"
          value={money(f.totalTripCost)}
          sub={trip.includeBrickCost ? `Bricks ${money(f.brickCost)} counted` : 'Bricks not counted'}
        />
        <Stat
          label="Profit"
          value={money(f.netMarginEffective)}
          sub={f.isMarginOverridden ? `Adjusted (worked out ${money(f.netMarginCalculated)})` : 'Worked out'}
          tone={profit >= 0 ? 'pos' : 'neg'}
        />
        <Stat label="Left to collect" value={money(f.amountRemaining)} sub={`Received ${money(f.amountReceived)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Trip expenses" right={<Badge>{money(f.totalTripCost)}</Badge>}>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Diesel', trip.costs.diesel],
              ['AdBlue', trip.costs.adblue],
              ['Royalty', trip.costs.royalty],
              ['Tolls & taxes', trip.costs.tollTaxes],
              ['Driver salary', trip.costs.driverSalary],
              ['Miscellaneous', trip.costs.miscellaneous],
              ['Labour', trip.costs.labour],
            ].map(([label, v]) => (
              <div key={label} className="flex justify-between border-b border-dashed border-line pb-1">
                <dt className="text-fg-2">{label}</dt>
                <dd className="tabular-nums">{money(v as string)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(f.totalTripCost)}</dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Bricks"
          right={trip.bella.sourceOwnership ? <Badge tone="green">Own kiln</Badge> : <Badge>Bought in</Badge>}
        >
          <dl className="space-y-1.5 text-sm">
            {[
              ['Source', trip.bella.source],
              ['Quantity', qty(trip.bella.quantity)],
              ['Cost price per brick', `₹${trip.bella.costPrice}`],
              ['Selling price per brick', `₹${trip.bella.sellingPrice}`],
            ].map(([label, v]) => (
              <div key={label} className="flex justify-between border-b border-dashed border-line pb-1">
                <dt className="text-fg-2">{label}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-fg-muted">Quantity and prices are locked once payments exist.</p>
        </Card>
      </div>

      <Card
        title="Payments"
        right={
          <Button size="sm" onClick={() => setAddingPayment(true)}>
            <PlusIcon className="h-4 w-4" />
            Add money
          </Button>
        }
      >
        {trip.payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">No payments yet. The full amount is outstanding.</p>
        ) : (
          <ul className="-my-3 divide-y divide-line">
            {trip.payments.map((p) => (
              <li key={p.id}>
                <ListRow>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums">{dateIst(p.paidOn)}</div>
                    {p.note ? <div className="truncate text-xs text-fg-2">{p.note}</div> : null}
                  </div>
                  <div className="text-sm font-semibold tabular-nums md:text-right">{money(p.amount)}</div>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3 text-xs">
          <Link to="/payments" className="font-medium text-link">
            Manage all payments
          </Link>
        </div>
      </Card>

      <MarginOverrideCard
        tripId={trip.id}
        calculated={f.netMarginCalculated}
        override={f.netMarginOverride}
        effective={f.netMarginEffective}
      />

      {addingPayment && (
        <AddPaymentModal tripId={trip.id} remaining={f.amountRemaining} onClose={() => setAddingPayment(false)} />
      )}

      <Dialog
        open={confirmingDelete}
        title="Delete this trip?"
        onClose={() => setConfirmingDelete(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? 'Deleting…' : 'Delete trip'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-fg-2">
          This also removes its bricks record, expenses and payments. This cannot be undone.
        </p>
      </Dialog>
    </div>
  )
}

function MarginOverrideCard({
  tripId,
  calculated,
  override,
  effective,
}: {
  tripId: string
  calculated: string
  override: string | null
  effective: string
}) {
  const qc = useQueryClient()
  const [value, setValue] = React.useState(override ?? '')
  const [error, setError] = React.useState('')
  // The override travels as a mutation variable so it never reads a stale closure value.
  const save = useMutation({
    mutationFn: (next: string | null) =>
      api<TripDetailDto>('PUT', `/trips/${tripId}/margin-override`, { netMarginOverride: next }),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['trip', tripId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['trips'] })
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Card title="Adjust profit">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Your profit (₹). Worked out: ${money(calculated)}. Final: ${money(effective)}`}>
          <Input
            inputMode="decimal"
            placeholder={calculated}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full sm:w-40"
          />
        </Field>
        <Button onClick={() => save.mutate(value.trim() === '' ? null : value.trim())} disabled={save.isPending}>
          Save
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            setValue('')
            save.mutate(null)
          }}
          disabled={save.isPending || override === null}
        >
          Use worked-out profit
        </Button>
      </div>
      <div className="mt-3">
        {override !== null ? (
          <Badge tone="amber">Adjusted to {money(override)}</Badge>
        ) : (
          <Badge>Using worked-out profit</Badge>
        )}
      </div>
      {error ? <div className="mt-2 text-xs text-neg">{error}</div> : null}
      <p className="mt-2 text-[11px] text-fg-muted">
        An adjustment stays even when other numbers change. Reports and downloads use the final profit.
      </p>
    </Card>
  )
}

function AddPaymentModal({ tripId, remaining, onClose }: { tripId: string; remaining: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ amount: remaining, paidOn: todayIso(), note: '' })
  const [error, setError] = React.useState('')
  const save = useMutation({
    mutationFn: () => api<TripDetailDto>('POST', `/trips/${tripId}/payments`, { ...form, note: form.note || null }),
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Dialog open title={`Add money received (${money(remaining)} left)`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Amount (₹)" hint={`Cannot be more than ${money(remaining)}`}>
          <Input
            required
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </Field>
        <Field label="Paid on">
          <Input
            required
            type="date"
            value={form.paidOn}
            onChange={(e) => setForm((f) => ({ ...f, paidOn: e.target.value }))}
          />
        </Field>
        <Field label="Note (optional)">
          <TextArea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Add money
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function TripDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading trip">
      <Skeleton className="h-3 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}
