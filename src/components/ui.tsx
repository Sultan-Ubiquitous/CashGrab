import * as React from 'react'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex cursor-pointer touch-manipulation select-none items-center justify-center gap-1 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm'
          ? 'min-h-11 px-3 py-2 text-xs md:min-h-8 md:px-2 md:py-1'
          : 'min-h-11 px-4 py-2.5 text-sm md:min-h-9 md:px-3 md:py-1.5',
        variant === 'primary' && 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-700',
        variant === 'subtle' &&
          'bg-gray-100 hover:bg-gray-200 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-700',
        variant === 'ghost' && 'hover:bg-gray-100 active:bg-gray-100 dark:hover:bg-gray-800 dark:active:bg-gray-800',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 active:bg-red-700',
        className,
      )}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[13px] font-medium text-gray-600 md:text-xs dark:text-gray-400">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-gray-400 md:text-[11px]">{hint}</span> : null}
    </label>
  )
}

export const inputCls =
  'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500 md:px-2 md:py-1.5 md:text-sm'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, props.className)} rows={props.rows ?? 2} />
}

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: 'gray' | 'green' | 'red' | 'amber' | 'indigo'
  children: React.ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        tone === 'green' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
        tone === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        tone === 'amber' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        tone === 'indigo' && 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      )}
    >
      {children}
    </span>
  )
}

export function Card({
  title,
  right,
  children,
  className,
}: {
  title?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm',
        className,
      )}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : <span />}
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={cx(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'pos' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'neg' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div> : null}
    </div>
  )
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
  )
}

/** Locks body scroll while a modal/sheet is open (restores on close/unmount). */
export function useBodyLock(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}

function useEscapeToClose(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useBodyLock(open)
  useEscapeToClose(open, onClose)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:pb-5 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Bottom sheet on phones, centered dialog on md and up.
 * Hand-rolled (no dependencies): backdrop tap and Escape close it, body scroll locks.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  useBodyLock(open)
  useEscapeToClose(open, onClose)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="filter-sheet overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 dark:border-gray-800">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300',
        className,
      )}
    >
      {String((error as Error)?.message ?? error)}
    </div>
  )
}

export function SuccessNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function EmptyRow({ colSpan, children = 'No records found' }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-gray-400">
        {children}
      </td>
    </tr>
  )
}
