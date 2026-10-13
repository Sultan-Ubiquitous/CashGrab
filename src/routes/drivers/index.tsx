import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Button, Card, Field, Input, Modal } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateTimeIst } from '~/lib/format'
import type { DriverDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/drivers/')({
  component: () => (
    <RequireAuth>
      <DriversPage />
    </RequireAuth>
  ),
})

function DriversPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<DriverDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['drivers', state],
    queryFn: () => api<PageDto<DriverDto>>('GET', `/drivers${qs(state)}`),
  })
  const del = useMutation({
    mutationFn: (id: string) => api('DELETE', `/drivers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })

  const columns: Column<DriverDto>[] = [
    { key: 'name', header: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
    { key: 'phone', header: 'Phone' },
    { key: 'tripCount', header: 'Trips', align: 'center', render: (d) => <Link className="text-indigo-600 dark:text-indigo-400" to="/trips" search={{ driverId: d.id }}>{d.tripCount}</Link> },
    { key: 'createdAt', header: 'Added', render: (d) => dateTimeIst(d.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(d)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm(`Delete ${d.name}?`) && del.mutate(d.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Drivers</h1>
        <Button onClick={() => setEditing('new')}>+ Add driver</Button>
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
              <Field label="Search"><Input placeholder="Name or phone…" value={state.q} onChange={(e) => patch({ q: e.target.value })} className="w-44" /></Field>
              <Field label="Added from"><Input type="date" value={state.from} onChange={(e) => patch({ from: e.target.value })} className="w-36" /></Field>
              <Field label="to"><Input type="date" value={state.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" /></Field>
            </>
          }
        />
      </Card>
      {editing && <DriverModal driver={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DriverModal({ driver, onClose }: { driver: DriverDto | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ name: driver?.name ?? '', phone: driver?.phone ?? '' })
  const [error, setError] = React.useState('')
  const save = useMutation({
    mutationFn: () => api('POST', '/drivers', form) as unknown as Promise<DriverDto>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  const update = useMutation({
    mutationFn: () => api<DriverDto>('PATCH', `/drivers/${driver!.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Modal open title={driver ? 'Edit driver' : 'Add driver'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); driver ? update.mutate() : save.mutate() }}>
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        <Field label="Name"><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Phone"><Input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91…" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending || update.isPending}>{driver ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
