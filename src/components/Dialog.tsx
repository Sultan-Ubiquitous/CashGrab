import * as React from 'react'
import { Button } from './ui'
import { CloseIcon } from './icons'

/** Locks body scroll while open (restored on close/unmount). */
function useBodyLock(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}

/**
 * The one dialog pattern: a bottom sheet on phones, a centered panel on md and up.
 * Backdrop tap and Escape close it. The optional footer stays pinned.
 */
export function Dialog({
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
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-lg bg-surface shadow-float md:max-h-[85vh] md:max-w-xl md:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="filter-sheet overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
