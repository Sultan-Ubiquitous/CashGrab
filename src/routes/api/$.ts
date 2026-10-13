import { createFileRoute } from '@tanstack/react-router'

// Every /api/* request is handled by the Hono app (src/server/app.ts).
// The import is dynamic so server code never reaches the client bundle.
async function handle({ request }: { request: Request }) {
  const { default: app } = await import('~/server/app')
  return app.fetch(request)
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
})
