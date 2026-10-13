import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Badge, Button, Card, Field, Input, Modal } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateTimeIst, money } from '~/lib/format'
import type { TruckDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/trucks/')({
  component: () => (
    <RequireAuth>
      <TrucksPage />
    </RequireAuth>
  ),
})

function TrucksPage() {
  const qc = useQueryClient()
  const [state, patch] = useListState('createdAt', { q: '', from: '', to: '' })
  const [editing, setEditing] = React.useState<TruckDto | 'new' | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['trucks', state],
    queryFn: () => api<PageDto<TruckDto>>('GET', `/trucks${qs(state)}`),
  })

  const del = useMutation({
    mutationFn: (id: string) => api('DELETE', `/trucks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trucks'] }),
  })

  const columns: Column<TruckDto>[] = [
    { key: 'registrationNumber', header: 'Registration', sortable: false, render: (t) => <span className="font-medium">{t.registrationNumber}</span> },
    { key: 'dieselCost', header: 'Diesel cost', align: 'right', render: (t) => money(t.dieselCost) },
    { key: 'dieselLiters', header: 'Diesel (L)', align: 'right', render: (t) => money(t.dieselLiters) },
    { key: 'distanceTraveled', header: 'Distance (km)', align: 'right', render: (t) => money(t.distanceTraveled) },
    { key: 'mileageKmPerLiter', header: 'Mileage (km/L)', align: 'right', render: (t) => (t.mileageKmPerLiter ? <Badge tone="indigo">{t.mileageKmPerLiter}</Badge> : '—') },
    { key: 'costPerKm', header: '₹ / km', align: 'right', render: (t) => (t.costPerKm ? money(t.costPerKm) : '—') },
    { key: 'tripCount', header: 'Trips', align: 'center', render: (t) => <Link className="text-indigo-600 dark:text-indigo-400" to="/trips" search={{ truckId: t.id }}>{t.tripCount}</Link> },
    { key: 'createdAt', header: 'Added', render: (t) => dateTimeIst(t.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="subtle" onClick={() => setEditing(t)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm(`Delete truck ${t.registrationNumber}?`) && del.mutate(t.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Trucks</h1>
        <Button onClick={() => setEditing('new')}>+ Add truck</Button>
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
                <Input placeholder="Registration…" value={state.q} onChange={(e) => patch({ q: e.target.value })} className="w-40" />
              </Field>
              <Field label="Added from">
                <Input type="date" value={state.from} onChange={(e) => patch({ from: e.target.value })} className="w-36" />
              </Field>
              <Field label="to">
                <Input type="date" value={state.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" />
              </Field>
            </>
          }
        />
      </Card>
      {editing && <TruckModal truck={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TruckModal({ truck, onClose }: { truck: TruckDto | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({
    registrationNumber: truck?.registrationNumber ?? '',
    dieselCost: truck?.dieselCost ?? '0',
    dieselLiters: truck?.dieselLiters ?? '0',
    distanceTraveled: truck?.distanceTraveled ?? '0',
  })
  const [error, setError] = React.useState('')
  const save = useMutation({
    mutationFn: () => api('POST', '/trucks', form) as unknown as Promise<TruckDto>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trucks'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  const update = useMutation({
    mutationFn: () => api<TruckDto>('PATCH', `/trucks/${truck!.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trucks'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal open title={truck ? 'Edit truck' : 'Add truck'} onClose={onClose}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          truck ? update.mutate() : save.mutate()
        }}
      >
        {error ? <div className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        <div className="col-span-2"><Field label="Registration number" hint="Unique per user, e.g. MH 12 AB 1234"><Input required value={form.registrationNumber} onChange={set('registrationNumber')} /></Field></div>
        <Field label="Diesel cost (₹)"><Input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={form.dieselCost} onChange={set('dieselCost')} /></Field>
        <Field label="Diesel (litres)"><Input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={form.dieselLiters} onChange={set('dieselLiters')} /></Field>
        <Field label="Distance travelled (km)" hint={`Mileage & ₹/km are derived: ${Number(form.distanceTraveled) > 0 ? '' : 'enter distance to compute'}`}>
          <Input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={form.distanceTraveled} onChange={set('distanceTraveled')} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending || update.isPending}>{truck ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
