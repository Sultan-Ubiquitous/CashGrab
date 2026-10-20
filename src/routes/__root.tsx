/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { AppShell } from '~/components/AppShell'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import type { RouterContext } from '~/router'
import { sessionQuery } from '~/lib/session'
import { THEME_BOOTSTRAP } from '~/lib/theme'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<RouterContext>()({
  // Resolved before any page renders (on the server for first load), so route
  // guards and the shell read the same session with no skeleton flash.
  beforeLoad: async ({ context }) => ({
    session: await context.queryClient.ensureQueryData(sessionQuery),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Quick Money' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient, session } = Route.useRouteContext()
  return (
    <html>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AppShell session={session}>{children}</AppShell>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
