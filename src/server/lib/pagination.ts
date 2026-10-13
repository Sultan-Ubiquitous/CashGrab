import type { PageDto } from '~/shared/schemas'

export interface PageParams {
  page: number
  pageSize: number
}

export function skipTake({ page, pageSize }: PageParams) {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

export function toPage<T>(items: T[], total: number, { page, pageSize }: PageParams): PageDto<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}
