import { createFileRoute } from '@tanstack/react-router'
import { TripForm } from '~/components/TripForm'
import { PageHeader } from '~/components/PageHeader'
import { guardSession } from '~/lib/session'

export const Route = createFileRoute('/trips/new')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'New trip · Quick Money' }] }),
  component: NewTripPage,
})

function NewTripPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="New trip" />
      <TripForm />
    </div>
  )
}
