import * as React from 'react'
import { Button, EmptyRow, ErrorNote, Spinner, cx } from './ui'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => React.ReactNode
}

export interface PageDto<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListState {
  page: number
  pageSize: number
  sort: string
  order: 'asc' | 'desc'
}

/** List state plus arbitrary string filters (q, from, to, ids, …). */
export type ListQuery = ListState & Record<string, string | number | undefined>

export function DataTable<T extends { id: string }>({
  columns,
  page,
  loading,
  error,
  state,
  onState,
  toolbar,
  rowKey,
}: {
  columns: Column<T>[]
  page?: PageDto<T>
  loading?: boolean
  error?: unknown
  state?: ListQuery
  onState?: (patch: Partial<ListQuery>) => void
  toolbar?: React.ReactNode
  rowKey?: (row: T) => string
}) {
  const setSort = (key: string) => {
    if (!onState || !state) return
    onState(state.sort === key && state.order === 'asc' ? { sort: key, order: 'desc' } : { sort: key, order: 'asc' })
  }
  return (
    <div className="space-y-3">
      {toolbar ? <div className="flex flex-wrap items-end gap-2">{toolbar}</div> : null}
      {error ? <ErrorNote error={error} /> : null}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx('px-3 py-2 font-medium', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}
                >
                  {c.sortable && onState && state ? (
                    <button className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200" onClick={() => setSort(c.key)}>
                      {c.header}
                      <span className="text-[9px]">{state.sort === c.key ? (state.order === 'asc' ? '▲' : '▼') : '⇅'}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : page && page.items.length === 0 ? (
              <EmptyRow colSpan={columns.length} />
            ) : (
              page?.items.map((row) => (
                <tr key={rowKey ? rowKey(row) : row.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cx('px-3 py-2 align-middle', c.align === 'right' && 'text-right tabular-nums', c.align === 'center' && 'text-center')}
                    >
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {page && onState && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {page.total} record{page.total === 1 ? '' : 's'} · page {page.page} / {page.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" disabled={page.page <= 1} onClick={() => onState({ page: page.page - 1 })}>
              ← Prev
            </Button>
            <Button variant="subtle" size="sm" disabled={page.page >= page.totalPages} onClick={() => onState({ page: page.page + 1 })}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Standard list state shared by all modules (sort defaults set per page). */
export function useListState(sort: string, extra: Record<string, string> = {}) {
  const [state, setState] = React.useState<ListQuery>({ page: 1, pageSize: 25, sort, order: 'desc', ...extra })
  const patch = (p: Partial<ListQuery>) => setState((s) => ({ ...s, page: p.page ?? 1, ...p }))
  return [state, patch] as const
}
