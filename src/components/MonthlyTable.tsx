import { money, monthLabel } from '~/lib/format'
import type { DashboardDto } from '~/shared/schemas'

export function MonthlyTable({ months }: { months: DashboardDto['monthly']['months'] }) {
  return (
    <div className="overflow-x-auto">
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
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
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
  )
}
