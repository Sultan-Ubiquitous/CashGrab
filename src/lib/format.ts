const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const num = new Intl.NumberFormat('en-IN')

export const money = (v: string | null | undefined) => (v === null || v === undefined ? '—' : inr.format(Number(v)))
export const qty = (v: number | null | undefined) => (v === null || v === undefined ? '—' : num.format(v))
export const dec2 = (v: string | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toFixed(2))

export function dateIst(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 10).split('-').reverse().join('/')
}

export function dateTimeIst(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '—'
  const d = new Date(isoUtc)
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
}

export const todayIso = () => {
  const now = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
