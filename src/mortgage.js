/**
 * The arithmetic, on its own.
 *
 * It lived inside App.jsx, which meant the only way to check any of it was to
 * open the page and read a table. That is a bad trade for a tool whose entire
 * output is numbers somebody uses to decide whether to buy a house: a wrong
 * figure here does not look wrong, it looks like an answer.
 *
 * Nothing below touches React, so every claim it makes can be checked against a
 * schedule worked out by hand.
 */

export const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100

/**
 * The monthly payment on a level-payment loan.
 *
 * The standard annuity formula. The zero-rate branch is not a nicety: at rate
 * zero the denominator is also zero and the whole thing is NaN, which would
 * render as an empty table rather than as an error.
 */
export function monthlyPayment(loan, annualRate, years) {
  const numPayments = years * 12
  if (numPayments <= 0) return 0
  if (annualRate <= 0) return loan / numPayments
  const r = annualRate / 12
  return (loan * r) / (1 - Math.pow(1 + r, -numPayments))
}

/**
 * When private mortgage insurance stops, in whole months.
 *
 * The thing this got wrong, and the reason it matters more than it sounds.
 * PMI was charged for the entire term, so a thirty-year projection carried it
 * for three hundred and sixty payments when a real lender drops it at eighty
 * percent loan to value. On a $450,000 loan at 0.8% that is a hundred and eight
 * thousand dollars of insurance against a real figure nearer twenty seven, all
 * of it landing in the column somebody is comparing against renting.
 *
 * Measured against the original price, not against the projected value. Lenders
 * use the purchase price for automatic termination, and using an appreciating
 * value here would let an optimistic growth rate cancel the insurance early,
 * which is the growth assumption quietly paying the premiums.
 *
 * Returns zero when there was never any PMI to stop.
 */
export function pmiEndsAfterMonths(homePrice, downPaymentPercent, loan, annualRate, years) {
  if (downPaymentPercent >= 0.2) return 0
  const target = homePrice * 0.8
  if (loan <= target) return 0

  const payment = monthlyPayment(loan, annualRate, years)
  const r = annualRate / 12
  let balance = loan
  for (let month = 1; month <= years * 12; month += 1) {
    balance -= payment - balance * r
    if (balance <= target) return month
  }
  return years * 12
}

/**
 * The costs that are not the loan, year by year.
 *
 * These used to be a single monthly figure repeated for thirty years, which
 * left the model arguing with itself: it appreciated the house at three and a
 * half percent a year and then taxed it at what it cost on the day it was
 * bought. Property tax follows the assessed value, and insurance and dues
 * follow the cost of everything else, so all three grow.
 *
 * Property tax grows with the home value because that is what it is charged
 * on. Insurance and HOA grow at a general inflation rate instead, since neither
 * is a function of what the house is worth.
 */
export function carryingCostsForYear({
  year,
  homePrice,
  propertyTaxRate,
  insuranceAnnual,
  hoaMonthly,
  homeValueGrowthRate,
  costInflationRate,
}) {
  // Year one is the year of purchase, so nothing has grown yet.
  const elapsed = Math.max(0, year - 1)
  const assessed = homePrice * Math.pow(1 + homeValueGrowthRate, elapsed)
  const inflation = Math.pow(1 + costInflationRate, elapsed)
  return {
    propertyTaxMonthly: (assessed * propertyTaxRate) / 12,
    insuranceMonthly: (insuranceAnnual * inflation) / 12,
    hoaMonthly: hoaMonthly * inflation,
  }
}

/**
 * A year-by-year schedule for one term.
 *
 * Built as a running total rather than as `monthly × 12 × year`, which is what
 * it was before and is only correct while nothing changes. Once PMI stops
 * partway through year eight and the tax bill grows every January, the only
 * honest way to know what has been paid is to add it up.
 */
export function buildSchedule({
  homePrice,
  downPaymentPercent,
  loan,
  annualRate,
  years,
  propertyTaxRate,
  insuranceAnnual,
  hoaMonthly,
  pmiRate,
  homeValueGrowthRate,
  costInflationRate,
  rentalIncomeMonthly,
}) {
  const payment = monthlyPayment(loan, annualRate, years)
  const r = annualRate / 12
  const pmiMonths = pmiEndsAfterMonths(homePrice, downPaymentPercent, loan, annualRate, years)
  const pmiMonthly = pmiMonths > 0 ? (loan * pmiRate) / 12 : 0

  let balance = loan
  let month = 0
  let paidAllIn = 0
  let paidNet = 0
  let interestTotal = 0
  let pmiTotal = 0

  const rows = []

  for (let year = 1; year <= years; year += 1) {
    const startBalance = balance
    const carrying = carryingCostsForYear({
      year,
      homePrice,
      propertyTaxRate,
      insuranceAnnual,
      hoaMonthly,
      homeValueGrowthRate,
      costInflationRate,
    })
    const otherMonthly =
      carrying.propertyTaxMonthly + carrying.insuranceMonthly + carrying.hoaMonthly

    let principalYear = 0
    let interestYear = 0
    let pmiYear = 0

    for (let i = 0; i < 12; i += 1) {
      month += 1
      const interest = balance * r
      const principal = payment - interest
      principalYear += principal
      interestYear += interest
      balance -= principal

      const pmiThisMonth = month <= pmiMonths ? pmiMonthly : 0
      pmiYear += pmiThisMonth

      const allInThisMonth = payment + otherMonthly + pmiThisMonth
      paidAllIn += allInThisMonth
      paidNet += allInThisMonth - rentalIncomeMonthly
    }

    // Floating point leaves a few cents on the last payment either way.
    if (year === years) balance = Math.max(balance, 0)

    interestTotal += interestYear
    pmiTotal += pmiYear

    const homeValue = homePrice * Math.pow(1 + homeValueGrowthRate, year)
    const downPayment = homePrice * downPaymentPercent
    const equity = homeValue - balance

    rows.push({
      year,
      start_balance: round2(startBalance),
      principal_paid: round2(principalYear),
      interest_paid: round2(interestYear),
      pmi_paid: round2(pmiYear),
      all_in_monthly: round2(payment + otherMonthly + (month <= pmiMonths ? pmiMonthly : 0)),
      total_paid_to_date: round2(paidAllIn + downPayment),
      total_paid_after_rent_to_date: round2(paidNet + downPayment),
      payoff_today: round2(balance),
      end_balance: round2(balance),
      home_value: round2(homeValue),
      /*
       * What you would be up or down if you sold at the end of this year.
       *
       * The down payment is in here now, and its absence was the largest error
       * in the app. Equity minus what has been spent, with the deposit counted
       * as spent, because it is: eighty thousand dollars going in at the start
       * is eighty thousand dollars that is not in your account. Leaving it out
       * overstated every figure in this column by the whole deposit, for thirty
       * years, in the direction of buying looking better than it is.
       */
      profit_loss: round2(equity - (paidNet + downPayment)),
    })
  }

  return {
    monthlyPayment: payment,
    totalInterest: interestTotal,
    totalPmi: pmiTotal,
    pmiMonthly,
    pmiMonths,
    rows,
  }
}
