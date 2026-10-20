import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, FilterBar, cardCls, useListState, type Column } from '~/components/DataTable'
import { PageHeader } from '~/components/PageHeader'
import { Button, Card, ErrorNote, Field, Input } from '~/components/ui'
import { Dialog } from '~/components/Dialog'
import { api, errMessage, qs } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { dateTimeIst, money } from '~/lib/format'
import { useEntitySave } from '~/lib/useEntitySave'
import type { TruckDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/trucks/')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Trucks · Quick Money' }] }),
  component: TrucksPage,
})

function TrucksPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<TruckDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['trucks', state],
    queryFn: () => api<PageDto<TruckDto>>('GET', `/trucks${qs(state)}`),
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: string) => api('DELETE', `/trucks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trucks'] }),
  })

  const columns: Column<TruckDto>[] = [
    {
      key: 'registrationNumber',
      header: 'Registration',
      sortable: true,
      render: (t) => <span className="font-medium">{t.registrationNumber}</span>,
    },
    { key: 'dieselCost', header: 'Diesel cost', sortable: true, align: 'right', render: (t) => money(t.dieselCost) },
    {
      key: 'distanceTraveled',
      header: 'Distance (km)',
      sortable: true,
      align: 'right',
      render: (t) => money(t.distanceTraveled),
    },
    { key: 'costPerKm', header: '₹ / km', align: 'right', render: (t) => (t.costPerKm ? money(t.costPerKm) : '—') },
    {
      key: 'tripCount',
      header: 'Trips',
      sortable: true,
      align: 'center',
      render: (t) => (
        <Link className="font-mono text-[13px] text-link" to="/trips" search={{ truckId: t.id }}>
          {t.tripCount}
        </Link>
      ),
    },
    { key: 'createdAt', header: 'Added', sortable: true, render: (t) => dateTimeIst(t.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(t)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-neg"
            onClick={() => confirm(`Delete truck ${t.registrationNumber}?`) && del.mutate(t.id)}
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
      <PageHeader title="Trucks" action={<Button onClick={() => setEditing('new')}>Add truck</Button>} />
      {del.error ? <div className="text-xs text-neg">{errMessage(del.error)}</div> : null}
      <Card>
        <DataTable
          columns={columns}
          page={data}
          loading={isLoading}
          error={error}
          state={state}
          onState={patch}
          card={(t) => (
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{t.registrationNumber}</span>
              </div>
              <div className="mt-1 text-xs text-fg-2 tabular-nums">
                Diesel {money(t.dieselCost)} · {money(t.distanceTraveled)} km
                {t.costPerKm ? ` · ${money(t.costPerKm)}/km` : ''}
              </div>
              <Link className="mt-1 block text-xs text-link" to="/trips" search={{ truckId: t.id }}>
                {t.tripCount} trip{t.tripCount === 1 ? '' : 's'}
              </Link>
              <div className="mt-2 flex gap-2 border-t border-line pt-2">
                <Button size="sm" variant="subtle" onClick={() => setEditing(t)} className="flex-1">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-neg"
                  onClick={() => confirm(`Delete truck ${t.registrationNumber}?`) && del.mutate(t.id)}
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
              searchPlaceholder="Registration…"
              activeCount={filterCount}
              onClear={clearFilters}
              resultTotal={data?.total}
              sheetTitle="Filter trucks"
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
      {editing && <TruckModal truck={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TruckModal({ truck, onClose }: { truck: TruckDto | null; onClose: () => void }) {
  const [form, setForm] = React.useState({
    registrationNumber: truck?.registrationNumber ?? '',
  })
  const { error, pending, submit } = useEntitySave({
    create: (f: typeof form) => api('POST', '/trucks', f),
    update: (f: typeof form) => api<TruckDto>('PATCH', `/trucks/${truck!.id}`, f),
    invalidate: [['trucks']],
    onClose,
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Dialog open title={truck ? 'Edit truck' : 'Add truck'} onClose={onClose}>
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(truck ? 'update' : 'create', form)
        }}
      >
        {error ? <ErrorNote error={error} className="sm:col-span-2" /> : null}
        <div className="sm:col-span-2">
          <Field label="Registration number" hint="Unique per user">
            <Input required value={form.registrationNumber} onChange={set('registrationNumber')} />
          </Field>
        </div>
        {truck ? (
          <p className="text-xs text-fg-2 sm:col-span-2">
            Diesel cost, distance and ₹/km come from this truck's trips.
          </p>
        ) : null}
        <div className="flex gap-2 pt-2 sm:col-span-2 sm:justify-end">
          <Button type="button" variant="subtle" onClick={onClose} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {truck ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
