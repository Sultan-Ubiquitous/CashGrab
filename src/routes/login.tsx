import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Button, ErrorNote, Field, Input } from '~/components/ui'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
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
    if (error) setError(error.message ?? 'Sign-in failed')
    else navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h1 className="text-lg font-bold">Sign in to Quick Money</h1>
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Email">
          <Input
            type="email"
            required
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button
          type="button"
          variant="subtle"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
            if (error) setError(error.message ?? 'Google sign-in is not configured')
          }}
        >
          Continue with Google
        </Button>
        <p className="text-center text-xs text-gray-500">
          No account?{' '}
          <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400">
            Create one
          </Link>
        </p>
      </form>
    </div>
  )
}
