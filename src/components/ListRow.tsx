import * as React from 'react'

/**
 * One list item used on every breakpoint: stacked on phones, a single line on
 * md and up. Wrap a list of these in <ul className="divide-y ..."> with <li>.
 */
export function ListRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between md:gap-4 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
