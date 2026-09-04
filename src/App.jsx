import { useMemo, useState } from 'react'
import { buildSchedule, carryingCostsForYear, round2 } from './mortgage.js'
import { GLOSSARY, GLOSSARY_GROUPS, tooltipFor } from './glossary.js'
import { Info } from './Info.jsx'
import './App.css'

const DEFAULTS = {
  homePrice: 500000,
  downPaymentPercent: 10,
  rate30: 6.2,
  rate15: 5.75,
  propertyTaxRate: 2.23,
  hoaMonthly: 600,
  insuranceAnnual: 1526,
  pmiRate: 0.8,
  homeValueGrowthRate: 3.5,
  costInflationRate: 3,
  rentalIncomeMonthly: 0,
}

const INPUT_FIELDS = [
  {
    key: 'homePrice',
    label: 'Home price',
    unit: '$',
    step: '1000',
    min: '0',
    helper: 'Total purchase price of the home.',
  },
  {
    key: 'downPaymentPercent',
    label: 'Down payment',
    unit: '%',
    step: '0.1',
    min: '0',
    helper: 'Percent of price paid upfront.',
  },
  {
    key: 'rate30',
    info: 'interestRate',
    label: '30-year interest rate',
    unit: '%',
    step: '0.01',
    min: '0',
    helper: 'Annual rate for the 30-year loan.',
  },
  {
    key: 'rate15',
    info: 'interestRate',
    label: '15-year interest rate',
    unit: '%',
    step: '0.01',
    min: '0',
    helper: 'Annual rate for the 15-year loan.',
  },
  {
    key: 'propertyTaxRate',
    label: 'Property tax rate',
    unit: '%',
    step: '0.01',
    min: '0',
    helper: 'Effective annual property tax rate.',
  },
  {
    key: 'hoaMonthly',
    label: 'HOA fee',
    unit: '$ / mo',
    step: '10',
    min: '0',
    helper: 'Monthly homeowners association fee.',
  },
  {
    key: 'insuranceAnnual',
    label: 'Home insurance',
    unit: '$ / yr',
    step: '10',
    min: '0',
    helper: 'Annual homeowners insurance cost.',
  },
  {
    key: 'pmiRate',
    label: 'PMI rate',
    unit: '%',
    step: '0.01',
    min: '0',
    helper: 'Annual PMI rate if down payment is under 20%.',
  },
  {
    key: 'homeValueGrowthRate',
    label: 'Home value growth',
    unit: '% / yr',
    step: '0.1',
    min: '0',
    helper: 'Estimated annual appreciation rate.',
  },
  {
    key: 'costInflationRate',
    label: 'Cost inflation',
    unit: '% / yr',
    step: '0.1',
    min: '0',
    helper: 'Yearly rise in insurance and HOA. Tax follows the home value.',
  },
  {
    key: 'rentalIncomeMonthly',
    label: 'Rental income',
    unit: '$ / mo',
    step: '10',
    min: '0',
    helper: 'Monthly rent offset (optional).',
  },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const currencyFormatterShort = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatMoney = (value) => currencyFormatter.format(value)
const formatMoneyShort = (value) => currencyFormatterShort.format(value)
const formatPercent = (value) => `${value.toFixed(2)}%`

/**
 * PMI is the one line here that has an end date, so the label carries it.
 * A flat "$300.00" reads as a cost you pay forever, which is exactly the
 * impression the old maths gave and the reason the totals were so far out.
 */
const pmiLabel = (months) => {
  if (months <= 0) return 'PMI'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years <= 0) return `PMI (${months} mo, then $0)`
  const tail = rest > 0 ? ` ${rest} mo` : ''
  return `PMI (${years} yr${tail}, then $0)`
}

/**
 * The same output shape the page has always rendered, now assembled from the
 * tested functions in mortgage.js rather than worked out inline.
 *
 * The per-year figures come from a real month-by-month walk, so the totals here
 * are read off the last row rather than recomputed as `monthly x 12 x years`.
 * That shortcut was only ever right while nothing changed month to month, and
 * now PMI stops and the tax bill grows.
 */
const generateData = ({
  homePrice,
  downPaymentPercent,
  rate30,
  rate15,
  propertyTaxRate,
  hoaMonthly,
  insuranceAnnual,
  pmiRate,
  homeValueGrowthRate,
  costInflationRate,
  rentalIncomeMonthly,
}) => {
  const downPayment = homePrice * downPaymentPercent
  const loanAmount = Math.max(homePrice - downPayment, 0)

  const shared = {
    homePrice,
    downPaymentPercent,
    loan: loanAmount,
    propertyTaxRate,
    insuranceAnnual,
    hoaMonthly,
    pmiRate,
    homeValueGrowthRate,
    costInflationRate,
    rentalIncomeMonthly,
  }

  // Year one, which is what the summary cards show: the monthly figure somebody
  // would actually write a cheque for in the first twelve months.
  const firstYear = carryingCostsForYear({
    year: 1,
    homePrice,
    propertyTaxRate,
    insuranceAnnual,
    hoaMonthly,
    homeValueGrowthRate,
    costInflationRate,
  })

  const term = (annualRate, years) => {
    const built = buildSchedule({ ...shared, annualRate, years })
    const last = built.rows[built.rows.length - 1]
    const allIn =
      built.monthlyPayment +
      firstYear.propertyTaxMonthly +
      firstYear.insuranceMonthly +
      firstYear.hoaMonthly +
      built.pmiMonthly

    return {
      monthly_payment_principal_interest: round2(built.monthlyPayment),
      total_paid_principal_interest: round2(built.monthlyPayment * years * 12),
      total_interest: round2(built.totalInterest),
      total_pmi: round2(built.totalPmi),
      pmi_months: built.pmiMonths,
      property_tax_monthly: round2(firstYear.propertyTaxMonthly),
      hoa_monthly: round2(firstYear.hoaMonthly),
      insurance_monthly: round2(firstYear.insuranceMonthly),
      pmi_monthly: round2(built.pmiMonthly),
      all_in_monthly: round2(allIn),
      net_monthly_after_rent: round2(allIn - rentalIncomeMonthly),
      // Read off the walk, deposit included, rather than extrapolated.
      total_paid_all_in: last ? last.total_paid_to_date : round2(downPayment),
      total_paid_after_rent: last ? last.total_paid_after_rent_to_date : round2(downPayment),
      amortization_schedule: built.rows,
    }
  }

  return {
    assumptions: {
      home_price: round2(homePrice),
      down_payment: round2(downPayment),
      loan_amount: round2(loanAmount),
      down_payment_percent: downPaymentPercent,
      rate_30: rate30,
      rate_15: rate15,
      property_tax_rate: propertyTaxRate,
      hoa_monthly: round2(hoaMonthly),
      insurance_annual: round2(insuranceAnnual),
      pmi_rate: downPaymentPercent < 0.2 ? pmiRate : 0,
      home_value_growth_rate: homeValueGrowthRate,
      cost_inflation_rate: costInflationRate,
      rental_income_monthly: round2(rentalIncomeMonthly),
    },
    '30_year': term(rate30, 30),
    '15_year': term(rate15, 15),
  }
}

const SummaryCard = ({ title, accent, details, totals }) => (
  <section className={`card summary-card ${accent}`}>
    <header className="summary-header">
      <div>
        <p className="eyebrow">{title}</p>
        <h2>Payment mix</h2>
      </div>
      <span className="pill">{title}</span>
    </header>
    <dl className="metric-list">
      {details.map((item) => (
        <div key={item.label} className="metric">
          <dt>
            {item.label}
            <Info term={item.info} />
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
    <div className="summary-totals">
      {totals.map((item) => (
        <div key={item.label} className="total">
          <p>
            {item.label}
            <Info term={item.info} />
          </p>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  </section>
)

const ScheduleTable = ({ title, schedule }) => (
  <section className="card table-card">
    <header className="table-header">
      <h3>{title}</h3>
      <p>Annual amortization schedule.</p>
    </header>
    <div className="table-wrap">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Year</th>
            <th title={tooltipFor('startBalance')}>Start balance</th>
            <th title={tooltipFor('principalPaid')}>Principal paid</th>
            <th title={tooltipFor('interestPaid')}>Interest paid</th>
            <th title={tooltipFor('totalPaidToDate')}>Total paid to date (all-in)</th>
            <th title={tooltipFor('paidAfterRent')}>Paid after rent</th>
            <th title={tooltipFor('payoffToday')}>Payoff today</th>
            <th title={tooltipFor('homeValue')}>Home value</th>
            <th className="pl-col" title={tooltipFor('profitLoss')}>P/L</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              <td>{formatMoney(row.start_balance)}</td>
              <td>{formatMoney(row.principal_paid)}</td>
              <td>{formatMoney(row.interest_paid)}</td>
              <td>{formatMoney(row.total_paid_to_date)}</td>
              <td>{formatMoney(row.total_paid_after_rent_to_date)}</td>
              <td>{formatMoney(row.payoff_today)}</td>
              <td>{formatMoney(row.home_value)}</td>
              <td className="pl-col">{formatMoney(row.profit_loss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

/**
 * Every definition in one place, open by default.
 *
 * The popovers answer a question you already knew you had. This is for the
 * reader who does not yet know which of these numbers is the one that will
 * surprise them, and it is also where the table columns are explained, since a
 * popover inside a horizontally scrolling table would be clipped by it.
 */
const Glossary = () => (
  <section className="card glossary reveal">
    <header className="table-header">
      <h3>What these mean</h3>
      <p>The assumptions behind each figure, written down so you can argue with them.</p>
    </header>
    <div className="glossary-groups">
      {GLOSSARY_GROUPS.map((group) => (
        <div key={group.title} className="glossary-group">
          <h4>{group.title}</h4>
          <dl>
            {group.keys.map((key) => (
              <div key={key} className="glossary-entry">
                <dt>{GLOSSARY[key].term}</dt>
                <dd>
                  {GLOSSARY[key].what}
                  {GLOSSARY[key].note && <em>{GLOSSARY[key].note}</em>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  </section>
)

function App() {
  const [form, setForm] = useState(DEFAULTS)

  const data = useMemo(() => {
    const homePrice = Math.max(parseNumber(form.homePrice, 0), 0)
    const downPaymentPercent = clamp(parseNumber(form.downPaymentPercent, 0), 0, 100) / 100
    const rate30 = Math.max(parseNumber(form.rate30, 0), 0) / 100
    const rate15 = Math.max(parseNumber(form.rate15, 0), 0) / 100
    const propertyTaxRate = Math.max(parseNumber(form.propertyTaxRate, 0), 0) / 100
    const hoaMonthly = Math.max(parseNumber(form.hoaMonthly, 0), 0)
    const insuranceAnnual = Math.max(parseNumber(form.insuranceAnnual, 0), 0)
    const pmiRate = Math.max(parseNumber(form.pmiRate, 0), 0) / 100
    const homeValueGrowthRate = Math.max(parseNumber(form.homeValueGrowthRate, 0), 0) / 100
    const costInflationRate = Math.max(parseNumber(form.costInflationRate, 0), 0) / 100
    const rentalIncomeMonthly = Math.max(parseNumber(form.rentalIncomeMonthly, 0), 0)

    return generateData({
      homePrice,
      downPaymentPercent,
      rate30,
      rate15,
      propertyTaxRate,
      hoaMonthly,
      insuranceAnnual,
      pmiRate,
      homeValueGrowthRate,
      costInflationRate,
      rentalIncomeMonthly,
    })
  }, [form])

  const assumptions = data.assumptions
  const data30 = data['30_year']
  const data15 = data['15_year']
  // Summed from the month-by-month walk, not extrapolated from month one.
  const totalAllIn30 = data30.total_paid_all_in
  const totalNet30 = data30.total_paid_after_rent
  const totalAllIn15 = data15.total_paid_all_in
  const totalNet15 = data15.total_paid_after_rent

  const handleChange = (key) => (event) => {
    setForm((prev) => ({
      ...prev,
      [key]: event.target.value,
    }))
  }

  const handleReset = () => {
    setForm(DEFAULTS)
  }

  return (
    <div className="app">
      <header className="hero reveal">
        <p className="eyebrow">Mortgage atlas</p>
        <h1>Trace your monthly reality before you sign.</h1>
        <p className="subhead">
          Adjust each assumption to see the monthly payment blend, all-in costs,
          and the long-run interest totals for 30 and 15 year loans.
        </p>
      </header>

      <section className="layout reveal">
        <form className="card inputs" onSubmit={(event) => event.preventDefault()}>
          <div className="card-header">
            <div>
              <h2>Scenario inputs</h2>
              <p>Update the fields to match your deal sheet.</p>
            </div>
            <button type="button" onClick={handleReset}>
              Reset defaults
            </button>
          </div>
          <div className="input-grid">
            {INPUT_FIELDS.map((field) => (
              <label key={field.key} className="field">
                <span>
                  {field.label}
                  <Info term={field.info ?? field.key} />
                </span>
                <div className="field-control">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={field.min}
                    value={form[field.key]}
                    onChange={handleChange(field.key)}
                  />
                  <span className="unit">{field.unit}</span>
                </div>
                <small>{field.helper}</small>
              </label>
            ))}
          </div>
        </form>

        <section className="card assumptions">
          <h2>Assumptions snapshot</h2>
          <p>Derived values based on your input mix.</p>
          <dl className="metric-list">
            <div className="metric">
              <dt>Down payment</dt>
              <dd>{formatMoneyShort(assumptions.down_payment)}</dd>
            </div>
            <div className="metric">
              <dt>Loan amount</dt>
              <dd>{formatMoneyShort(assumptions.loan_amount)}</dd>
            </div>
            <div className="metric">
              <dt>Down payment rate</dt>
              <dd>{formatPercent(assumptions.down_payment_percent * 100)}</dd>
            </div>
            <div className="metric">
              <dt>Property tax rate</dt>
              <dd>{formatPercent(assumptions.property_tax_rate * 100)}</dd>
            </div>
            <div className="metric">
              <dt>PMI rate</dt>
              <dd>{formatPercent(assumptions.pmi_rate * 100)}</dd>
            </div>
            <div className="metric">
              <dt>Home growth rate</dt>
              <dd>{formatPercent(assumptions.home_value_growth_rate * 100)}</dd>
            </div>
            <div className="metric">
              <dt>Rental offset</dt>
              <dd>{formatMoney(assumptions.rental_income_monthly)}</dd>
            </div>
          </dl>
          <p className="note">PMI is set to $0 once the down payment reaches 20%.</p>
        </section>
      </section>

      <section className="summary-grid reveal">
        <SummaryCard
          title="30 year"
          accent="accent-warm"
          details={[
            { label: 'Monthly P + I', value: formatMoney(data30.monthly_payment_principal_interest), info: 'monthlyPI' },
            { label: 'Property tax (yr 1)', value: formatMoney(data30.property_tax_monthly), info: 'propertyTaxRate' },
            { label: 'HOA (yr 1)', value: formatMoney(data30.hoa_monthly), info: 'hoaMonthly' },
            { label: 'Insurance (yr 1)', value: formatMoney(data30.insurance_monthly), info: 'insuranceAnnual' },
            { label: pmiLabel(data30.pmi_months), value: formatMoney(data30.pmi_monthly), info: 'pmiRate' },
            { label: 'All-in monthly', value: formatMoney(data30.all_in_monthly), info: 'allInMonthly' },
            { label: 'Net after rent', value: formatMoney(data30.net_monthly_after_rent), info: 'netAfterRent' },
          ]}
          totals={[
            { label: 'Total interest paid', value: formatMoneyShort(data30.total_interest), info: 'totalInterest' },
            { label: 'Total PMI paid', value: formatMoneyShort(data30.total_pmi), info: 'totalPmi' },
            { label: 'Total paid (P + I)', value: formatMoneyShort(data30.total_paid_principal_interest), info: 'totalPI' },
            { label: 'Total out of pocket', value: formatMoneyShort(totalAllIn30), info: 'totalOutOfPocket' },
            { label: 'Out of pocket after rent', value: formatMoneyShort(totalNet30), info: 'netAfterRent' },
          ]}
        />
        <SummaryCard
          title="15 year"
          accent="accent-cool"
          details={[
            { label: 'Monthly P + I', value: formatMoney(data15.monthly_payment_principal_interest), info: 'monthlyPI' },
            { label: 'Property tax (yr 1)', value: formatMoney(data15.property_tax_monthly), info: 'propertyTaxRate' },
            { label: 'HOA (yr 1)', value: formatMoney(data15.hoa_monthly), info: 'hoaMonthly' },
            { label: 'Insurance (yr 1)', value: formatMoney(data15.insurance_monthly), info: 'insuranceAnnual' },
            { label: pmiLabel(data15.pmi_months), value: formatMoney(data15.pmi_monthly), info: 'pmiRate' },
            { label: 'All-in monthly', value: formatMoney(data15.all_in_monthly), info: 'allInMonthly' },
            { label: 'Net after rent', value: formatMoney(data15.net_monthly_after_rent), info: 'netAfterRent' },
          ]}
          totals={[
            { label: 'Total interest paid', value: formatMoneyShort(data15.total_interest), info: 'totalInterest' },
            { label: 'Total PMI paid', value: formatMoneyShort(data15.total_pmi), info: 'totalPmi' },
            { label: 'Total paid (P + I)', value: formatMoneyShort(data15.total_paid_principal_interest), info: 'totalPI' },
            { label: 'Total out of pocket', value: formatMoneyShort(totalAllIn15), info: 'totalOutOfPocket' },
            { label: 'Out of pocket after rent', value: formatMoneyShort(totalNet15), info: 'netAfterRent' },
          ]}
        />
      </section>

      <section className="tables-grid reveal">
        <ScheduleTable title="30 year schedule" schedule={data30.amortization_schedule} />
        <ScheduleTable title="15 year schedule" schedule={data15.amortization_schedule} />
      </section>

      <Glossary />

      <footer className="footnote reveal">
        <p>
          This is a planning tool, not financial advice. Adjust for local taxes,
          insurance, and fees that are unique to your lender and property.
        </p>
        <p className="colophon">
          Built by{' '}
          <a href="https://negiventures.com" target="_blank" rel="noreferrer">
            Negi Ventures
          </a>
          {' · '}
          <a
            href="https://github.com/negiadventures/mortgage-atlas"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
