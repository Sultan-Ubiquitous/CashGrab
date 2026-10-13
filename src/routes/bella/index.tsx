import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { DataTable, useListState, type Column } from '~/components/DataTable'
import { RequireAuth } from '~/components/RequireAuth'
import { Badge, Button, Card, Field, Input, Modal, Select } from '~/components/ui'
import { api, errMessage, qs } from '~/lib/api'
import { dateIst, money, qty } from '~/lib/format'
import type { BellaDto, PageDto } from '~/shared/schemas'

export const Route = createFileRoute('/bella/')({
  component: () => (
    <RequireAuth>
      <BellaPage />
    </RequireAuth>
  ),
})

function BellaPage() {
  const [state, patch] = useListState('tripDate', { q: '', from: '', to: '', sourceOwnership: '' })
  const [editing, setEditing] = React.useState<BellaDto | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['bella', state],
    queryFn: () => api<PageDto<BellaDto>>('GET', `/bella${qs(state)}`),
  })

  const columns: Column<BellaDto>[] = [
    {
      key: 'tripDate',
      header: 'Trip date',
      render: (b) => (b.tripId ? <Link to="/trips/$id" params={{ id: b.tripId }} className="text-indigo-600 dark:text-indigo-400">{dateIst(b.tripDate)}</Link> : '—'),
    },
    { key: 'source', header: 'Source', render: (b) => <span className="font-medium">{b.source}</span> },
    { key: 'quantity', header: 'Quantity', align: 'right', render: (b) => qty(b.quantity) },
    { key: 'costPrice', header: 'Cost / brick', align: 'right', render: (b) => money(b.costPrice) },
    { key: 'sellingPrice', header: 'Selling / brick', align: 'right', render: (b) => money(b.sellingPrice) },
    {
      key: 'sourceOwnership',
      header: 'Source',
      align: 'center',
      render: (b) => (b.sourceOwnership ? <Badge tone="green">own kiln</Badge> : <Badge>third-party</Badge>),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => <div className="flex justify-end"><Button size="sm" variant="subtle" onClick={() => setEditing(b)}>Edit source</Button></div>,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Bella (bricks)</h1>
        <p className="text-xs text-gray-500">
          One record per trip. Quantity and prices are part of the trip; only the source details are edited here.
        </p>
      </div>
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
              <Field label="Search"><Input placeholder="Source…" value={state.q} onChange={(e) => patch({ q: e.target.value })} className="w-40" /></Field>
              <Field label="Trip date from"><Input type="date" value={state.from} onChange={(e) => patch({ from: e.target.value })} className="w-36" /></Field>
              <Field label="to"><Input type="date" value={state.to} onChange={(e) => patch({ to: e.target.value })} className="w-36" /></Field>
              <Field label="Ownership">
                <Select value={state.sourceOwnership} onChange={(e) => patch({ sourceOwnership: e.target.value })} className="w-36">
                  <option value="">All</option>
                  <option value="true">Own kiln</option>
                  <option value="false">Third-party</option>
                </Select>
              </Field>
            </>
          }
        />
      </Card>
      {editing && <BellaModal bella={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BellaModal({ bella, onClose }: { bella: BellaDto; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ source: bella.source, sourceOwnership: bella.sourceOwnership })
  const [error, setError] = React.useState('')
  const update = useMutation({
    mutationFn: () => api<BellaDto>('PATCH', `/bella/${bella.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bella'] })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  return (
    <Modal open title="Edit bella source" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); update.mutate() }}>
        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        <p className="text-xs text-gray-500">
          Quantity and prices live on the trip and stay locked here. Source details never affect the net margin.
        </p>
        <Field label="Source"><Input required value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} /></Field>
        <Field label="Ownership">
          <Select value={form.sourceOwnership ? 'true' : 'false'} onChange={(e) => setForm((f) => ({ ...f, sourceOwnership: e.target.value === 'true' }))}>
            <option value="false">Third-party</option>
            <option value="true">Own kiln</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={update.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
