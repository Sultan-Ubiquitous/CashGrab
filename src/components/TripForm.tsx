import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Field, Input, Modal, Select } from '~/components/ui'
import { api, errMessage } from '~/lib/api'
import { todayIso } from '~/lib/format'
import type { CustomerDto, DriverDto, TripDetailDto, TruckDto, PageDto } from '~/shared/schemas'

const COST_FIELDS = [
  ['diesel', 'Diesel'],
  ['adblue', 'AdBlue'],
  ['royalty', 'Royalty'],
  ['tollTaxes', 'Tolls & taxes'],
  ['driverSalary', 'Driver salary'],
  ['miscellaneous', 'Other'],
  ['labour', 'Labour'],
] as const

interface NewCustomer {
  name: string
  phone: string
  location: string
}
interface NewTruck {
  registrationNumber: string
  dieselCost: string
  dieselLiters: string
  distanceTraveled: string
}
interface NewDriver {
  name: string
  phone: string
}
/** A picked record, or a new one typed inline (created with the trip). */
interface MasterSel<T> {
  id: string
  fresh: T | null
}

interface FormState {
  customer: MasterSel<NewCustomer>
  truck: MasterSel<NewTruck>
  driver: MasterSel<NewDriver>
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
    customer: { id: trip?.customer.id ?? '', fresh: null },
    truck: { id: trip?.truck.id ?? '', fresh: null },
    driver: { id: trip?.driver.id ?? '', fresh: null },
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

const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/
const isMoney = (v: string) => MONEY_RE.test(v.trim())
const nonEmpty = (v: string) => v.trim().length > 0

export function TripForm({ trip, onDone }: { trip?: TripDetailDto; onDone?: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!trip
  const [step, setStep] = React.useState(0)
  const [form, setForm] = React.useState<FormState>(() => initialForm(trip))
  const [error, setError] = React.useState('')
  const [newModal, setNewModal] = React.useState<'customer' | 'truck' | 'driver' | null>(null)
  const brickLocked = trip ? !trip.canEditBrickFigures : false

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setCost = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, costs: { ...f.costs, [k]: e.target.value } }))

  const { data: customers } = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () => api<PageDto<CustomerDto>>('GET', '/customers?page=1&pageSize=100&sort=name&order=asc'),
  })
  const { data: trucks } = useQuery({
    queryKey: ['trucks', 'options'],
    queryFn: () => api<PageDto<TruckDto>>('GET', '/trucks?page=1&pageSize=100&sort=registrationNumber&order=asc'),
  })
  const { data: drivers } = useQuery({
    queryKey: ['drivers', 'options'],
    queryFn: () => api<PageDto<DriverDto>>('GET', '/drivers?page=1&pageSize=100&sort=name&order=asc'),
  })

  function stepError(): string {
    if (step === 0) {
      if (!form.customer.id && !form.customer.fresh) return 'Please choose who is buying, or add a new customer.'
      if (!form.truck.id && !form.truck.fresh) return 'Please choose which truck, or add a new truck.'
      if (!form.driver.id && !form.driver.fresh) return 'Please choose who is driving, or add a new driver.'
      if (!nonEmpty(form.startPoint) || !nonEmpty(form.endPoint)) return 'Please fill From and To.'
      if (!nonEmpty(form.tripDate)) return 'Please pick the trip date.'
      return ''
    }
    if (step === 1) {
      if (brickLocked) return ''
      if (!nonEmpty(form.source)) return 'Please write where the bricks come from.'
      if (!nonEmpty(form.quantity)) return 'Please write how many bricks.'
      if (!isMoney(form.costPrice)) return 'Please write the buying price for one brick.'
      if (!isMoney(form.sellingPrice)) return 'Please write the selling price for one brick.'
      return ''
    }
    for (const [k, label] of COST_FIELDS) {
      if (!isMoney(form.costs[k] || '')) return `Please write the ${label.toLowerCase()} cost (0 if none).`
    }
    return ''
  }

  const refPayload = <T,>(s: MasterSel<T>) => (s.fresh ? { new: s.fresh } : { id: s.id })

  const payload = () => ({
    customer: refPayload(form.customer),
    truck: refPayload(form.truck),
    driver: refPayload(form.driver),
    tripDate: form.tripDate,
    distance: form.distance,
    startPoint: form.startPoint,
    endPoint: form.endPoint,
    includeBrickCost: form.sourceOwnership ? form.includeBrickCost : true,
    bella: brickLocked
      ? {}
      : {
          source: form.source,
          quantity: Number(form.quantity),
          costPrice: form.costPrice,
          sellingPrice: form.sellingPrice,
          sourceOwnership: form.sourceOwnership,
        },
    costs: Object.fromEntries(COST_FIELDS.map(([k]) => [k, form.costs[k]])),
  })

  const editPayload = () => ({
    customerId: form.customer.id || undefined,
    truckId: form.truck.id || undefined,
    driverId: form.driver.id || undefined,
    tripDate: form.tripDate,
    distance: form.distance,
    startPoint: form.startPoint,
    endPoint: form.endPoint,
    includeBrickCost: form.sourceOwnership ? form.includeBrickCost : true,
    bella: brickLocked
      ? {}
      : {
          source: form.source,
          quantity: Number(form.quantity),
          costPrice: form.costPrice,
          sellingPrice: form.sellingPrice,
          sourceOwnership: form.sourceOwnership,
        },
    costs: Object.fromEntries(COST_FIELDS.map(([k]) => [k, form.costs[k]])),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (trip) {
        return api<TripDetailDto>('PATCH', `/trips/${trip.id}`, editPayload())
      }
      return api<TripDetailDto>('POST', '/trips', payload())
    },
    onSuccess: (t) => {
      void qc.invalidateQueries()
      if (onDone) {
        onDone()
      } else {
        navigate({ to: '/trips/$id', params: { id: t.id } })
      }
    },
    onError: (e) => setError(errMessage(e)),
  })

  const next = () => {
    const err = stepError()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setStep((s) => Math.min(2, s + 1))
  }

  const p = preview(form)
  const profitLine =
    p.margin >= 0
      ? `You earn ₹${p.margin.toFixed(2)} on this trip.`
      : `This trip loses ₹${Math.abs(p.margin).toFixed(2)}.`

  return (
    <div className="space-y-4">
      <StepsBar step={step} onGo={(s) => (s < step ? setStep(s) : next())} />
      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {step === 0 && (
        <Card title="Step 1 of 3 — Trip">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MasterPicker
              label="Who is buying?"
              options={(customers?.items ?? []).map((c) => ({ id: c.id, label: c.name }))}
              sel={form.customer}
              onPick={(id) => set('customer', { id, fresh: null })}
              onNew={isEdit ? undefined : () => setNewModal('customer')}
            />
            <MasterPicker
              label="Which truck?"
              options={(trucks?.items ?? []).map((t) => ({ id: t.id, label: t.registrationNumber }))}
              sel={form.truck}
              onPick={(id) => set('truck', { id, fresh: null })}
              onNew={isEdit ? undefined : () => setNewModal('truck')}
            />
            <MasterPicker
              label="Who is driving?"
              options={(drivers?.items ?? []).map((d) => ({ id: d.id, label: d.name }))}
              sel={form.driver}
              onPick={(id) => set('driver', { id, fresh: null })}
              onNew={isEdit ? undefined : () => setNewModal('driver')}
            />
            <Field label="Trip date">
              <Input type="date" value={form.tripDate} onChange={(e) => set('tripDate', e.target.value)} />
            </Field>
            <Field label="From (start place)">
              <Input
                value={form.startPoint}
                onChange={(e) => set('startPoint', e.target.value)}
                placeholder="Kiln village"
              />
            </Field>
            <Field label="To (delivery place)">
              <Input
                value={form.endPoint}
                onChange={(e) => set('endPoint', e.target.value)}
                placeholder="Customer site"
              />
            </Field>
            <Field label="Distance (km)">
              <Input inputMode="decimal" value={form.distance} onChange={(e) => set('distance', e.target.value)} />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card
          title="Step 2 of 3 — Bricks"
          right={brickLocked ? <span className="text-xs text-amber-600">Locked — money already received</span> : null}
        >
          <p className="mb-3 text-xs text-gray-500">
            {brickLocked
              ? 'These numbers cannot change now because money has been received for this trip.'
              : 'Write the brick details. They get fixed for this trip afterwards.'}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Where are the bricks from?">
              <Input
                disabled={brickLocked}
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
                placeholder="Kiln or supplier name"
              />
            </Field>
            <Field label="How many bricks?">
              <Input
                disabled={brickLocked}
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="e.g. 1000"
              />
            </Field>
            <Field label="Buying price for one brick (₹)">
              <Input
                disabled={brickLocked}
                inputMode="decimal"
                value={form.costPrice}
                onChange={(e) => set('costPrice', e.target.value)}
              />
            </Field>
            <Field label="Selling price for one brick (₹)">
              <Input
                disabled={brickLocked}
                inputMode="decimal"
                value={form.sellingPrice}
                onChange={(e) => set('sellingPrice', e.target.value)}
              />
            </Field>
            <Field label="Whose bricks are these?">
              <Select
                disabled={brickLocked}
                value={form.sourceOwnership ? 'true' : 'false'}
                onChange={(e) => {
                  const own = e.target.value === 'true'
                  setForm((f) => ({ ...f, sourceOwnership: own, includeBrickCost: own ? f.includeBrickCost : true }))
                }}
              >
                <option value="false">Bought from someone else</option>
                <option value="true">From my own kiln</option>
              </Select>
            </Field>
            {form.sourceOwnership && (
              <Field label="Count the buying price in profit?">
                <Select
                  disabled={brickLocked}
                  value={form.includeBrickCost ? 'true' : 'false'}
                  onChange={(e) => set('includeBrickCost', e.target.value === 'true')}
                >
                  <option value="true">Yes, count it</option>
                  <option value="false">No, skip it (my own bricks)</option>
                </Select>
              </Field>
            )}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 3 of 3 — Trip costs">
          <p className="mb-3 text-xs text-gray-500">Write each cost. Put 0 where there is no cost.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {COST_FIELDS.map(([k, label]) => (
              <Field key={k} label={`${label} (₹)`}>
                <Input inputMode="decimal" value={form.costs[k]} onChange={setCost(k)} />
              </Field>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm tabular-nums dark:bg-gray-800/60">
            <span className={p.margin >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}>
              {profitLine}
            </span>
          </div>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="subtle" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ← Back
        </Button>
        {step < 2 ? (
          <Button onClick={next}>Next →</Button>
        ) : (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : trip ? 'Save trip' : 'Save trip'}
          </Button>
        )}
      </div>

      {newModal === 'customer' && (
        <NewCustomerModal
          onClose={() => setNewModal(null)}
          onAdd={(v) => {
            set('customer', { id: '', fresh: v })
            setNewModal(null)
          }}
        />
      )}
      {newModal === 'truck' && (
        <NewTruckModal
          onClose={() => setNewModal(null)}
          onAdd={(v) => {
            set('truck', { id: '', fresh: v })
            setNewModal(null)
          }}
        />
      )}
      {newModal === 'driver' && (
        <NewDriverModal
          onClose={() => setNewModal(null)}
          onAdd={(v) => {
            set('driver', { id: '', fresh: v })
            setNewModal(null)
          }}
        />
      )}
    </div>
  )
}

function StepsBar({ step, onGo }: { step: number; onGo: (s: number) => void }) {
  const labels = ['1. Trip', '2. Bricks', '3. Costs']
  return (
    <ol className="flex gap-2">
      {labels.map((label, i) => (
        <li key={label} className="flex-1">
          <button
            type="button"
            onClick={() => onGo(i)}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
              i === step
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : i < step
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-gray-200 text-gray-400 dark:border-gray-800'
            }`}
          >
            {label} {i < step ? '✓' : ''}
          </button>
        </li>
      ))}
    </ol>
  )
}

function MasterPicker<T>({
  label,
  options,
  sel,
  onPick,
  onNew,
}: {
  label: string
  options: { id: string; label: string }[]
  sel: MasterSel<T>
  onPick: (id: string) => void
  onNew?: () => void
}) {
  return (
    <div className="space-y-1">
      <Field label={label}>
        <div className="flex gap-2">
          <Select
            value={sel.fresh ? '__new__' : sel.id}
            onChange={(e) => {
              if (e.target.value !== '__new__') onPick(e.target.value)
            }}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
            {sel.fresh ? <option value="__new__">New (just added) ✓</option> : null}
          </Select>
          {onNew ? (
            <Button type="button" variant="subtle" onClick={onNew} title="Add new">
              + New
            </Button>
          ) : null}
        </div>
      </Field>
      {sel.fresh ? <p className="text-[11px] text-emerald-600">New entry will be saved with this trip.</p> : null}
    </div>
  )
}

function NewCustomerModal({ onClose, onAdd }: { onClose: () => void; onAdd: (v: NewCustomer) => void }) {
  const [form, setForm] = React.useState<NewCustomer>({ name: '', phone: '', location: '' })
  const [err, setErr] = React.useState('')
  return (
    <Modal open title="New customer" onClose={onClose}>
      <div className="space-y-3">
        {err ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
        ) : null}
        <Field label="Customer name">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sharma Building Material"
          />
        </Field>
        <Field label="Phone (if you have it)">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91…"
          />
        </Field>
        <Field label="Place / village">
          <Input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Nashik"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!nonEmpty(form.name)) {
                setErr('Please write the customer name.')
                return
              }
              if (!nonEmpty(form.location)) {
                setErr('Please write the place.')
                return
              }
              onAdd({ name: form.name.trim(), phone: form.phone.trim(), location: form.location.trim() })
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function NewTruckModal({ onClose, onAdd }: { onClose: () => void; onAdd: (v: NewTruck) => void }) {
  const [form, setForm] = React.useState<NewTruck>({
    registrationNumber: '',
    dieselCost: '0',
    dieselLiters: '0',
    distanceTraveled: '0',
  })
  const [err, setErr] = React.useState('')
  return (
    <Modal open title="New truck" onClose={onClose}>
      <div className="space-y-3">
        {err ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
        ) : null}
        <Field label="Truck number">
          <Input
            value={form.registrationNumber}
            onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
            placeholder="e.g. MH 12 AB 1234"
          />
        </Field>
        <p className="text-[11px] text-gray-400">
          The three readings below can be 0 for now. You can change them later on the Trucks page.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Diesel cost (₹)">
            <Input
              inputMode="decimal"
              value={form.dieselCost}
              onChange={(e) => setForm((f) => ({ ...f, dieselCost: e.target.value }))}
            />
          </Field>
          <Field label="Diesel (litres)">
            <Input
              inputMode="decimal"
              value={form.dieselLiters}
              onChange={(e) => setForm((f) => ({ ...f, dieselLiters: e.target.value }))}
            />
          </Field>
          <Field label="Distance (km)">
            <Input
              inputMode="decimal"
              value={form.distanceTraveled}
              onChange={(e) => setForm((f) => ({ ...f, distanceTraveled: e.target.value }))}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!nonEmpty(form.registrationNumber)) {
                setErr('Please write the truck number.')
                return
              }
              if (!isMoney(form.dieselCost) || !isMoney(form.dieselLiters) || !isMoney(form.distanceTraveled)) {
                setErr('Please check the three readings (numbers only).')
                return
              }
              onAdd({ ...form, registrationNumber: form.registrationNumber.trim() })
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function NewDriverModal({ onClose, onAdd }: { onClose: () => void; onAdd: (v: NewDriver) => void }) {
  const [form, setForm] = React.useState<NewDriver>({ name: '', phone: '' })
  const [err, setErr] = React.useState('')
  return (
    <Modal open title="New driver" onClose={onClose}>
      <div className="space-y-3">
        {err ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
        ) : null}
        <Field label="Driver name">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Raju"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!nonEmpty(form.name)) {
                setErr('Please write the driver name.')
                return
              }
              if (!nonEmpty(form.phone)) {
                setErr('Please write the phone number.')
                return
              }
              onAdd({ name: form.name.trim(), phone: form.phone.trim() })
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  )
}
