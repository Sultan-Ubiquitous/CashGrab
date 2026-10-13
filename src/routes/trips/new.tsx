import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '~/components/RequireAuth'
import { TripForm } from '~/components/TripForm'

export const Route = createFileRoute('/trips/new')({
  component: () => (
    <RequireAuth>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-xl font-bold">New trip</h1>
        <TripForm />
      </div>
    </RequireAuth>
  ),
})
