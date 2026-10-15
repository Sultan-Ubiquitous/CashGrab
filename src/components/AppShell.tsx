import * as React from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/lib/auth-client'
import { api } from '~/lib/api'
import type { MeDto } from '~/shared/schemas'
import { Button, Sheet } from './ui'

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

/** Primary thumb-reach destinations. Everything else lives in the More sheet. */
const TABS = [
  { to: '/', label: 'Home', icon: '▦', exact: true },
  { to: '/trips', label: 'Trips', icon: '🚚', exact: false },
  { to: '/payments', label: 'Money in', icon: '₹', exact: false },
] as const

const MORE_LINKS = [
  { to: '/bella', label: 'Bricks', icon: '🧱' },
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
  const [moreOpen, setMoreOpen] = React.useState(false)
  const { data: session, isPending } = authClient.useSession()
  const isAuthPage = AUTH_PAGES.includes(location.pathname)
  // Fresh display name (profile edits invalidate ['me']; useSession has no refresh in this version).
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('GET', '/me'),
    enabled: !!session && !isAuthPage,
  })

  if (isAuthPage) return <>{children}</>

  const signOut = async () => {
    await authClient.signOut()
    qc.clear()
    setMoreOpen(false)
    navigate({ to: '/login' })
  }

  const displayName = me?.name ?? session?.user.name ?? ''
  const displayEmail = me?.email ?? session?.user.email ?? ''

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-900/95">
        <Link to="/" className="text-base font-bold tracking-tight">
          Quick<span className="text-indigo-600 dark:text-indigo-400">Money</span>
        </Link>
        {session ? (
          <Link
            to="/profile"
            aria-label="Profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 active:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:active:bg-indigo-900"
          >
            {(displayName.trim()[0] ?? '👤').toUpperCase()}
          </Link>
        ) : (
          !isPending && (
            <Link to="/login" className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              Sign in →
            </Link>
          )
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-gray-200 bg-white md:flex dark:border-gray-800 dark:bg-gray-900">
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
                <div className="font-medium">{displayName}</div>
                <div className="truncate text-gray-400">{displayEmail}</div>
              </div>
              <Button variant="subtle" size="sm" className="w-full" onClick={signOut}>
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

      <main className="min-w-0 flex-1 px-4 py-4 pb-28 md:p-6 md:pb-6">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-900/95"
      >
        <div className="grid grid-cols-5">
          <TabLink to={TABS[0].to} label={TABS[0].label} icon={TABS[0].icon} exact />
          <TabLink to={TABS[1].to} label={TABS[1].label} icon={TABS[1].icon} exact={false} />
          <div className="flex flex-col items-center justify-center gap-0.5 py-1">
            <Link
              to="/trips/new"
              aria-label="New trip"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-2xl leading-none font-medium text-white shadow-lg active:bg-indigo-700"
            >
              +
            </Link>
            <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">New trip</span>
          </div>
          <TabLink to={TABS[2].to} label={TABS[2].label} icon={TABS[2].icon} exact={false} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[60px] cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 py-1 text-[11px] text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
            aria-label="More pages"
          >
            <span className="text-lg leading-none">⋯</span>
            More
          </button>
        </div>
      </nav>

      {/* Mobile More sheet */}
      <Sheet
        open={moreOpen}
        title="More"
        onClose={() => setMoreOpen(false)}
        footer={
          session ? (
            <Button variant="subtle" className="w-full" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Link to="/login" onClick={() => setMoreOpen(false)} className="block">
              <Button className="w-full">Sign in</Button>
            </Link>
          )
        }
      >
        <nav className="space-y-1">
          {MORE_LINKS.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800"
              activeProps={{
                className: 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
              }}
            >
              <span className="w-6 text-center">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        {session ? (
          <div className="mt-3 truncate border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <div className="font-medium">{displayName}</div>
            <div className="truncate text-gray-400">{displayEmail}</div>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}

function TabLink({ to, label, icon, exact }: { to: string; label: string; icon: string; exact: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-1 text-[11px] text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
      activeProps={{
        className: 'font-semibold text-indigo-700 dark:text-indigo-300',
      }}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </Link>
  )
}
