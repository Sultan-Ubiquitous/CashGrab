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
        'inline-flex cursor-pointer touch-manipulation select-none items-center justify-center gap-1 rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45',
        size === 'sm'
          ? 'min-h-11 px-3 py-2 text-xs md:min-h-8 md:px-2 md:py-1'
          : 'min-h-11 px-4 py-2.5 text-sm md:min-h-9 md:px-3 md:py-1.5',
        variant === 'primary' && 'bg-primary text-primary-fg shadow-btn hover:bg-primary/90 active:bg-primary/85',
        variant === 'subtle' && 'border border-line-control text-fg hover:bg-subtle active:bg-subtle-strong',
        variant === 'ghost' && 'text-fg-2 hover:bg-subtle active:bg-subtle-strong',
        variant === 'danger' && 'bg-neg text-canvas shadow-btn hover:bg-neg/90 active:bg-neg/85',
        className,
      )}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[13px] font-medium text-fg-2 md:text-xs">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-fg-muted md:text-[11px]">{hint}</span> : null}
    </label>
  )
}

export const inputCls =
  'w-full rounded-md border border-line-control bg-surface px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:bg-subtle-strong disabled:text-fg-muted md:px-2 md:py-1.5 md:text-sm'

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
        tone === 'gray' && 'bg-subtle text-fg-2',
        tone === 'green' && 'bg-pos-soft text-pos',
        tone === 'red' && 'bg-neg-soft text-neg',
        tone === 'amber' && 'bg-warn-soft text-warn',
        tone === 'indigo' && 'bg-accent text-accent-fg',
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
    <section className={cx('card-flip rounded-lg shadow-card', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          {title ? <h2 className="text-[15px] font-bold">{title}</h2> : <span />}
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
    <div className="card-flip rounded-lg p-4 shadow-card">
      <div className="text-xs text-fg-muted">{label}</div>
      <div
        className={cx(
          'mt-1 font-display text-[22px] font-bold tabular-nums tracking-[-0.02em]',
          tone === 'pos' && 'text-pos',
          tone === 'neg' && 'text-neg',
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-fg-muted">{sub}</div> : null}
    </div>
  )
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-control border-t-primary" />
  )
}

/** Pulsing placeholder block for loading states; size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-subtle-strong', className)} />
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  return (
    <div className={cx('rounded-md bg-neg-soft px-3 py-2 text-xs text-neg', className)}>
      {String((error as Error)?.message ?? error)}
    </div>
  )
}

export function SuccessNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-md bg-pos-soft px-3 py-2 text-xs text-pos', className)}>{children}</div>
}

export function EmptyRow({ colSpan, children = 'No records found' }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-fg-muted">
        {children}
      </td>
    </tr>
  )
}
