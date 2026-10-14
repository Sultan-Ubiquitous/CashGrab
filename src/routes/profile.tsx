import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '~/components/RequireAuth'
import { Button, Card, ErrorNote, Field, Input, SuccessNote } from '~/components/ui'
import { api, errMessage } from '~/lib/api'
import type { MeDto } from '~/shared/schemas'

export const Route = createFileRoute('/profile')({
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
})

function ProfilePage() {
  const qc = useQueryClient()
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
      <h1 className="text-xl font-bold">Profile</h1>
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
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
