import * as React from 'react'
import type { PageDto } from '~/shared/schemas'
import { Button, EmptyRow, ErrorNote, Input, Select, Skeleton, cx } from './ui'
import { Dialog } from './Dialog'
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, SortIcon } from './icons'

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
export const cardCls = 'card-flip rounded-lg p-3 shadow-card'

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
            {state.order === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}
      {card ? (
        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={`sk-${i}`} className={cardCls} aria-hidden="true">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))
          ) : !page || page.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">No records found</p>
          ) : (
            page.items.map((row) => <React.Fragment key={rowKey ? rowKey(row) : row.id}>{card(row)}</React.Fragment>)
          )}
        </div>
      ) : null}
      <div className={cx('overflow-x-auto rounded-lg border border-line', card && 'hidden md:block')}>
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs uppercase tracking-[0.08em] text-fg-muted">
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
                    <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => setSort(c.key)}>
                      {c.header}
                      {state.sort === c.key ? (
                        state.order === 'asc' ? (
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <SortIcon className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk-${i}`} aria-hidden="true">
                  <td colSpan={columns.length} className="px-3 py-2.5">
                    <Skeleton className="h-4 w-full max-w-prose" />
                  </td>
                </tr>
              ))
            ) : page && page.items.length === 0 ? (
              <EmptyRow colSpan={columns.length} />
            ) : (
              page?.items.map((row) => (
                <tr key={rowKey ? rowKey(row) : row.id} className="hover:bg-subtle">
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-2">
          <span>
            {page.total} record{page.total === 1 ? '' : 's'} · Page {page.page} of {page.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="subtle"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => onState({ page: page.page - 1 })}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="subtle"
              size="sm"
              disabled={page.page >= page.totalPages}
              onClick={() => onState({ page: page.page + 1 })}
            >
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * List toolbar: an inline search box and a single "Filters" button that opens
 * the filter fields in a dialog on every screen size. Filters apply live.
 */
export function FilterBar({
  searchValue,
  onSearch,
  searchPlaceholder,
  activeCount,
  onClear,
  resultTotal,
  sheetTitle = 'Filters',
  children,
}: {
  searchValue?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  activeCount: number
  onClear: () => void
  resultTotal?: number
  sheetTitle?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const close = React.useCallback(() => setOpen(false), [])
  return (
    <>
      <div className="flex w-full items-center gap-2">
        {onSearch ? (
          <Input
            aria-label="Search"
            placeholder={searchPlaceholder ?? 'Search…'}
            value={searchValue ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            className="min-w-0 flex-1 md:max-w-xs"
          />
        ) : null}
        <Button variant="subtle" onClick={() => setOpen(true)} className={cx('shrink-0', !onSearch && 'w-full')}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </div>
      <Dialog
        open={open}
        title={sheetTitle}
        onClose={close}
        footer={
          <div className="flex gap-2">
            <Button variant="subtle" onClick={onClear} className="flex-1">
              Clear
            </Button>
            <Button onClick={close} className="flex-[2]">
              {typeof resultTotal === 'number'
                ? `Show ${resultTotal} result${resultTotal === 1 ? '' : 's'}`
                : 'Show results'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">{children}</div>
      </Dialog>
    </>
  )
}

/** Standard list state shared by all modules (sort defaults set per page). */
export function useListState(sort: string, extra: Record<string, string> = {}) {
  const [state, setState] = React.useState<ListQuery>({ page: 1, pageSize: 25, sort, order: 'desc', ...extra })
  const patch = (p: Partial<ListQuery>) => setState((s) => ({ ...s, page: p.page ?? 1, ...p }))
  return [state, patch] as const
}
