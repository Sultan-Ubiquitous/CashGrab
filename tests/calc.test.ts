import { describe, expect, it } from 'vitest'
import {
  effectiveNetMargin,
  isPaymentDue,
  netMarginCalculated,
  totalTripCost,
  tripBrickCost,
  tripFinancials,
  tripRevenue,
  truckCostPerKm,
  truckMileage,
} from '~/server/services/calc'
import { dec, money, moneyOrNull, sum } from '~/server/lib/money'
import { csvCell, sanitizeText, xlsxCell } from '~/server/exports/cells'

describe('money helpers', () => {
  it('never uses binary float arithmetic', () => {
    expect(money(dec('0.1').plus('0.2'))).toBe('0.30')
    expect(money(sum(['1.10', '2.20', '3.30']))).toBe('6.60')
    expect(money('1234.5')).toBe('1234.50')
    expect(money('1234.567')).toBe('1234.57') // half-up
    expect(moneyOrNull(null)).toBeNull()
  })

  it('rounds half-up, away from zero', () => {
    expect(money(dec('2.345'))).toBe('2.35')
    expect(money(dec('-2.345'))).toBe('-2.35')
  })
})

describe('trip formulas (single source of truth)', () => {
  const cost = {
    diesel: '1500.25',
    adblue: '100',
    royalty: '200',
    tollTaxes: '50',
    driverSalary: '500',
    miscellaneous: '49.75',
    labour: '100',
  }

  it('revenue = quantity × selling price', () => {
    expect(money(tripRevenue(1000, '8.00'))).toBe('8000.00')
  })

  it('brick cost applies only when included', () => {
    expect(money(tripBrickCost(1000, '5.00', true))).toBe('5000.00')
    expect(money(tripBrickCost(1000, '5.00', false))).toBe('0.00')
  })

  it('total trip cost = sum of the 7 categories', () => {
    expect(money(totalTripCost(cost))).toBe('2500.00')
  })

  it('net margin = revenue − brick cost − total trip cost', () => {
    expect(
      money(
        netMarginCalculated({
          brickQuantity: 1000,
          brickCostPrice: '5.00',
          brickSellingPrice: '8.00',
          includeBrickCost: true,
          cost,
        }),
      ),
    ).toBe('500.00')
    expect(
      money(
        netMarginCalculated({
          brickQuantity: 1000,
          brickCostPrice: '5.00',
          brickSellingPrice: '8.00',
          includeBrickCost: false,
          cost,
        }),
      ),
    ).toBe('5500.00')
  })

  it('override wins over calculated; missing override falls back', () => {
    expect(money(effectiveNetMargin('500.00', '650.00'))).toBe('650.00')
    expect(money(effectiveNetMargin('500.00', null))).toBe('500.00')
    expect(money(effectiveNetMargin('500.00', undefined))).toBe('500.00')
  })

  it('payment is due while anything remains', () => {
    expect(isPaymentDue('8000.00', '0')).toBe(true)
    expect(isPaymentDue('8000.00', '7999.99')).toBe(true)
    expect(isPaymentDue('8000.00', '8000.00')).toBe(false)
  })

  it('financials dto exposes calculated, override and effective distinctly', () => {
    const f = tripFinancials(
      {
        brickQuantity: 1000,
        brickCostPrice: '5.00',
        brickSellingPrice: '8.00',
        includeBrickCost: true,
        cost,
        netMarginCalculated: '500.00',
        netMarginOverride: '650.00',
      },
      '3000.00',
    )
    expect(f).toMatchObject({
      revenue: '8000.00',
      brickCost: '5000.00',
      totalTripCost: '2500.00',
      netMarginCalculated: '500.00',
      netMarginOverride: '650.00',
      netMarginEffective: '650.00',
      isMarginOverridden: true,
      amountReceived: '3000.00',
      amountRemaining: '5000.00',
    })
  })
})

describe('truck derived figures', () => {
  it('mileage = km / litres, cost per km = ₹ / km', () => {
    expect(truckMileage('24000', '4000')).toBe('6.00')
    expect(truckMileage('24000', '0')).toBeNull()
    expect(truckCostPerKm('50000.50', '24000')).toBe('2.08')
    expect(truckCostPerKm('50000.50', '0')).toBeNull()
  })
})

describe('export cell hygiene', () => {
  it('prefixes spreadsheet formula payloads', () => {
    expect(sanitizeText('=1+1')).toBe("'=1+1")
    expect(sanitizeText('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(sanitizeText('-2+3')).toBe("'-2+3")
    expect(sanitizeText('@cmd')).toBe("'@cmd")
    expect(sanitizeText('\t42')).toBe("'\t42")
    expect(sanitizeText('normal name')).toBe('normal name')
  })

  it('keeps numbers numeric and passes dates through', () => {
    expect(csvCell('money', '-1234.50')).toBe('-1234.50')
    expect(csvCell('money', '90071992547409.93')).toBe('90071992547409.93') // not mangled by floats
    expect(csvCell('int', 42)).toBe('42')
    expect(csvCell('bool', true)).toBe('true')
    expect(csvCell('date', new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05')
    expect(csvCell('money', null)).toBe('')
    expect(xlsxCell('money', '-1234.50')).toBe(-1234.5)
    expect(xlsxCell('bool', false)).toBe(false)
    expect(xlsxCell('text', '=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")')
  })
})
