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
import type { DriverDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/drivers/')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Drivers · Quick Money' }] }),
  component: DriversPage,
})

function DriversPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<DriverDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['drivers', state],
    queryFn: () => api<PageDto<DriverDto>>('GET', `/drivers${qs(state)}`),
    placeholderData: keepPreviousData,
  })
  const del = useMutation({
    mutationFn: (id: string) => api('DELETE', `/drivers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })

  const columns: Column<DriverDto>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (d) => <span className="font-medium">{d.name}</span> },
    { key: 'phone', header: 'Phone' },
    {
      key: 'tripCount',
      header: 'Trips',
      sortable: true,
      align: 'center',
      render: (d) => (
        <Link className="text-link" to="/trips" search={{ driverId: d.id }}>
          {d.tripCount}
        </Link>
      ),
    },
    { key: 'createdAt', header: 'Added', sortable: true, render: (d) => dateTimeIst(d.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(d)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-neg"
            onClick={() => confirm(`Delete ${d.name}?`) && del.mutate(d.id)}
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
      <PageHeader title="Drivers" action={<Button onClick={() => setEditing('new')}>Add driver</Button>} />
      {del.error ? <div className="text-xs text-neg">{errMessage(del.error)}</div> : null}
      <Card>
        <DataTable
          columns={columns}
          page={data}
          loading={isLoading}
          error={error}
          state={state}
          onState={patch}
          card={(d) => (
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{d.name}</span>
                <a href={`tel:${d.phone}`} className="font-mono text-sm text-link">
                  {d.phone}
                </a>
              </div>
              <Link className="mt-1 block text-xs text-link" to="/trips" search={{ driverId: d.id }}>
                {d.tripCount} trip{d.tripCount === 1 ? '' : 's'}
              </Link>
              <div className="mt-2 flex gap-2 border-t border-line pt-2">
                <Button size="sm" variant="subtle" onClick={() => setEditing(d)} className="flex-1">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-neg"
                  onClick={() => confirm(`Delete ${d.name}?`) && del.mutate(d.id)}
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
              searchPlaceholder="Name or phone…"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter drivers"
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
      {editing && <DriverModal driver={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DriverModal({ driver, onClose }: { driver: DriverDto | null; onClose: () => void }) {
  const [form, setForm] = React.useState({ name: driver?.name ?? '', phone: driver?.phone ?? '' })
  const { error, pending, submit } = useEntitySave({
    create: (f: typeof form) => api('POST', '/drivers', f),
    update: (f: typeof form) => api<DriverDto>('PATCH', `/drivers/${driver!.id}`, f),
    invalidate: [['drivers']],
    onClose,
  })
  return (
    <Dialog open title={driver ? 'Edit driver' : 'Add driver'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(driver ? 'update' : 'create', form)
        }}
      >
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Name">
          <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91…"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {driver ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
