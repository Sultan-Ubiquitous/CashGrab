import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import { Prisma } from '~/generated/prisma/client'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_REFERENCE'
  | 'CONFLICT'
  | 'IN_USE'
  | 'DUPLICATE'
  | 'TRIP_HAS_PAYMENTS'
  | 'OVERPAYMENT'
  | 'BRICK_COST_SKIP_NOT_ALLOWED'
  | 'INTERNAL_ERROR'

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INVALID_REFERENCE: 422,
  BRICK_COST_SKIP_NOT_ALLOWED: 422,
  OVERPAYMENT: 422,
  CONFLICT: 409,
  IN_USE: 409,
  DUPLICATE: 409,
  TRIP_HAS_PAYMENTS: 409,
  INTERNAL_ERROR: 500,
}

export class AppError extends Error {
  readonly status: ContentfulStatusCode
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.status = STATUS[code]
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`)

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown }
}

/** Converts any thrown value into the uniform error body + HTTP status. */
export function toErrorResponse(err: unknown): { status: ContentfulStatusCode; body: ErrorBody } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, details: err.details } } }
  }
  if (err instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
    }
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Database-level guards (unique, FK, CHECK). Services check these first to
    // return precise messages; these mappings cover races.
    if (err.code === 'P2002') {
      return { status: 409, body: { error: { code: 'DUPLICATE', message: 'A record with these values already exists' } } }
    }
    if (err.code === 'P2003') {
      return {
        status: 409,
        body: { error: { code: 'IN_USE', message: 'The record is referenced by other records or a reference is invalid' } },
      }
    }
    if (err.code === 'P2025') {
      return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Record not found' } } }
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/violates check constraint/i.test(msg)) {
    return { status: 422, body: { error: { code: 'VALIDATION_ERROR', message: 'A value violates a data rule' } } }
  }
  console.error(err)
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } } }
}
