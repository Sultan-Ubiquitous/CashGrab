import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { Badge, Button, Card, Field, Input, Modal, Stat, TextArea } from '~/components/ui'
import { RequireAuth } from '~/components/RequireAuth'
import { TripForm } from '~/components/TripForm'
import { api, errMessage } from '~/lib/api'
import { dateIst, dateTimeIst, money, qty, todayIso } from '~/lib/format'
import type { TripDetailDto } from '~/shared/schemas'

export const Route = createFileRoute('/trips/$id')({
  component: () => (
    <RequireAuth>
      <TripDetailPage />
    </RequireAuth>
  ),
})

function TripDetailPage() {
  const { id } = useParams({ from: '/trips/$id' })
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = React.useState(false)
  const [addingPayment, setAddingPayment] = React.useState(false)

  const { data: trip, isLoading, error } = useQuery({
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

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error || !trip) return <p className="text-sm text-red-600">{errMessage(error ?? new Error('Trip not found'))}</p>

  const f = trip.financials
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/trips" className="text-xs text-gray-500">← All trips</Link>
          <h1 className="text-xl font-bold">
            Trip · {dateIst(trip.tripDate)} {trip.paymentDue ? <Badge tone="red">payment due</Badge> : <Badge tone="green">paid</Badge>}
          </h1>
          <p className="text-xs text-gray-500">
            {trip.customer.name} · {trip.truck.registrationNumber} · {trip.driver.name} · {trip.startPoint} → {trip.endPoint} ({qty(Number(trip.distance))} km)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit trip'}</Button>
          <Button variant="danger" onClick={() => confirm('Delete this trip with its bella record, costs and payments?') && del.mutate()}>Delete trip</Button>
        </div>
      </div>
      {del.error ? <div className="text-xs text-red-600">{errMessage(del.error)}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue" value={money(f.revenue)} sub={`${qty(trip.brickQuantity)} bricks × ₹${trip.brickSellingPrice}`} />
        <Stat label="Brick cost" value={money(f.brickCost)} sub={trip.includeBrickCost ? `included (${qty(trip.brickQuantity)} × ₹${trip.brickCostPrice})` : 'skipped (own kiln)'} />
        <Stat label="Trip expenses" value={money(f.totalTripCost)} />
        <Stat
          label="Net margin (calculated)"
          value={money(f.netMarginCalculated)}
          sub={f.isMarginOverridden ? `overridden manually with ${money(f.netMarginOverride)}` : 'no manual override'}
          tone={Number(f.netMarginCalculated) >= 0 ? 'pos' : 'neg'}
        />
        <Stat label="Net margin (effective)" value={money(f.netMarginEffective)} sub="used everywhere" tone={Number(f.netMarginEffective) >= 0 ? 'pos' : 'neg'} />
        <Stat label="Amount received" value={money(f.amountReceived)} sub={`${trip.payments.length} payment(s)`} />
        <Stat label="Amount remaining" value={money(f.amountRemaining)} />
        <Stat label="Created" value={dateTimeIst(trip.createdAt).split(',')[0]} sub={dateTimeIst(trip.createdAt)} />
      </div>

      {editing && (
        <Card title="Edit trip">
          <TripForm trip={trip} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['trip', id] }) }} />
        </Card>
      )}

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
              <div key={label} className="flex justify-between border-b border-dashed border-gray-100 pb-1 dark:border-gray-800">
                <dt className="text-gray-500">{label}</dt>
                <dd className="tabular-nums">{money(v as string)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(f.totalTripCost)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Bella (brick record)" right={trip.bella.sourceOwnership ? <Badge tone="green">own kiln</Badge> : <Badge>third-party</Badge>}>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Source', trip.bella.source],
              ['Quantity', qty(trip.bella.quantity)],
              ['Cost price / brick', `₹${trip.bella.costPrice}`],
              ['Selling price / brick', `₹${trip.bella.sellingPrice}`],
            ].map(([label, v]) => (
              <div key={label} className="flex justify-between border-b border-dashed border-gray-100 pb-1 dark:border-gray-800">
                <dt className="text-gray-500">{label}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-gray-400">
            Quantity and prices are locked to what the trip was created with; they can only be corrected while no payments exist.
          </p>
        </Card>
      </div>

      <MarginOverrideCard tripId={trip.id} calculated={f.netMarginCalculated} override={f.netMarginOverride} effective={f.netMarginEffective} />

      <Card
        title="Payments"
        right={<Button size="sm" onClick={() => setAddingPayment(true)}>+ Add payment</Button>}
      >
        {trip.payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No payments recorded yet — the full revenue is outstanding.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Paid on</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {trip.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{dateIst(p.paidOn)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(p.amount)}</td>
                    <td className="px-3 py-2">{p.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Link className="text-xs text-indigo-600 dark:text-indigo-400" to="/payments">manage in Payments →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {addingPayment && <AddPaymentModal tripId={trip.id} remaining={f.amountRemaining} onClose={() => setAddingPayment(false)} />}
    </div>
  )
}

function MarginOverrideCard({ tripId, calculated, override, effective }: { tripId: string; calculated: string; override: string | null; effective: string }) {
  const qc = useQueryClient()
  const [value, setValue] = React.useState(override ?? '')
  const [error, setError] = React.useState('')
  const save = useMutation({
    mutationFn: () => api<TripDetailDto>('PUT', `/trips/${tripId}/margin-override`, { netMarginOverride: value === '' ? null : value }),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['trip', tripId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['trips'] })
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Card title="Net margin override">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={`Manual margin (₹) — calculated is ${money(calculated)}, effective is ${money(effective)}`}>
          <Input inputMode="decimal" placeholder={calculated} value={value} onChange={(e) => setValue(e.target.value)} className="w-40" />
        </Field>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save override</Button>
        <Button variant="subtle" onClick={() => { setValue(''); save.mutate() }} disabled={save.isPending || override === null}>Clear override</Button>
        {override !== null ? <Badge tone="amber">currently overridden: {money(override)}</Badge> : <Badge>using calculated value</Badge>}
      </div>
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
      <p className="mt-2 text-[11px] text-gray-400">
        The override survives every recalculation. Dashboards, reports and exports use the effective value.
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
    <Modal open title={`Add payment (remaining ${money(remaining)})`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        <Field label="Amount (₹)" hint={`Cannot exceed ${money(remaining)}`}>
          <Input required inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </Field>
        <Field label="Paid on"><Input required type="date" value={form.paidOn} onChange={(e) => setForm((f) => ({ ...f, paidOn: e.target.value }))} /></Field>
        <Field label="Note (optional)"><TextArea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Add payment</Button>
        </div>
      </form>
    </Modal>
  )
}
