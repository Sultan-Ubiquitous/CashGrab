import * as React from 'react'
import { Navigate } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Spinner } from './ui'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  if (isPending)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    )
  if (!session) return <Navigate to="/login" />
  return <>{children}</>
}
