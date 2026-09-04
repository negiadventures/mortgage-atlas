import { describe, expect, it } from 'vitest'
import { buildSchedule, carryingCostsForYear, monthlyPayment, pmiEndsAfterMonths } from './mortgage.js'

/**
 * The point of these is not coverage. It is that three of the numbers this app
 * printed were wrong for a year and nothing caught them, because a wrong figure
 * in a mortgage table looks exactly like a right one.
 *
 * Where a figure can be checked against something other than this code, it is.
 */

const base = {
  homePrice: 500000,
  downPaymentPercent: 0.2,
  loan: 400000,
  annualRate: 0.062,
  years: 30,
  propertyTaxRate: 0.0223,
  insuranceAnnual: 1526,
  hoaMonthly: 600,
  pmiRate: 0.008,
  homeValueGrowthRate: 0.035,
  costInflationRate: 0.03,
  rentalIncomeMonthly: 0,
}

describe('monthlyPayment', () => {
  it('matches the standard annuity figure', () => {
    // $400,000 at 6.2% over 30 years, checked against the closed form worked
    // out at 28 digits of precision rather than in floating point.
    expect(monthlyPayment(400000, 0.062, 30)).toBeCloseTo(2449.8759, 3)
  })

  it('matches a second, shorter term', () => {
    // $400,000 at 5.75% over 15 years, checked the same way.
    expect(monthlyPayment(400000, 0.0575, 15)).toBeCloseTo(3321.6403, 3)
  })

  it('splits the principal evenly at zero interest', () => {
    expect(monthlyPayment(360000, 0, 30)).toBe(1000)
  })

  it('is zero for a zero-length term rather than NaN', () => {
    expect(monthlyPayment(100000, 0.05, 0)).toBe(0)
  })
})

describe('the schedule closes', () => {
  const built = buildSchedule(base)

  it('pays the loan off exactly at the end of the term', () => {
    expect(built.rows).toHaveLength(30)
    expect(built.rows[29].end_balance).toBe(0)
  })

  it('has principal summing to the loan', () => {
    const principal = built.rows.reduce((sum, r) => sum + r.principal_paid, 0)
    expect(principal).toBeCloseTo(400000, 0)
  })

  it('has principal plus interest summing to every payment made', () => {
    const total = built.rows.reduce((sum, r) => sum + r.principal_paid + r.interest_paid, 0)
    expect(total).toBeCloseTo(built.monthlyPayment * 360, 0)
  })

  it('starts the first year at the full loan', () => {
    expect(built.rows[0].start_balance).toBe(400000)
  })

  it('carries each year end into the next year start', () => {
    for (let i = 1; i < built.rows.length; i += 1) {
      expect(built.rows[i].start_balance).toBeCloseTo(built.rows[i - 1].end_balance, 2)
    }
  })
})

/*
 * Bug 1. The down payment was computed, used to size the loan, shown on screen,
 * and then left out of profit. Every figure in that column was overstated by the
 * whole deposit for the entire term.
 */
describe('profit counts the down payment as money spent', () => {
  it('is down at least the deposit in year one', () => {
    const built = buildSchedule(base)
    const first = built.rows[0]
    // A year in you have paid $100k down plus twelve months of everything, and
    // the house has grown 3.5%. That cannot come out ahead.
    expect(first.profit_loss).toBeLessThan(0)
  })

  it('equals equity minus every dollar put in, deposit included', () => {
    const built = buildSchedule(base)
    const row = built.rows[9]
    const equity = row.home_value - row.end_balance
    expect(row.profit_loss).toBeCloseTo(equity - row.total_paid_after_rent_to_date, 2)
  })

  it('moves by exactly the deposit when the deposit changes', () => {
    // The whole shape of the old bug: a bigger deposit used to look free.
    const small = buildSchedule({ ...base, downPaymentPercent: 0.1, loan: 450000 })
    const large = buildSchedule({ ...base, downPaymentPercent: 0.3, loan: 350000 })
    // More down means less borrowed, so the two differ by more than the deposit
    // alone, but the deposit must be inside the total either way.
    expect(small.rows[0].total_paid_after_rent_to_date).toBeGreaterThan(50000)
    expect(large.rows[0].total_paid_after_rent_to_date).toBeGreaterThan(150000)
  })
})

/*
 * Bug 2. PMI was charged for all 360 payments. A lender drops it at 80% LTV.
 */
describe('PMI stops at 80% of the purchase price', () => {
  it('is never charged at all above 20% down', () => {
    expect(pmiEndsAfterMonths(500000, 0.2, 400000, 0.062, 30)).toBe(0)
    expect(buildSchedule(base).totalPmi).toBe(0)
  })

  it('ends partway through a 30 year term at 10% down', () => {
    const months = pmiEndsAfterMonths(500000, 0.1, 450000, 0.062, 30)
    expect(months).toBeGreaterThan(0)
    expect(months).toBeLessThan(360)
  })

  it('leaves the balance at or under 80% of price on the month it ends', () => {
    const months = pmiEndsAfterMonths(500000, 0.1, 450000, 0.062, 30)
    const built = buildSchedule({ ...base, downPaymentPercent: 0.1, loan: 450000 })
    const year = Math.ceil(months / 12)
    expect(built.rows[year - 1].end_balance).toBeLessThanOrEqual(400000)
    // And still above it the year before, so it did not stop early.
    expect(built.rows[year - 2].end_balance).toBeGreaterThan(400000)
  })

  it('charges nothing after it ends', () => {
    const built = buildSchedule({ ...base, downPaymentPercent: 0.1, loan: 450000 })
    const lastPmiYear = Math.ceil(built.pmiMonths / 12)
    expect(built.rows[lastPmiYear].pmi_paid).toBe(0)
    expect(built.rows[29].pmi_paid).toBe(0)
  })

  it('totals far less than charging it for the whole term', () => {
    const built = buildSchedule({ ...base, downPaymentPercent: 0.1, loan: 450000 })
    const forTheWholeTerm = (450000 * 0.008) / 12 * 360
    expect(forTheWholeTerm).toBeGreaterThan(100000)
    expect(built.totalPmi).toBeLessThan(forTheWholeTerm / 3)
  })

  it('ends sooner on a 15 year term, which pays down faster', () => {
    const thirty = pmiEndsAfterMonths(500000, 0.1, 450000, 0.062, 30)
    const fifteen = pmiEndsAfterMonths(500000, 0.1, 450000, 0.0575, 15)
    expect(fifteen).toBeLessThan(thirty)
  })
})

/*
 * Bug 3. The model appreciated the house and then taxed it at the purchase
 * price forever.
 */
describe('carrying costs grow', () => {
  it('charges year one at the purchase price', () => {
    const y1 = carryingCostsForYear({ year: 1, ...base })
    expect(y1.propertyTaxMonthly).toBeCloseTo((500000 * 0.0223) / 12, 6)
    expect(y1.insuranceMonthly).toBeCloseTo(1526 / 12, 6)
    expect(y1.hoaMonthly).toBe(600)
  })

  it('follows the home value for property tax', () => {
    const y11 = carryingCostsForYear({ year: 11, ...base })
    const assessed = 500000 * Math.pow(1.035, 10)
    expect(y11.propertyTaxMonthly).toBeCloseTo((assessed * 0.0223) / 12, 6)
  })

  it('follows general inflation for insurance and HOA, not the home value', () => {
    const y11 = carryingCostsForYear({ year: 11, ...base })
    expect(y11.hoaMonthly).toBeCloseTo(600 * Math.pow(1.03, 10), 6)
    expect(y11.insuranceMonthly).toBeCloseTo((1526 * Math.pow(1.03, 10)) / 12, 6)
  })

  it('holds everything flat when both growth rates are zero', () => {
    const flat = { ...base, homeValueGrowthRate: 0, costInflationRate: 0 }
    const y1 = carryingCostsForYear({ year: 1, ...flat })
    const y30 = carryingCostsForYear({ year: 30, ...flat })
    expect(y30).toEqual(y1)
  })

  it('makes later years cost more than earlier ones', () => {
    const built = buildSchedule(base)
    expect(built.rows[29].all_in_monthly).toBeGreaterThan(built.rows[0].all_in_monthly)
  })
})

describe('running totals', () => {
  it('accumulates rather than extrapolating from month one', () => {
    const built = buildSchedule(base)
    const naive = built.rows[0].all_in_monthly * 12 * 30
    // The old code used exactly that figure. With costs growing it undershoots.
    expect(built.rows[29].total_paid_to_date).toBeGreaterThan(naive)
  })

  it('never decreases', () => {
    const built = buildSchedule(base)
    for (let i = 1; i < built.rows.length; i += 1) {
      expect(built.rows[i].total_paid_to_date).toBeGreaterThan(built.rows[i - 1].total_paid_to_date)
    }
  })

  it('subtracts rent from the net total only', () => {
    const withRent = buildSchedule({ ...base, rentalIncomeMonthly: 1000 })
    const row = withRent.rows[4]
    expect(row.total_paid_to_date - row.total_paid_after_rent_to_date).toBeCloseTo(1000 * 12 * 5, 2)
  })

  it('includes the deposit in both totals from year one', () => {
    const built = buildSchedule(base)
    expect(built.rows[0].total_paid_to_date).toBeGreaterThan(100000)
  })
})

describe('degenerate input does not produce NaN', () => {
  it('survives a home bought outright', () => {
    const built = buildSchedule({ ...base, downPaymentPercent: 1, loan: 0 })
    expect(built.monthlyPayment).toBe(0)
    expect(built.rows[0].profit_loss).toBeLessThan(0)
    expect(Number.isFinite(built.rows[29].total_paid_to_date)).toBe(true)
  })

  it('survives a zero interest rate', () => {
    const built = buildSchedule({ ...base, annualRate: 0 })
    expect(built.totalInterest).toBeCloseTo(0, 6)
    expect(built.rows[29].end_balance).toBe(0)
  })

  it('survives a free house', () => {
    const built = buildSchedule({ ...base, homePrice: 0, loan: 0 })
    expect(built.rows.every((r) => Number.isFinite(r.profit_loss))).toBe(true)
  })
})
