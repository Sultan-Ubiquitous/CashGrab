import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Button, ErrorNote, Field, Input } from '~/components/ui'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = React.useState({ name: '', username: '', email: '', password: '' })
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await authClient.signUp.email({ ...form, callbackURL: '/' })
    setBusy(false)
    if (error) setError(error.message ?? 'Sign-up failed')
    else navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h1 className="text-lg font-bold">Create your account</h1>
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Name">
          <Input required value={form.name} onChange={set('name')} placeholder="Your name" />
        </Field>
        <Field label="Username" hint="Letters, numbers, - and _">
          <Input required value={form.username} onChange={set('username')} placeholder="username" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-gray-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-indigo-600 dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
