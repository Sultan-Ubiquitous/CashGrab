import * as React from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/lib/auth-client'
import { safeRedirect } from '~/lib/session'
import { AuthLayout } from '~/components/AuthLayout'
import { Button, ErrorNote, Field, Input } from '~/components/ui'

export const Route = createFileRoute('/login')({
  validateSearch: (s): { error?: string; redirect?: string } => {
    const r = s as { error?: unknown; redirect?: unknown }
    return {
      ...(typeof r.error === 'string' ? { error: r.error } : {}),
      ...(typeof r.redirect === 'string' ? { redirect: r.redirect } : {}),
    }
  },
  // Already signed in: skip the form.
  beforeLoad: ({ context, search }) => {
    if (context.session) throw redirect({ href: safeRedirect(search.redirect), replace: true })
  },
  head: () => ({ meta: [{ title: 'Sign in · Quick Money' }] }),
  component: LoginPage,
})

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked:
    'This Google account is not linked to an account here. Sign in with email & password, or create a new account.',
  email_does_not_match: 'The Google account email must match your account email.',
  account_already_linked_to_different_user: 'This Google account is already connected to a different account.',
}

function LoginPage() {
  const { error: oauthError, redirect: redirectTo } = Route.useSearch()
  const target = safeRedirect(redirectTo)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await authClient.signIn.email({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message ?? 'Sign-in failed')
      return
    }
    qc.removeQueries({ queryKey: ['session'] })
    void navigate({ href: target, replace: true })
  }

  const displayError =
    error || (oauthError ? (OAUTH_ERROR_MESSAGES[oauthError] ?? `Google sign-in failed (${oauthError}).`) : '')

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          No account?{' '}
          <Link to="/signup" className="font-medium text-link">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {displayError ? <ErrorNote error={displayError} /> : null}
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <Button
        type="button"
        variant="subtle"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: target })
          if (error) setError(error.message ?? 'Google sign-in is not configured')
        }}
      >
        Continue with Google
      </Button>
    </AuthLayout>
  )
}
