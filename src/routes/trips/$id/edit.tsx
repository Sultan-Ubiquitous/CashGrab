import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { PageHeader } from '~/components/PageHeader'
import { TripForm } from '~/components/TripForm'
import { Skeleton } from '~/components/ui'
import { ArrowLeftIcon } from '~/components/icons'
import { api, errMessage } from '~/lib/api'
import { dateIst } from '~/lib/format'
import { guardSession } from '~/lib/session'
import type { TripDetailDto } from '~/shared/schemas'

export const Route = createFileRoute('/trips/$id/edit')({
  beforeLoad: ({ context, location }) => guardSession(context, location.href),
  head: () => ({ meta: [{ title: 'Edit trip · Quick Money' }] }),
  component: EditTripPage,
})

function EditTripPage() {
  const { id } = useParams({ from: '/trips/$id/edit' })
  const qc = useQueryClient()
  const navigate = useNavigate()
  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api<TripDetailDto>('GET', `/trips/${id}`),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="Loading trip">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }
  if (error || !trip) return <p className="text-sm text-neg">{errMessage(error ?? new Error('Trip not found'))}</p>

  const backToTrip = () => {
    void qc.invalidateQueries({ queryKey: ['trip', id] })
    void navigate({ to: '/trips/$id', params: { id } })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/trips/$id" params={{ id }} className="inline-flex items-center gap-1 text-xs text-fg-2">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to trip
      </Link>
      <PageHeader title="Edit trip" description={`Trip on ${dateIst(trip.tripDate)}`} />
      <TripForm trip={trip} onDone={backToTrip} />
    </div>
  )
}
