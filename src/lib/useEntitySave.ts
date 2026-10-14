import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errMessage } from '~/lib/api'

/**
 * Shared create/update mutation plumbing for the entity modals: one pending
 * flag, one error message, cache invalidation and close-on-success.
 * The form itself stays explicit in each modal.
 */
export function useEntitySave<TForm>({
  create,
  update,
  invalidate,
  onClose,
}: {
  create?: (form: TForm) => Promise<unknown>
  update?: (form: TForm) => Promise<unknown>
  invalidate: readonly (readonly unknown[])[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [error, setError] = React.useState('')
  const mutation = useMutation({
    mutationFn: ({ mode, form }: { mode: 'create' | 'update'; form: TForm }) => {
      const fn = mode === 'create' ? create : update
      if (!fn) throw new Error(`useEntitySave: no ${mode} handler configured`)
      return fn(form)
    },
    onSuccess: () => {
      for (const queryKey of invalidate) void qc.invalidateQueries({ queryKey })
      onClose()
    },
    onError: (e) => setError(errMessage(e)),
  })
  return {
    error,
    pending: mutation.isPending,
    save: (form: TForm) => mutation.mutate({ mode: 'create', form }),
    update: (form: TForm) => mutation.mutate({ mode: 'update', form }),
    submit: (mode: 'create' | 'update', form: TForm) => mutation.mutate({ mode, form }),
  }
}
