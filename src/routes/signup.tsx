import * as React from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/lib/auth-client'
import { AuthLayout } from '~/components/AuthLayout'
import { Button, ErrorNote, Field, Input } from '~/components/ui'

export const Route = createFileRoute('/signup')({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: '/', replace: true })
  },
  head: () => ({ meta: [{ title: 'Create account · Quick Money' }] }),
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
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
    if (error) {
      setError(error.message ?? 'Sign-up failed')
      return
    }
    qc.removeQueries({ queryKey: ['session'] })
    void navigate({ to: '/', replace: true })
  }

  return (
    <AuthLayout
      title="Create account"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Name">
          <Input required autoComplete="name" value={form.name} onChange={set('name')} placeholder="Your name" />
        </Field>
        <Field label="Username" hint="Letters, numbers, - and _">
          <Input
            required
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            placeholder="username"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
