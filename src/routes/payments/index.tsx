import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Button, Card, Field, Input, Modal, TextArea } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateIst, money } from '~/lib/format'
import type { PaymentRowDto, TripDetailDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/payments/')({
  component: () => (
    <RequireAuth>
      <PaymentsPage />
    </RequireAuth>
  ),
})

function PaymentsPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('paidOn', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<PaymentRowDto | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', state],
    queryFn: () => api<PageDto<PaymentRowDto>>('GET', `/payments${qs(state)}`),
  })
  const del = useMutation({
    mutationFn: (id: string) => api<TripDetailDto>('DELETE', `/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['trip'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const columns: Column<PaymentRowDto>[] = [
    { key: 'paidOn', header: 'Paid on', render: (p) => <span className="font-medium">{dateIst(p.paidOn)}</span> },
    {
      key: 'tripDate',
      header: 'Trip',
      render: (p) => (
        <Link to="/trips/$id" params={{ id: p.tripId }} className="text-indigo-600 dark:text-indigo-400">
          {dateIst(p.tripDate)} · {p.customer.name}
        </Link>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => money(p.amount) },
    { key: 'note', header: 'Note', render: (p) => p.note ?? '—' },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(p)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm('Delete this payment?') && del.mutate(p.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Payments</h1>
        <p className="text-xs text-gray-500">Instalments recorded against trips. Amount received per trip is the sum of these.</p>
      </div>
      {del.error ? <div className="text-xs text-red-600">{errMessage(del.error)}</div> : null}
      <Card>
        <DataTable
          columns={columns}
          page={data}
          loading={isLoading}
          error={error}
          state={state}
          onState={patch}
          toolbar={
            <>
              <Field label="Search"><Input placeholder="Note or customer…" value={state.q} onChange={(e) => patch({ q: e.target.value })} className="w-44" /></Field>
              <Field label="Paid from"><Input type="date" value={state.from} onChange={(e) => patch({ from: e.target.value })} className="w-36" /></Field>
              <Field label="to"><Input type="date" value={state.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" /></Field>
            </>
          }
        />
      </Card>
      {editing && <PaymentModal payment={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PaymentModal({ payment, onClose }: { payment: PaymentRowDto; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ amount: payment.amount, paidOn: payment.paidOn, note: payment.note ?? '' })
  const [error, setError] = React.useState('')
  const update = useMutation({
    mutationFn: () => api<TripDetailDto>('PATCH', `/payments/${payment.id}`, { ...form, note: form.note || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['trip'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Modal open title="Edit payment" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); update.mutate() }}>
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        <Field label="Amount (₹)"><Input required inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
        <Field label="Paid on"><Input required type="date" value={form.paidOn} onChange={(e) => setForm((f) => ({ ...f, paidOn: e.target.value }))} /></Field>
        <Field label="Note"><TextArea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={update.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
