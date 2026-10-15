import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, FilterBar, cardCls, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Button, Card, ErrorNote, Field, Input, Modal, TextArea } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateIst, money } from '~/lib/format'
import { useEntitySave } from '~/lib/useEntitySave'
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
    {
      key: 'paidOn',
      header: 'Paid on',
      sortable: true,
      render: (p) => <span className="font-medium">{dateIst(p.paidOn)}</span>,
    },
    {
      key: 'tripDate',
      header: 'Trip',
      render: (p) => (
        <Link to="/trips/$id" params={{ id: p.tripId }} className="text-indigo-600 dark:text-indigo-400">
          {dateIst(p.tripDate)} · {p.customer.name}
        </Link>
      ),
    },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (p) => money(p.amount) },
    { key: 'note', header: 'Note', render: (p) => p.note ?? '—' },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(p)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => confirm('Delete this payment?') && del.mutate(p.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const filterCount = [state.from, state.to].filter((v) => v !== '' && v !== undefined).length
  const clearFilters = () => patch({ from: '', to: '' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Money in</h1>
        <p className="text-xs text-gray-500">
          Money received for trips. Each trip's received money is the total of these lines.
        </p>
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
          card={(p) => (
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{dateIst(p.paidOn)}</span>
                <span className="text-sm font-semibold tabular-nums">{money(p.amount)}</span>
              </div>
              <Link
                to="/trips/$id"
                params={{ id: p.tripId }}
                className="mt-0.5 block text-sm text-indigo-600 dark:text-indigo-400"
              >
                {dateIst(p.tripDate)} · {p.customer.name}
              </Link>
              {p.note ? <div className="mt-0.5 truncate text-xs text-gray-500">{p.note}</div> : null}
              <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                <Button size="sm" variant="subtle" onClick={() => setEditing(p)} className="flex-1">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-red-600"
                  onClick={() => confirm('Delete this payment?') && del.mutate(p.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
          toolbar={
            <FilterBar
              searchValue={String(state.q ?? '')}
              onSearch={(v) => patch({ q: v })}
              searchPlaceholder="Note or customer…"
              searchWidth="w-44"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter payments"
            >
              <Field label="Paid from">
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
            </FilterBar>
          }
        />
      </Card>
      {editing && <PaymentModal payment={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PaymentModal({ payment, onClose }: { payment: PaymentRowDto; onClose: () => void }) {
  const [form, setForm] = React.useState({ amount: payment.amount, paidOn: payment.paidOn, note: payment.note ?? '' })
  const { error, pending, update } = useEntitySave({
    update: (f: typeof form) => api<TripDetailDto>('PATCH', `/payments/${payment.id}`, { ...f, note: f.note || null }),
    invalidate: [['payments'], ['trip'], ['dashboard']],
    onClose,
  })
  return (
    <Modal open title="Edit payment" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          update(form)
        }}
      >
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Amount (₹)">
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
        <Field label="Note">
          <TextArea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
