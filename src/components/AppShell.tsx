import * as React from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/lib/auth-client'
import { api } from '~/lib/api'
import type { MeDto } from '~/shared/schemas'
import { Button } from './ui'

const NAV = [
  { to: '/', label: 'Home', icon: '▦' },
  { to: '/trips', label: 'Trips', icon: '🚚' },
  { to: '/bella', label: 'Bricks', icon: '🧱' },
  { to: '/payments', label: 'Money in', icon: '₹' },
  { to: '/trucks', label: 'Trucks', icon: '🚛' },
  { to: '/drivers', label: 'Drivers', icon: '🧑‍✈️' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/reports', label: 'Reports', icon: '📊' },
  { to: '/profile', label: 'Profile', icon: '👤' },
] as const

const AUTH_PAGES = ['/login', '/signup']

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: session, isPending } = authClient.useSession()
  const isAuthPage = AUTH_PAGES.includes(location.pathname)
  // Fresh display name (profile edits invalidate ['me']; useSession has no refresh in this version).
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('GET', '/me'),
    enabled: !!session && !isAuthPage,
  })

  if (isAuthPage) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Link to="/" className="px-4 py-4 text-base font-bold tracking-tight">
          Quick<span className="text-indigo-600 dark:text-indigo-400">Money</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === '/' }}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              activeProps={{
                className: 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
              }}
            >
              <span className="w-5 text-center text-xs">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3 text-xs dark:border-gray-800">
          {isPending ? (
            <span className="text-gray-400">…</span>
          ) : session ? (
            <div className="space-y-2">
              <div className="truncate">
                <div className="font-medium">{me?.name ?? session.user.name}</div>
                <div className="truncate text-gray-400">{me?.email ?? session.user.email}</div>
              </div>
              <Button
                variant="subtle"
                size="sm"
                className="w-full"
                onClick={async () => {
                  await authClient.signOut()
                  qc.clear()
                  navigate({ to: '/login' })
                }}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400">
              Sign in →
            </Link>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  )
}
