import * as React from 'react'
import { money, monthLabel } from '~/lib/format'
import type { DashboardDto } from '~/shared/schemas'
import { cardCls } from './DataTable'

type MonthRow = DashboardDto['monthly']['months'][number]

export function MonthlyTable({ months }: { months: DashboardDto['monthly']['months'] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {months.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No trips in this period</p>
        ) : (
          months.map((m) => <MonthCard key={m.month} m={m} />)
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2 text-right">Diesel</th>
              <th className="px-3 py-2 text-right">AdBlue</th>
              <th className="px-3 py-2 text-right">Royalty</th>
              <th className="px-3 py-2 text-right">Tolls</th>
              <th className="px-3 py-2 text-right">Driver pay</th>
              <th className="px-3 py-2 text-right">Other</th>
              <th className="px-3 py-2 text-right">Labour</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums dark:divide-gray-800">
            {months.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-400">
                  No trips in this period
                </td>
              </tr>
            ) : (
              months.map((m) => (
                <tr key={m.month}>
                  <td className="px-3 py-2 font-medium">{monthLabel(m.month)}</td>
                  <td className="px-3 py-2 text-right">{money(m.diesel)}</td>
                  <td className="px-3 py-2 text-right">{money(m.adblue)}</td>
                  <td className="px-3 py-2 text-right">{money(m.royalty)}</td>
                  <td className="px-3 py-2 text-right">{money(m.tollTaxes)}</td>
                  <td className="px-3 py-2 text-right">{money(m.driverSalary)}</td>
                  <td className="px-3 py-2 text-right">{money(m.miscellaneous)}</td>
                  <td className="px-3 py-2 text-right">{money(m.labour)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(m.total)}</td>
                  <td className="px-3 py-2 text-right">
                    {m.changeFromPrevious === null ? (
                      '—'
                    ) : (
                      <span className={Number(m.changeFromPrevious) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {money(m.changeFromPrevious)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MonthCard({ m }: { m: MonthRow }) {
  const [open, setOpen] = React.useState(false)
  const parts: Array<[string, string]> = [
    ['Diesel', m.diesel],
    ['AdBlue', m.adblue],
    ['Royalty', m.royalty],
    ['Tolls & taxes', m.tollTaxes],
    ['Driver salary', m.driverSalary],
    ['Other', m.miscellaneous],
    ['Labour', m.labour],
  ]
  return (
    <div className={cardCls}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer touch-manipulation items-center justify-between gap-2 py-1 text-left"
      >
        <span className="text-sm font-semibold">{monthLabel(m.month)}</span>
        <span className="flex items-center gap-2 text-sm tabular-nums">
          <b>{money(m.total)}</b>
          {m.changeFromPrevious === null ? null : (
            <span className={Number(m.changeFromPrevious) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {money(m.changeFromPrevious)}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open ? (
        <dl className="mt-1 space-y-1 border-t border-dashed border-gray-200 pt-2 text-sm dark:border-gray-800">
          {parts.map(([label, v]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="tabular-nums">{money(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
