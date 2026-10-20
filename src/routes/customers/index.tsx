import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, FilterBar, cardCls, useListState, type Column } from '~/components/DataTable'
import { PageHeader } from '~/components/PageHeader'
import { Button, Card, ErrorNote, Field, Input } from '~/components/ui'
import { Dialog } from '~/components/Dialog'
import { api, errMessage, qs } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { dateTimeIst } from '~/lib/format'
import { useEntitySave } from '~/lib/useEntitySave'
import type { CustomerDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/customers/')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Customers · Quick Money' }] }),
  component: CustomersPage,
})

function CustomersPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<CustomerDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', state],
    queryFn: () => api<PageDto<CustomerDto>>('GET', `/customers${qs(state)}`),
    placeholderData: keepPreviousData,
  })
  const del = useMutation({
    mutationFn: (id: string) => api('DELETE', `/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })

  const columns: Column<CustomerDto>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
    { key: 'location', header: 'Location' },
    {
      key: 'tripCount',
      header: 'Trips',
      sortable: true,
      align: 'center',
      render: (c) => (
        <Link className="text-link" to="/trips" search={{ customerId: c.id }}>
          {c.tripCount}
        </Link>
      ),
    },
    { key: 'createdAt', header: 'Added', sortable: true, render: (c) => dateTimeIst(c.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(c)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-neg"
            onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}
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
      <PageHeader title="Customers" action={<Button onClick={() => setEditing('new')}>Add customer</Button>} />
      {del.error ? <div className="text-xs text-neg">{errMessage(del.error)}</div> : null}
      <Card>
        <DataTable
          columns={columns}
          page={data}
          loading={isLoading}
          error={error}
          state={state}
          onState={patch}
          card={(c) => (
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{c.name}</span>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="font-mono text-sm text-link">
                    {c.phone}
                  </a>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-fg-2">{c.location}</div>
              <Link className="mt-1 block text-xs text-link" to="/trips" search={{ customerId: c.id }}>
                {c.tripCount} trip{c.tripCount === 1 ? '' : 's'}
              </Link>
              <div className="mt-2 flex gap-2 border-t border-line pt-2">
                <Button size="sm" variant="subtle" onClick={() => setEditing(c)} className="flex-1">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-neg"
                  onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}
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
              searchPlaceholder="Name, phone, location…"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter customers"
            >
              <Field label="Added from">
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
      {editing && <CustomerModal customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CustomerModal({ customer, onClose }: { customer: CustomerDto | null; onClose: () => void }) {
  const [form, setForm] = React.useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    location: customer?.location ?? '',
  })
  const { error, pending, submit } = useEntitySave({
    create: (f: typeof form) => api('POST', '/customers', { ...f, phone: f.phone || null }),
    update: (f: typeof form) =>
      api<CustomerDto>('PATCH', `/customers/${customer!.id}`, { ...f, phone: f.phone || null }),
    invalidate: [['customers']],
    onClose,
  })
  return (
    <Dialog open title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(customer ? 'update' : 'create', form)
        }}
      >
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Name">
          <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Phone (optional)">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91…"
          />
        </Field>
        <Field label="Location">
          <Input
            required
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {customer ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
