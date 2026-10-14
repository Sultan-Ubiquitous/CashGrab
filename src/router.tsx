import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

/** Router-level context, created fresh with every router instance (per SSR request). */
export interface RouterContext {
  queryClient: QueryClient
}

export function getRouter() {
  // One client per router instance: a fresh cache for every server request,
  // a single cache for the whole browser session. A module-level client would
  // share cached data across users inside one Worker isolate.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 0, refetchOnWindowFocus: false } },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  })

  return router
}
