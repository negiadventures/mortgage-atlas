import { useMemo, useState } from 'react'
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
    label: '30-year interest rate',
    unit: '%',
    step: '0.01',
    min: '0',
    helper: 'Annual rate for the 30-year loan.',
  },
  {
    key: 'rate15',
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

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatMoney = (value) => currencyFormatter.format(value)
const formatMoneyShort = (value) => currencyFormatterShort.format(value)
const formatPercent = (value) => `${value.toFixed(2)}%`

const computeMortgage = (loan, rate, years) => {
  const monthlyRate = rate / 12
  const numPayments = years * 12

  let monthlyPayment = 0
  if (rate <= 0) {
    monthlyPayment = loan / numPayments
  } else {
    monthlyPayment = loan * monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments))
  }

  const totalPaid = monthlyPayment * numPayments
  const totalInterest = totalPaid - loan

  const schedule = []
  let balance = loan

  for (let year = 1; year <= years; year += 1) {
    const startBalance = balance
    let principalPaidYear = 0
    let interestPaidYear = 0

    for (let month = 0; month < 12; month += 1) {
      const interestPayment = balance * monthlyRate
      const principalPayment = monthlyPayment - interestPayment
      principalPaidYear += principalPayment
      interestPaidYear += interestPayment
      balance -= principalPayment
    }

    if (year === years) {
      balance = Math.max(balance, 0)
    }

    schedule.push({
      year,
      start_balance: round2(startBalance),
      principal_paid: round2(principalPaidYear),
      interest_paid: round2(interestPaidYear),
      end_balance: round2(balance),
    })
  }

  return [monthlyPayment, totalPaid, totalInterest, schedule]
}

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
  rentalIncomeMonthly,
}) => {
  const downPayment = homePrice * downPaymentPercent
  const loanAmount = Math.max(homePrice - downPayment, 0)

  const propertyTaxMonthly = homePrice * propertyTaxRate / 12
  const insuranceMonthly = insuranceAnnual / 12
  const pmiMonthly = downPaymentPercent < 0.2 ? loanAmount * pmiRate / 12 : 0

  const [monthlyPayment30, totalPaid30, totalInterest30, schedule30] =
    computeMortgage(loanAmount, rate30, 30)
  const allIn30 = monthlyPayment30 + propertyTaxMonthly + hoaMonthly + insuranceMonthly + pmiMonthly
  const netMonthly30 = allIn30 - rentalIncomeMonthly

  const [monthlyPayment15, totalPaid15, totalInterest15, schedule15] =
    computeMortgage(loanAmount, rate15, 15)
  const allIn15 = monthlyPayment15 + propertyTaxMonthly + hoaMonthly + insuranceMonthly + pmiMonthly
  const netMonthly15 = allIn15 - rentalIncomeMonthly

  const addScheduleExtras = (schedule, allInMonthly, netMonthly) => {
    return schedule.map((row) => {
      const cumulativeAllIn = allInMonthly * 12 * row.year
      const cumulativeNet = netMonthly * 12 * row.year
      const homeValue = homePrice * Math.pow(1 + homeValueGrowthRate, row.year)

      return {
        ...row,
        total_paid_to_date: round2(cumulativeAllIn),
        total_paid_after_rent_to_date: round2(cumulativeNet),
        payoff_today: round2(row.end_balance),
        home_value: round2(homeValue),
        profit_loss: round2(homeValue - row.end_balance - cumulativeNet),
      }
    })
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
      rental_income_monthly: round2(rentalIncomeMonthly),
    },
    '30_year': {
      monthly_payment_principal_interest: round2(monthlyPayment30),
      total_paid_principal_interest: round2(totalPaid30),
      total_interest: round2(totalInterest30),
      property_tax_monthly: round2(propertyTaxMonthly),
      hoa_monthly: round2(hoaMonthly),
      insurance_monthly: round2(insuranceMonthly),
      pmi_monthly: round2(pmiMonthly),
      all_in_monthly: round2(allIn30),
      net_monthly_after_rent: round2(netMonthly30),
      amortization_schedule: addScheduleExtras(schedule30, allIn30, netMonthly30),
    },
    '15_year': {
      monthly_payment_principal_interest: round2(monthlyPayment15),
      total_paid_principal_interest: round2(totalPaid15),
      total_interest: round2(totalInterest15),
      property_tax_monthly: round2(propertyTaxMonthly),
      hoa_monthly: round2(hoaMonthly),
      insurance_monthly: round2(insuranceMonthly),
      pmi_monthly: round2(pmiMonthly),
      all_in_monthly: round2(allIn15),
      net_monthly_after_rent: round2(netMonthly15),
      amortization_schedule: addScheduleExtras(schedule15, allIn15, netMonthly15),
    },
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
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
    <div className="summary-totals">
      {totals.map((item) => (
        <div key={item.label} className="total">
          <p>{item.label}</p>
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
            <th>Start balance</th>
            <th>Principal paid</th>
            <th>Interest paid</th>
            <th>Total paid to date (all-in)</th>
            <th>Paid after rent</th>
            <th>Payoff today</th>
            <th>Home value</th>
            <th className="pl-col">P/L</th>
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
      rentalIncomeMonthly,
    })
  }, [form])

  const assumptions = data.assumptions
  const data30 = data['30_year']
  const data15 = data['15_year']
  const totalAllIn30 = data30.all_in_monthly * 12 * 30
  const totalNet30 = data30.net_monthly_after_rent * 12 * 30
  const totalAllIn15 = data15.all_in_monthly * 12 * 15
  const totalNet15 = data15.net_monthly_after_rent * 12 * 15

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
                <span>{field.label}</span>
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
            { label: 'Monthly P + I', value: formatMoney(data30.monthly_payment_principal_interest) },
            { label: 'Property tax', value: formatMoney(data30.property_tax_monthly) },
            { label: 'HOA', value: formatMoney(data30.hoa_monthly) },
            { label: 'Insurance', value: formatMoney(data30.insurance_monthly) },
            { label: 'PMI', value: formatMoney(data30.pmi_monthly) },
            { label: 'All-in monthly', value: formatMoney(data30.all_in_monthly) },
            { label: 'Net after rent', value: formatMoney(data30.net_monthly_after_rent) },
          ]}
          totals={[
            { label: 'Total interest paid', value: formatMoneyShort(data30.total_interest) },
            { label: 'Total paid (P + I)', value: formatMoneyShort(data30.total_paid_principal_interest) },
            { label: 'Total paid (all-in)', value: formatMoneyShort(totalAllIn30) },
            { label: 'Total paid after rent', value: formatMoneyShort(totalNet30) },
          ]}
        />
        <SummaryCard
          title="15 year"
          accent="accent-cool"
          details={[
            { label: 'Monthly P + I', value: formatMoney(data15.monthly_payment_principal_interest) },
            { label: 'Property tax', value: formatMoney(data15.property_tax_monthly) },
            { label: 'HOA', value: formatMoney(data15.hoa_monthly) },
            { label: 'Insurance', value: formatMoney(data15.insurance_monthly) },
            { label: 'PMI', value: formatMoney(data15.pmi_monthly) },
            { label: 'All-in monthly', value: formatMoney(data15.all_in_monthly) },
            { label: 'Net after rent', value: formatMoney(data15.net_monthly_after_rent) },
          ]}
          totals={[
            { label: 'Total interest paid', value: formatMoneyShort(data15.total_interest) },
            { label: 'Total paid (P + I)', value: formatMoneyShort(data15.total_paid_principal_interest) },
            { label: 'Total paid (all-in)', value: formatMoneyShort(totalAllIn15) },
            { label: 'Total paid after rent', value: formatMoneyShort(totalNet15) },
          ]}
        />
      </section>

      <section className="tables-grid reveal">
        <ScheduleTable title="30 year schedule" schedule={data30.amortization_schedule} />
        <ScheduleTable title="15 year schedule" schedule={data15.amortization_schedule} />
      </section>

      <footer className="footnote reveal">
        <p>
          This is a planning tool, not financial advice. Adjust for local taxes,
          insurance, and fees that are unique to your lender and property.
        </p>
      </footer>
    </div>
  )
}

export default App
