import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Button, Card, ErrorNote, Field, Input, Modal } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateTimeIst } from '~/lib/format'
import { useEntitySave } from '~/lib/useEntitySave'
import type { CustomerDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/customers/')({
  component: () => (
    <RequireAuth>
      <CustomersPage />
    </RequireAuth>
  ),
})

function CustomersPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<CustomerDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', state],
    queryFn: () => api<PageDto<CustomerDto>>('GET', `/customers${qs(state)}`),
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
        <Link className="text-indigo-600 dark:text-indigo-400" to="/trips" search={{ customerId: c.id }}>
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
            className="text-red-600"
            onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Customers</h1>
        <Button onClick={() => setEditing('new')}>+ Add customer</Button>
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
              <Field label="Search">
                <Input
                  placeholder="Name, phone, location…"
                  value={state.q}
                  onChange={(e) => patch({ q: e.target.value })}
                  className="w-52"
                />
              </Field>
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
            </>
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
    <Modal open title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose}>
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
    </Modal>
  )
}
