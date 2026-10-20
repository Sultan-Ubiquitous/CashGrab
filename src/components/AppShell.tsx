import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/lib/auth-client'
import type { SessionData } from '~/lib/session'
import { Button, cx } from './ui'
import { Dialog } from './Dialog'
import {
  BricksIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CustomersIcon,
  DriverIcon,
  HomeIcon,
  LogOutIcon,
  MoreIcon,
  PaymentsIcon,
  ProfileIcon,
  ReportsIcon,
  TripsIcon,
  TruckIcon,
} from './icons'

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> }

/** Desktop sidebar: the daily work, then the master records under "Manage". */
const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/trips', label: 'Trips', icon: TripsIcon },
  { to: '/bella', label: 'Bricks', icon: BricksIcon },
  { to: '/payments', label: 'Payments', icon: PaymentsIcon },
  { to: '/reports', label: 'Reports', icon: ReportsIcon },
]
const MANAGE_NAV: NavItem[] = [
  { to: '/trucks', label: 'Trucks', icon: TruckIcon },
  { to: '/drivers', label: 'Drivers', icon: DriverIcon },
  { to: '/customers', label: 'Customers', icon: CustomersIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
]

/** Mobile bottom bar: three thumb-reach destinations plus More. */
const TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/trips', label: 'Trips', icon: TripsIcon },
  { to: '/payments', label: 'Payments', icon: PaymentsIcon },
]
const MORE_NAV: NavItem[] = [
  { to: '/bella', label: 'Bricks', icon: BricksIcon },
  { to: '/reports', label: 'Reports', icon: ReportsIcon },
  ...MANAGE_NAV,
]

const SIDEBAR_KEY = 'quickmoney-sidebar'

/** No hover fill on sidebar links — only the selected chip changes color. */
const linkCls = 'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-2'
const activeCls = 'bg-primary font-semibold text-primary-fg! ring-1 ring-line-control'

export function AppShell({ session, children }: { session: SessionData | null; children: React.ReactNode }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  // Restore the saved rail preference after mount (SSR always renders expanded).
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
    } catch {
      // storage unavailable: keep expanded
    }
  }, [])

  // Signed-out visitors (login, signup, 404) get the bare page; guards handle the rest.
  if (!session) return <>{children}</>

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, 'collapsed')
      else localStorage.removeItem(SIDEBAR_KEY)
    } catch {
      // preference lives for this visit only
    }
  }

  const signOut = async () => {
    await authClient.signOut()
    qc.clear()
    setMoreOpen(false)
    void navigate({ to: '/login' })
  }

  const { name, email } = session.user
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2 shadow-bar backdrop-blur md:hidden">
        <Link to="/" className="text-base font-bold tracking-tight">
          Quick<span className="text-link">Money</span>
        </Link>
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg"
        >
          {initial}
        </Link>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cx(
          'card-flip hidden shrink-0 flex-col border-r border-line transition-[width] duration-200 md:flex',
          collapsed ? 'w-14' : 'w-52',
        )}
      >
        <div className={cx('flex items-center px-3 py-4', collapsed ? 'justify-center' : 'justify-between')}>
          {collapsed ? null : (
            <Link to="/" className="text-base font-bold tracking-tight">
              Quick<span className="text-fg-muted">Money</span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!collapsed}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted"
          >
            {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
          {PRIMARY_NAV.map((n) => (
            <NavLink key={n.to} item={n} exact={n.to === '/'} collapsed={collapsed} />
          ))}
          {collapsed ? (
            <div className="mx-2.5 my-2 border-t border-line" />
          ) : (
            <p className="px-2.5 pt-4 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">Manage</p>
          )}
          {MANAGE_NAV.map((n) => (
            <NavLink key={n.to} item={n} collapsed={collapsed} />
          ))}
        </nav>
        <div className="border-t border-line p-3 text-xs">
          {collapsed ? (
            <Button variant="ghost" size="sm" className="w-full" onClick={signOut} aria-label="Sign out">
              <LogOutIcon className="h-4 w-4" />
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="truncate">
                <div className="truncate font-medium">{name}</div>
                <div className="truncate text-fg-muted">{email}</div>
              </div>
              <Button variant="subtle" size="sm" className="w-full" onClick={signOut}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-4 pb-28 md:p-6 md:pb-6">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-bar-b backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <TabLink key={t.to} item={t} exact={t.to === '/'} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More pages"
            className="flex min-h-[60px] cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 py-1 text-[11px] text-fg-2 active:bg-subtle"
          >
            <MoreIcon className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile More sheet */}
      <Dialog
        open={moreOpen}
        title="More"
        onClose={() => setMoreOpen(false)}
        footer={
          <Button variant="subtle" className="w-full" onClick={signOut}>
            Sign out
          </Button>
        }
      >
        <nav className="space-y-1" aria-label="More">
          {MORE_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg-2 active:bg-subtle"
              activeProps={{ className: activeCls }}
            >
              <n.icon className="h-5 w-5 shrink-0" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 truncate border-t border-line pt-3 text-xs">
          <div className="font-medium">{name}</div>
          <div className="truncate text-fg-muted">{email}</div>
        </div>
      </Dialog>
    </div>
  )
}

function NavLink({ item, exact = false, collapsed }: { item: NavItem; exact?: boolean; collapsed: boolean }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact }}
      className={cx(linkCls, collapsed && 'justify-center px-0 py-2')}
      activeProps={{ className: collapsed ? `${activeCls} rounded-full` : activeCls }}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {collapsed ? null : item.label}
    </Link>
  )
}

function TabLink({ item, exact }: { item: NavItem; exact: boolean }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact }}
      className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-1 text-[11px] text-fg-2 active:bg-subtle"
      activeProps={{ className: 'font-semibold text-link!' }}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  )
}
