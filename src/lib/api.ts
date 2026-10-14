export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new ApiError(res.status, 'INTERNAL_ERROR', `Unexpected response from ${path}`)
  }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error
    throw new ApiError(
      res.status,
      e?.code ?? 'INTERNAL_ERROR',
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    )
  }
  return json as T
}

/** Builds a query string, skipping undefined/''/null values. */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** Turns an ApiError into a short, user-facing message. */
export function errMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const issues = e.details as { message: string }[] | undefined
    if (Array.isArray(issues) && issues.length) return issues.map((i) => i.message).join('; ')
    return e.message
  }
  return e instanceof Error ? e.message : 'Something went wrong'
}
