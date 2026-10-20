import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button, Card, ErrorNote, Field, Input, SuccessNote } from '~/components/ui'
import { PageHeader } from '~/components/PageHeader'
import { api, errMessage } from '~/lib/api'
import { guardSession } from '~/lib/session'
import { applyTheme, getStoredTheme, type Theme } from '~/lib/theme'
import type { MeDto } from '~/shared/schemas'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked: 'That Google account is not linked to an account here. Sign in with email & password instead.',
  email_does_not_match: 'The Google account email must match your account email.',
  account_already_linked_to_different_user: 'This Google account is already connected to a different account.',
  unable_to_link_account: 'Connecting the Google account is not allowed. Try signing in with Google instead.',
}

export const Route = createFileRoute('/profile')({
  validateSearch: (s): { error?: string } => {
    const e = (s as { error?: unknown }).error
    return typeof e === 'string' ? { error: e } : {}
  },
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Profile · Quick Money' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  const { error: oauthError } = Route.useSearch()
  const qc = useQueryClient()
  const router = useRouter()
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => api<MeDto>('GET', '/me') })
  const [form, setForm] = React.useState({ name: '', username: '', phone: '' })
  const [error, setError] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (!user) return
    setForm({ name: user.name ?? '', username: user.username ?? '', phone: user.phone ?? '' })
  }, [user])

  // No setState on an unmounted component.
  React.useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  const save = useMutation({
    mutationFn: () =>
      api<MeDto>('PUT', '/me', {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        ...(form.username.trim() && form.username.trim() !== (user?.username ?? '')
          ? { username: form.username.trim() }
          : {}),
      }),
    onSuccess: () => {
      setError('')
      void qc.invalidateQueries({ queryKey: ['me'] })
      // Shell name comes from the cached session: drop it and re-run route loading.
      qc.removeQueries({ queryKey: ['session'] })
      void router.invalidate()
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2500)
    },
    onError: (e) => setError(errMessage(e)),
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Profile" />
      <Card title="Your account">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          {error ? <ErrorNote error={error} /> : null}
          {saved ? <SuccessNote>Saved</SuccessNote> : null}
          <Field label="Name">
            <Input required value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email" hint="Your sign-in email.">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <Field label="Username" hint="Used for sign-in. Letters, numbers, - and _.">
            <Input value={form.username} onChange={set('username')} minLength={3} maxLength={32} />
          </Field>
          <Field label="Phone" hint="Optional contact number for your account.">
            <Input value={form.phone} onChange={set('phone')} placeholder="+91…" />
          </Field>
          <div className="flex pt-1 sm:justify-end">
            <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
      <ThemeCard />
      {user ? <SignInMethodsCard user={user} oauthError={oauthError} /> : null}
    </div>
  )
}

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function ThemeCard() {
  const [theme, setTheme] = React.useState<Theme>('system')

  // Read the saved choice only after mount: SSR markup must not depend on storage.
  React.useEffect(() => setTheme(getStoredTheme()), [])

  return (
    <Card title="Appearance">
      <div className="flex gap-2" role="group" aria-label="Color theme">
        {THEME_OPTIONS.map((o) => (
          <Button
            key={o.value}
            variant={theme === o.value ? 'primary' : 'subtle'}
            className="flex-1"
            aria-pressed={theme === o.value}
            onClick={() => {
              setTheme(o.value)
              applyTheme(o.value)
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-fg-muted">System follows your device setting.</p>
    </Card>
  )
}

function SignInMethodsCard({ user, oauthError }: { user: MeDto; oauthError?: string }) {
  const qc = useQueryClient()
  const [pw, setPw] = React.useState({ password: '', confirm: '' })
  const [pwForm, setPwForm] = React.useState(false)
  const [note, setNote] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const setPassword = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/me/set-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: pw.password }),
      })
      const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string } | null
      if (!res.ok) throw new Error(body?.message ?? 'Could not set the password.')
      return body
    },
    onSuccess: () => {
      setNote({ kind: 'success', text: 'Password set. You can now sign in with email & password.' })
      setPwForm(false)
      setPw({ password: '', confirm: '' })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : ''
      const text = m.toLowerCase().includes('already set')
        ? 'A password is already set for this account.'
        : /session|fresh|sign in/i.test(m)
          ? 'Your session has expired. Sign out and in again, then try once more.'
          : m || 'Could not set the password. Try again.'
      setNote({ kind: 'error', text })
    },
  })

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/link-social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: '/profile', errorCallbackURL: '/profile' }),
      })
      const body = (await res.json().catch(() => null)) as { url?: string; message?: string } | null
      if (!res.ok) {
        setNote({ kind: 'error', text: body?.message ?? 'Google sign-in is not configured.' })
        return
      }
      if (body?.url) window.location.assign(body.url)
      else setNote({ kind: 'error', text: 'Google sign-in is not configured.' })
    } catch {
      setNote({ kind: 'error', text: 'Could not connect Google. Try again.' })
    }
  }

  const oauthMsg = oauthError ? (OAUTH_ERROR_MESSAGES[oauthError] ?? `Google sign-in failed (${oauthError}).`) : null

  return (
    <Card title="Sign-in methods">
      <div className="space-y-3">
        {note ? note.kind === 'error' ? <ErrorNote error={note.text} /> : <SuccessNote>{note.text}</SuccessNote> : null}
        {oauthMsg ? <ErrorNote error={oauthMsg} /> : null}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
          <div>
            <p className="text-sm font-medium">Email &amp; password</p>
            <p className="text-xs text-fg-2">
              {user.hasPassword ? user.email : 'Add a password to sign in with your email.'}
            </p>
          </div>
          {user.hasPassword ? (
            <span className="text-xs font-medium text-pos">Connected</span>
          ) : pwForm ? null : (
            <Button size="sm" variant="subtle" onClick={() => setPwForm(true)}>
              Set password
            </Button>
          )}
        </div>
        {pwForm && !user.hasPassword ? (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <Field label="New password" hint="At least 8 characters">
              <Input
                type="password"
                minLength={8}
                value={pw.password}
                onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Repeat password">
              <Input
                type="password"
                minLength={8}
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setPwForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={setPassword.isPending || pw.password.length < 8 || pw.password !== pw.confirm}
                onClick={() => setPassword.mutate()}
              >
                {setPassword.isPending ? 'Setting…' : 'Set password'}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
          <div>
            <p className="text-sm font-medium">Google</p>
            <p className="text-xs text-fg-2">
              {user.googleLinked
                ? 'Sign in with Google using the same email.'
                : 'Connect your Google account to also sign in with it.'}
            </p>
          </div>
          {user.googleLinked ? (
            <span className="text-xs font-medium text-pos">Connected</span>
          ) : (
            <Button size="sm" variant="subtle" onClick={connectGoogle}>
              Connect Google
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
