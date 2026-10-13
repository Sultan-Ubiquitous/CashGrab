import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Badge, Button, Card, Field, Input, Select } from '~/components/ui'
import { api, errMessage } from '~/lib/api'
import { todayIso } from '~/lib/format'
import type { CustomerDto, DriverDto, TripDetailDto, TruckDto, PageDto } from '~/shared/schemas'

const COST_FIELDS = [
  ['diesel', 'Diesel'],
  ['adblue', 'AdBlue'],
  ['royalty', 'Royalty'],
  ['tollTaxes', 'Tolls & taxes'],
  ['driverSalary', 'Driver salary'],
  ['miscellaneous', 'Miscellaneous'],
  ['labour', 'Labour'],
] as const

interface FormState {
  customerId: string
  truckId: string
  driverId: string
  tripDate: string
  distance: string
  startPoint: string
  endPoint: string
  source: string
  quantity: string
  costPrice: string
  sellingPrice: string
  sourceOwnership: boolean
  includeBrickCost: boolean
  costs: Record<string, string>
}

function initialForm(trip?: TripDetailDto): FormState {
  return {
    customerId: trip?.customer.id ?? '',
    truckId: trip?.truck.id ?? '',
    driverId: trip?.driver.id ?? '',
    tripDate: trip?.tripDate ?? todayIso(),
    distance: trip?.distance ?? '0',
    startPoint: trip?.startPoint ?? '',
    endPoint: trip?.endPoint ?? '',
    source: trip?.bella.source ?? '',
    quantity: String(trip?.brickQuantity ?? ''),
    costPrice: trip?.brickCostPrice ?? '0',
    sellingPrice: trip?.brickSellingPrice ?? '0',
    sourceOwnership: trip?.brickSourceOwnership ?? false,
    includeBrickCost: trip?.includeBrickCost ?? true,
    costs: Object.fromEntries(COST_FIELDS.map(([k]) => [k, trip ? trip.costs[k] : '0'])),
  }
}

/** Live preview using the same formulas as the backend (display only). */
function preview(f: FormState) {
  const q = Number(f.quantity) || 0
  const revenue = q * (Number(f.sellingPrice) || 0)
  const brickCost = f.includeBrickCost ? q * (Number(f.costPrice) || 0) : 0
  const total = COST_FIELDS.reduce((a, [k]) => a + (Number(f.costs[k]) || 0), 0)
  return { revenue, brickCost, total, margin: revenue - brickCost - total }
}

export function TripForm({ trip, onDone }: { trip?: TripDetailDto; onDone?: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = React.useState<FormState>(() => initialForm(trip))
  const [error, setError] = React.useState('')
  const brickLocked = trip ? !trip.canEditBrickFigures : false
  const brickFiguresDisabled = brickLocked

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setCost = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, costs: { ...f.costs, [k]: e.target.value } }))

  const { data: customers } = useQuery({ queryKey: ['customers', 'options'], queryFn: () => api<PageDto<CustomerDto>>('GET', '/customers?page=1&pageSize=100&sort=name&order=asc') })
  const { data: trucks } = useQuery({ queryKey: ['trucks', 'options'], queryFn: () => api<PageDto<TruckDto>>('GET', '/trucks?page=1&pageSize=100&sort=registrationNumber&order=asc') })
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'options'], queryFn: () => api<PageDto<DriverDto>>('GET', '/drivers?page=1&pageSize=100&sort=name&order=asc') })

  const payload = () => ({
    customerId: form.customerId,
    truckId: form.truckId,
    driverId: form.driverId,
    tripDate: form.tripDate,
    distance: form.distance,
    startPoint: form.startPoint,
    endPoint: form.endPoint,
    includeBrickCost: form.sourceOwnership ? form.includeBrickCost : true,
    bella: brickFiguresDisabled
      ? {}
      : { source: form.source, quantity: Number(form.quantity), costPrice: form.costPrice, sellingPrice: form.sellingPrice, sourceOwnership: form.sourceOwnership },
    costs: Object.fromEntries(COST_FIELDS.map(([k]) => [k, form.costs[k]])),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (trip) {
        return api<TripDetailDto>('PATCH', `/trips/${trip.id}`, payload())
      }
      const created = await api<TripDetailDto>('POST', '/trips', payload())
      return created
    },
    onSuccess: (t) => {
      qc.invalidateQueries()
      if (onDone) onDone()
      else navigate({ to: '/trips/$id', params: { id: t.id } })
    },
    onError: (e) => setError(errMessage(e)),
  })

  const p = preview(form)
  const fmt = (n: number) => `₹${n.toFixed(2)}`

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        save.mutate()
      }}
    >
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <Card title="Trip">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Customer">
            <Select required value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
              <option value="">Select…</option>
              {customers?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Truck">
            <Select required value={form.truckId} onChange={(e) => set('truckId', e.target.value)}>
              <option value="">Select…</option>
              {trucks?.items.map((t) => <option key={t.id} value={t.id}>{t.registrationNumber}</option>)}
            </Select>
          </Field>
          <Field label="Driver">
            <Select required value={form.driverId} onChange={(e) => set('driverId', e.target.value)}>
              <option value="">Select…</option>
              {drivers?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Trip date"><Input required type="date" value={form.tripDate} onChange={(e) => set('tripDate', e.target.value)} /></Field>
          <Field label="Distance (km)"><Input required inputMode="decimal" value={form.distance} onChange={(e) => set('distance', e.target.value)} /></Field>
          <Field label="Start point"><Input required value={form.startPoint} onChange={(e) => set('startPoint', e.target.value)} /></Field>
          <Field label="End point"><Input required value={form.endPoint} onChange={(e) => set('endPoint', e.target.value)} /></Field>
        </div>
      </Card>

      <Card
        title="Bella (brick load)"
        right={brickLocked ? <Badge tone="amber">locked — payments exist</Badge> : null}
      >
        <p className="mb-3 text-xs text-gray-500">
          Each trip carries its own bella record. These figures are copied onto the trip and stay fixed afterwards
          {brickLocked ? ' (they can no longer be edited because payments exist).' : ' — they can only be corrected while the trip has no payments.'}
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2"><Field label="Source"><Input required disabled={brickFiguresDisabled} value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="Kiln / supplier name" /></Field></div>
          <Field label="Quantity"><Input required disabled={brickFiguresDisabled} inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
          <Field label="Cost price / brick (₹)"><Input required disabled={brickFiguresDisabled} inputMode="decimal" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} /></Field>
          <Field label="Selling price / brick (₹)"><Input required disabled={brickFiguresDisabled} inputMode="decimal" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} /></Field>
          <Field label="Source ownership">
            <Select
              disabled={brickFiguresDisabled}
              value={form.sourceOwnership ? 'true' : 'false'}
              onChange={(e) => {
                const own = e.target.value === 'true'
                setForm((f) => ({ ...f, sourceOwnership: own, includeBrickCost: own ? f.includeBrickCost : true }))
              }}
            >
              <option value="false">Third-party</option>
              <option value="true">Own kiln</option>
            </Select>
          </Field>
          {form.sourceOwnership && (
            <Field label="Brick cost in margin" hint="Skip only when bricks are from your own kiln">
              <Select value={form.includeBrickCost ? 'true' : 'false'} onChange={(e) => set('includeBrickCost', e.target.value === 'true')}>
                <option value="true">Include brick cost</option>
                <option value="false">Skip brick cost</option>
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Card title="Trip expenses">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {COST_FIELDS.map(([k, label]) => (
            <Field key={k} label={`${label} (₹)`}>
              <Input required inputMode="decimal" value={form.costs[k]} onChange={setCost(k)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Preview (calculated exactly on the server)">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm tabular-nums">
          <span>Revenue: <b>{fmt(p.revenue)}</b></span>
          <span>Brick cost: <b>{fmt(p.brickCost)}</b></span>
          <span>Trip expenses: <b>{fmt(p.total)}</b></span>
          <span className={p.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>Net margin: <b>{fmt(p.margin)}</b></span>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={save.isPending}>{trip ? 'Save trip' : 'Create trip'}</Button>
      </div>
    </form>
  )
}
