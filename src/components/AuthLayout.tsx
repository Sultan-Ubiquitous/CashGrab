import * as React from 'react'
import { Link } from '@tanstack/react-router'

/** Shared frame for sign-in and sign-up: centered column, no outer box. */
export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="block text-center text-base font-bold tracking-tight">
          Quick<span className="text-link">Money</span>
        </Link>
        <div className="space-y-4">
          <h1 className="text-lg font-bold">{title}</h1>
          {children}
        </div>
        {footer ? <div className="text-center text-xs text-fg-2">{footer}</div> : null}
      </div>
    </div>
  )
}
