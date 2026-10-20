import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { Skeleton } from './components/ui'
import { isUnauthorized } from './lib/api'

/** Router-level context, created fresh with every router instance (per SSR request). */
export interface RouterContext {
  queryClient: QueryClient
}

export function getRouter() {
  // One client per router instance: a fresh cache for every server request,
  // a single cache for the whole browser session. A module-level client would
  // share cached data across users inside one Worker isolate.
  // The session expired mid-use: clear the cached session and send the user to
  // sign in, returning them to the page they were on.
  const onUnauthorized = (error: unknown) => {
    if (!isUnauthorized(error) || typeof window === 'undefined') return
    if (window.location.pathname === '/login') return
    queryClient.removeQueries({ queryKey: ['session'] })
    void router.navigate({
      to: '/login',
      search: { redirect: window.location.pathname + window.location.search },
    })
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onUnauthorized }),
    mutationCache: new MutationCache({ onError: onUnauthorized }),
    defaultOptions: { queries: { staleTime: 15_000, retry: 0, refetchOnWindowFocus: false } },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPendingComponent: () => (
      <div className="space-y-4" aria-busy="true" aria-label="Loading page">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    ),
    scrollRestoration: true,
  })

  return router
}
