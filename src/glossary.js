/**
 * What every figure on the page actually means.
 *
 * Kept as data rather than as text scattered through the markup, so the same
 * wording serves the popovers next to each field, the tooltips on the table
 * headers, and the glossary at the bottom. Three copies of a definition is how
 * two of them end up out of date.
 *
 * Each entry says what the number is and, where it matters, what this app
 * assumes about it. The assumptions are the part worth writing down: a
 * mortgage projection is mostly assumptions wearing the costume of a
 * calculation, and a reader who cannot see them cannot argue with them.
 */

export const GLOSSARY = {
  homePrice: {
    term: 'Home price',
    what: 'The agreed purchase price. Everything else on the page is derived from this, including the loan, the tax bill and the point PMI stops.',
  },
  downPaymentPercent: {
    term: 'Down payment',
    what: 'What you pay upfront, as a percentage of the price. It reduces the loan, and at 20% or more it removes PMI entirely.',
    note: 'Counted as money spent. A deposit is not free just because it turns into equity, so it comes off the profit column from year one.',
  },
  interestRate: {
    term: 'Interest rate',
    what: 'The annual rate on the loan. The monthly payment comes from the standard level-payment formula, so the payment stays flat while the split between interest and principal shifts toward principal over time.',
    note: 'A fixed rate. Nothing here models an adjustable one.',
  },
  propertyTaxRate: {
    term: 'Property tax rate',
    what: 'Your effective annual rate, meaning tax actually billed divided by value, not the headline rate before exemptions.',
    note: 'Charged against the growing home value rather than the purchase price, so the tax bill rises every year the house does.',
  },
  hoaMonthly: {
    term: 'HOA fee',
    what: 'Monthly dues to a homeowners association, if there is one. Set it to zero if there is not.',
    note: 'Grows with the cost inflation rate. Dues almost never stay flat for thirty years.',
  },
  insuranceAnnual: {
    term: 'Home insurance',
    what: 'Annual premium for the homeowners policy your lender will require. Divided by twelve for the monthly figures.',
    note: 'Grows with the cost inflation rate.',
  },
  pmiRate: {
    term: 'PMI rate',
    what: 'Private mortgage insurance, charged annually as a percentage of the loan when you put down less than 20%. It protects the lender, not you.',
    note: 'It stops. Once the balance reaches 80% of the purchase price the charge drops to zero, and the payment mix shows the month that happens. Measured against the price you paid, not the projected value, which is what lenders use for automatic termination.',
  },
  homeValueGrowthRate: {
    term: 'Home value growth',
    what: 'Annual appreciation, compounded. It drives both the home value column and, because tax follows the assessed value, the tax bill.',
    note: 'The least knowable number on this page. Try it at zero, and try it at half what you expect, before you trust any profit figure.',
  },
  costInflationRate: {
    term: 'Cost inflation',
    what: 'How fast insurance and HOA dues rise each year. Property tax is not included here, because it follows the home value instead.',
    note: 'Set both this and home value growth to zero to see the deal in flat, uninflated terms.',
  },
  rentalIncomeMonthly: {
    term: 'Rental income',
    what: 'Monthly rent the property brings in, if you are letting it or part of it. Subtracted from the monthly cost to give the net figures.',
    note: 'Assumed constant, and assumed to arrive every month. No vacancy, no management fee, no missed payment.',
  },

  monthlyPI: {
    term: 'Monthly P + I',
    what: 'Principal and interest only. The payment to the lender, before tax, insurance, dues or PMI.',
  },
  allInMonthly: {
    term: 'All-in monthly',
    what: 'Principal, interest, property tax, insurance, HOA and PMI together. The number worth comparing against rent.',
    note: 'Shown for year one. It falls when PMI stops and rises as tax and dues grow, so later years differ.',
  },
  netAfterRent: {
    term: 'Net after rent',
    what: 'The all-in monthly cost with rental income subtracted.',
  },
  totalInterest: {
    term: 'Total interest paid',
    what: 'Every dollar of interest over the full term. The gap between the 30 and 15 year figures is the real price of the lower monthly payment.',
  },
  totalPmi: {
    term: 'Total PMI paid',
    what: 'PMI from the first payment until the balance reaches 80% of the purchase price. Zero if you put 20% down.',
  },
  totalPI: {
    term: 'Total paid (P + I)',
    what: 'The monthly principal and interest payment multiplied across the whole term. Loan plus total interest.',
  },
  totalOutOfPocket: {
    term: 'Total out of pocket',
    what: 'Everything you pay over the term: the deposit, plus principal, interest, tax, insurance, HOA and PMI.',
    note: 'Summed month by month, not estimated from the first payment, because the monthly figure changes as PMI stops and costs grow.',
  },

  startBalance: {
    term: 'Start balance',
    what: 'What you still owe at the beginning of that year.',
  },
  principalPaid: {
    term: 'Principal paid',
    what: 'How much of that year’s payments went to the debt itself. Small early on and large late, which is why selling in year three feels like nothing happened.',
  },
  interestPaid: {
    term: 'Interest paid',
    what: 'How much of that year’s payments went to the lender as the cost of borrowing.',
  },
  totalPaidToDate: {
    term: 'Total paid to date (all-in)',
    what: 'Everything spent from purchase through the end of that year, deposit included.',
  },
  paidAfterRent: {
    term: 'Paid after rent',
    what: 'The same running total with rental income subtracted.',
  },
  payoffToday: {
    term: 'Payoff today',
    what: 'What it would take to clear the loan at the end of that year, ignoring any early repayment charge your lender may apply.',
  },
  homeValue: {
    term: 'Home value',
    what: 'The purchase price grown at the appreciation rate. A projection, not a valuation.',
  },
  profitLoss: {
    term: 'P/L',
    what: 'Equity, meaning home value minus what you owe, less every dollar you have put in including the deposit.',
    note: 'This is cost of ownership against equity, not a rent versus buy answer. It stays negative in most scenarios because it counts interest, tax and insurance as spent, which they are, while the money you would have paid a landlord instead is not credited back. Use the rental income field for that comparison.',
  },
}

/** The order the glossary section reads in, grouped the way the page is laid out. */
export const GLOSSARY_GROUPS = [
  {
    title: 'What you put in',
    keys: [
      'homePrice',
      'downPaymentPercent',
      'interestRate',
      'propertyTaxRate',
      'hoaMonthly',
      'insuranceAnnual',
      'pmiRate',
      'homeValueGrowthRate',
      'costInflationRate',
      'rentalIncomeMonthly',
    ],
  },
  {
    title: 'The monthly and lifetime figures',
    keys: [
      'monthlyPI',
      'allInMonthly',
      'netAfterRent',
      'totalInterest',
      'totalPmi',
      'totalPI',
      'totalOutOfPocket',
    ],
  },
  {
    title: 'The year by year table',
    keys: [
      'startBalance',
      'principalPaid',
      'interestPaid',
      'totalPaidToDate',
      'paidAfterRent',
      'payoffToday',
      'homeValue',
      'profitLoss',
    ],
  },
]

/** One string, for a native tooltip where a popover would be clipped. */
export const tooltipFor = (key) => {
  const entry = GLOSSARY[key]
  if (!entry) return undefined
  return entry.note ? `${entry.what}\n\n${entry.note}` : entry.what
}
