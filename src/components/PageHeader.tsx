import * as React from 'react'

/** Page title, one description line, and an optional primary action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] leading-tight font-bold md:text-[32px]">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
