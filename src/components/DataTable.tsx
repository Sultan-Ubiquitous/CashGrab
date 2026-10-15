import * as React from 'react'
import type { PageDto } from '~/shared/schemas'
import { Button, EmptyRow, ErrorNote, Field, Input, Select, Sheet, Spinner, cx } from './ui'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => React.ReactNode
}

export interface ListState {
  page: number
  pageSize: number
  sort: string
  order: 'asc' | 'desc'
}

/** List state plus arbitrary string filters (q, from, to, ids, …). */
export type ListQuery = ListState & Record<string, string | number | undefined>

/** Shared container styling for the mobile (<md) card layout. */
export const cardCls = 'rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900'

export function DataTable<T extends { id: string }>({
  columns,
  page,
  loading,
  error,
  state,
  onState,
  toolbar,
  rowKey,
  card,
}: {
  columns: Column<T>[]
  page?: PageDto<T>
  loading?: boolean
  error?: unknown
  state?: ListQuery
  onState?: (patch: Partial<ListQuery>) => void
  toolbar?: React.ReactNode
  rowKey?: (row: T) => string
  /** Mobile card body per row (rendered below md; the table renders at md and up). */
  card?: (row: T) => React.ReactNode
}) {
  const setSort = (key: string) => {
    if (!onState || !state) return
    onState(state.sort === key && state.order === 'asc' ? { sort: key, order: 'desc' } : { sort: key, order: 'asc' })
  }
  const sortable = columns.filter((c) => c.sortable)
  return (
    <div className="space-y-3">
      {toolbar ? <div className="flex flex-wrap items-end gap-2">{toolbar}</div> : null}
      {error ? <ErrorNote error={error} /> : null}
      {onState && state && sortable.length > 0 ? (
        <div className="flex items-center gap-2 md:hidden">
          <Select
            aria-label="Sort by"
            value={state.sort}
            onChange={(e) => onState({ sort: e.target.value })}
            className="min-w-0 flex-1"
          >
            {sortable.map((c) => (
              <option key={c.key} value={c.key}>
                Sort by {c.header}
              </option>
            ))}
          </Select>
          <Button
            variant="subtle"
            onClick={() => onState({ order: state.order === 'asc' ? 'desc' : 'asc' })}
            aria-label={state.order === 'asc' ? 'Sort descending' : 'Sort ascending'}
            className="shrink-0"
          >
            {state.order === 'asc' ? '▲' : '▼'}
          </Button>
        </div>
      ) : null}
      {card ? (
        <div className="space-y-2 md:hidden">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !page || page.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No records found</p>
          ) : (
            page.items.map((row) => <React.Fragment key={rowKey ? rowKey(row) : row.id}>{card(row)}</React.Fragment>)
          )}
        </div>
      ) : null}
      <div
        className={cx(
          'overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800',
          card && 'hidden md:block',
        )}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx(
                    'px-3 py-2 font-medium',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                  )}
                >
                  {c.sortable && onState && state ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200"
                      onClick={() => setSort(c.key)}
                    >
                      {c.header}
                      <span className="text-[9px]">
                        {state.sort === c.key ? (state.order === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
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
                      className={cx(
                        'px-3 py-2 align-middle',
                        c.align === 'right' && 'text-right tabular-nums',
                        c.align === 'center' && 'text-center',
                      )}
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {page.total} record{page.total === 1 ? '' : 's'} · page {page.page} / {page.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="subtle"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => onState({ page: page.page - 1 })}
            >
              ← Prev
            </Button>
            <Button
              variant="subtle"
              size="sm"
              disabled={page.page >= page.totalPages}
              onClick={() => onState({ page: page.page + 1 })}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Responsive list toolbar: on phones a search box plus a "Filters (n)" button
 * that opens a bottom sheet; on md and up the classic inline filter row.
 * The same filter fields are reused in both (they apply live).
 */
export function FilterBar({
  searchValue,
  onSearch,
  searchPlaceholder,
  searchWidth = 'w-44',
  activeCount,
  onClear,
  resultTotal,
  sheetTitle = 'Filters',
  children,
}: {
  searchValue?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  searchWidth?: string
  activeCount: number
  onClear: () => void
  resultTotal?: number
  sheetTitle?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <div className="flex w-full items-center gap-2 md:hidden">
        {onSearch ? (
          <Input
            aria-label="Search"
            placeholder={searchPlaceholder ?? 'Search…'}
            value={searchValue ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            className="min-w-0 flex-1"
          />
        ) : null}
        <Button variant="subtle" onClick={() => setOpen(true)} className={cx('shrink-0', !onSearch && 'w-full')}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </div>
      <div className="hidden md:flex md:flex-wrap md:items-end md:gap-2">
        {onSearch ? (
          <Field label="Search">
            <Input
              placeholder={searchPlaceholder ?? 'Search…'}
              value={searchValue ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              className={searchWidth}
            />
          </Field>
        ) : null}
        {children}
      </div>
      <Sheet
        open={open}
        title={sheetTitle}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button variant="subtle" onClick={onClear} className="flex-1">
              Clear
            </Button>
            <Button onClick={() => setOpen(false)} className="flex-[2]">
              {typeof resultTotal === 'number'
                ? `Show ${resultTotal} result${resultTotal === 1 ? '' : 's'}`
                : 'Show results'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">{children}</div>
      </Sheet>
    </>
  )
}

/** Standard list state shared by all modules (sort defaults set per page). */
export function useListState(sort: string, extra: Record<string, string> = {}) {
  const [state, setState] = React.useState<ListQuery>({ page: 1, pageSize: 25, sort, order: 'desc', ...extra })
  const patch = (p: Partial<ListQuery>) => setState((s) => ({ ...s, page: p.page ?? 1, ...p }))
  return [state, patch] as const
}
