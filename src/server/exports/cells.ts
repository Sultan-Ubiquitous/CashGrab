import { dbDateToIso, formatIstDateTime, istWallClock } from '../lib/dates'

export type ColumnType = 'text' | 'money' | 'decimal' | 'int' | 'date' | 'datetime' | 'bool'
export type CellValue = string | number | boolean | Date | null | undefined

export interface Column<K extends string = string> {
  key: K
  header: string
  type: ColumnType
}

const FORMULA_START = /^[=+\-@\t\r]/
const NUMERIC = /^-?\d+(\.\d+)?$/

/**
 * Spreadsheet formula-injection guard (OWASP): any text that a spreadsheet
 * could interpret as a formula is prefixed with a single quote.
 * Numeric columns never pass through here, so negative amounts stay numbers.
 */
export function sanitizeText(v: string): string {
  return FORMULA_START.test(v) ? `'${v}` : v
}

/** CSV representation: plain strings; numbers keep their exact decimal text. */
export function csvCell(type: ColumnType, v: CellValue): string {
  if (v === null || v === undefined) return ''
  switch (type) {
    case 'money':
    case 'decimal':
    case 'int': {
      const s = String(v)
      return NUMERIC.test(s) ? s : sanitizeText(s)
    }
    case 'bool':
      return v ? 'true' : 'false'
    case 'date':
      return v instanceof Date ? dbDateToIso(v) : String(v)
    case 'datetime':
      return v instanceof Date ? formatIstDateTime(v) : String(v)
    default:
      return sanitizeText(String(v))
  }
}

/**
 * XLSX representation: real numeric/date/boolean cells. Money is converted to
 * a spreadsheet number only at this final step (Excel stores IEEE doubles);
 * values up to 15 significant digits round-trip exactly.
 */
export function xlsxCell(type: ColumnType, v: CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null
  switch (type) {
    case 'money':
    case 'decimal':
    case 'int': {
      const s = String(v)
      return NUMERIC.test(s) ? Number(s) : sanitizeText(s)
    }
    case 'bool':
      return Boolean(v)
    case 'date':
      return v instanceof Date ? v : new Date(`${String(v)}T00:00:00Z`)
    case 'datetime':
      return v instanceof Date ? istWallClock(v) : String(v)
    default:
      return sanitizeText(String(v))
  }
}

export const XLSX_FORMATS: Partial<Record<ColumnType, string>> = {
  money: '#,##0.00',
  decimal: '0.00',
  int: '0',
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm:ss',
}
