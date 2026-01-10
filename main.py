#!/usr/bin/env python3
"""
nj_mortgage_analysis.py
========================

This module provides a function to calculate mortgage and housing cost
projections for a home purchase in New Jersey.  It is designed to be
parameterised with sensible defaults based on publicly available data
about mortgage rates, property taxes, homeowners association (HOA)
fees, insurance costs and private mortgage insurance (PMI) rates.

The primary entry point is the ``generate_data`` function, which
accepts a handful of keyword arguments and returns a nested
``dict`` containing monthly payments, total cost summaries and a
year‑by‑year amortisation schedule for both 30‑year and 15‑year loan
terms.  The data can be serialised to JSON for downstream
consumption.

Defaults reflect average conditions in early 2026:

* ``home_price`` – defaults to $500 000, a typical single‑family home price in
  New Jersey.
* ``down_payment_percent`` – 0.10 (10 %) down payment.
* ``rate_30`` – 0.0620 (6.20 %) annual interest rate for a 30‑year fixed
  mortgage (see Mortgage News Daily’s current mortgage rates table【250783368567141†L136-L143】).
* ``rate_15`` – 0.0575 (5.75 %) annual interest rate for a 15‑year fixed
  mortgage【250783368567141†L136-L143】.
* ``property_tax_rate`` – 0.0223 (2.23 %) effective property tax rate, the
  statewide median effective rate for New Jersey in 2023【230180002480540†L130-L137】.
* ``hoa_monthly`` – $600 per month, the midpoint of the commonly cited $500–$700
  HOA fee range for New Jersey communities【226681309865418†L158-L163】.
* ``insurance_annual`` – $1 526 per year (≈$127 per month), the average cost of
  homeowners insurance in New Jersey in 2026 for a $300 000 dwelling【11490860115313†L177-L188】.
* ``pmi_rate`` – 0.008 (0.8 %), reflecting a typical private mortgage
  insurance rate falling roughly in the middle of the 0.46–1.50 % range
  reported by the Urban Institute【252852515396704†L920-L927】.
* ``rental_income_monthly`` – 0.0 by default; set this to the monthly
  rental income if you intend to offset housing costs with a
  basement rental.  Median one‑bedroom rents in New Jersey are
  approximately $2 000 per month【81208738341633†L67-L95】.

The amortisation schedule produced by this module aggregates
principal and interest payments on an annual basis for readability.

Usage example from the command line:

```
python nj_mortgage_analysis.py --home_price 500000 --down_payment_percent 0.1 \
    --rate_30 0.062 --rate_15 0.0575 --hoa_monthly 600 --rental_income_monthly 1500
```

This will emit a JSON document describing payments for both loan
lengths given the supplied assumptions.
"""

from __future__ import annotations

import argparse
import json
from typing import Dict, List, Tuple


def compute_mortgage(loan: float, rate: float, years: int) -> Tuple[float, float, float, List[Dict[str, float]]]:
    """Compute monthly payment, total paid, total interest and a yearly
    amortisation schedule for a fixed‑rate mortgage.

    Parameters
    ----------
    loan : float
        The principal loan amount (in dollars).
    rate : float
        The annual nominal interest rate as a decimal (e.g. 0.062 for 6.2 %).
    years : int
        Length of the loan in years (e.g. 30 or 15).

    Returns
    -------
    monthly_payment : float
        Monthly principal‑and‑interest payment.
    total_paid : float
        Total amount paid over the life of the loan (principal plus interest).
    total_interest : float
        Total interest paid over the life of the loan.
    schedule : list of dict
        A list of annual amortisation entries.  Each entry contains the
        starting balance, principal paid, interest paid and ending balance
        for that year.  Balances are rounded to two decimal places.
    """
    # convert annual rate to monthly and number of payments
    monthly_rate: float = rate / 12.0
    num_payments: int = years * 12

    if rate == 0:
        # simple division if there is no interest
        monthly_payment = loan / num_payments
    else:
        monthly_payment = loan * monthly_rate / (1.0 - (1.0 + monthly_rate) ** (-num_payments))

    total_paid = monthly_payment * num_payments
    total_interest = total_paid - loan

    # Generate amortisation schedule aggregated by year
    schedule: List[Dict[str, float]] = []
    balance = loan
    for year in range(1, years + 1):
        principal_paid_year = 0.0
        interest_paid_year = 0.0
        for _ in range(12):
            # interest for current month
            interest_payment = balance * monthly_rate
            principal_payment = monthly_payment - interest_payment
            principal_paid_year += principal_payment
            interest_paid_year += interest_payment
            balance -= principal_payment
        # ensure final year ends with zero or near zero
        if year == years:
            balance = max(balance, 0.0)
        schedule.append(
            {
                "year": year,
                "start_balance": round(loan if year == 1 else schedule[-1]["end_balance"], 2)
                if year > 1
                else round(loan, 2),
                "principal_paid": round(principal_paid_year, 2),
                "interest_paid": round(interest_paid_year, 2),
                "end_balance": round(balance, 2),
            }
        )
    return monthly_payment, total_paid, total_interest, schedule


def generate_data(
    home_price: float = 500_000.0,
    down_payment_percent: float = 0.10,
    rate_30: float = 0.0620,
    rate_15: float = 0.0575,
    property_tax_rate: float = 0.0223,
    hoa_monthly: float = 600.0,
    insurance_annual: float = 1_526.0,
    pmi_rate: float = 0.008,
    rental_income_monthly: float = 0.0,
) -> Dict[str, object]:
    """Generate mortgage and housing cost projections as a nested dictionary.

    All monetary inputs and outputs are expressed in dollars.  The function
    computes values for both a 30‑year and a 15‑year fixed‑rate mortgage.

    Parameters mirror those in the module docstring.  If a down payment of
    20 % or greater is supplied, PMI is automatically set to zero.

    Returns
    -------
    dict
        A mapping containing the assumptions and per‑term results.
    """
    # derive amounts
    down_payment: float = home_price * down_payment_percent
    loan_amount: float = home_price - down_payment

    # property tax, insurance and PMI on a monthly basis
    property_tax_monthly: float = home_price * property_tax_rate / 12.0
    insurance_monthly: float = insurance_annual / 12.0
    pmi_monthly: float = loan_amount * pmi_rate / 12.0 if down_payment_percent < 0.20 else 0.0

    # compute 30‑year mortgage
    monthly_payment_30, total_paid_30, total_interest_30, schedule_30 = compute_mortgage(loan_amount, rate_30, 30)
    all_in_30: float = monthly_payment_30 + property_tax_monthly + hoa_monthly + insurance_monthly + pmi_monthly
    net_monthly_30: float = all_in_30 - rental_income_monthly

    # compute 15‑year mortgage
    monthly_payment_15, total_paid_15, total_interest_15, schedule_15 = compute_mortgage(loan_amount, rate_15, 15)
    all_in_15: float = monthly_payment_15 + property_tax_monthly + hoa_monthly + insurance_monthly + pmi_monthly
    net_monthly_15: float = all_in_15 - rental_income_monthly

    return {
        "assumptions": {
            "home_price": round(home_price, 2),
            "down_payment": round(down_payment, 2),
            "loan_amount": round(loan_amount, 2),
            "down_payment_percent": down_payment_percent,
            "rate_30": rate_30,
            "rate_15": rate_15,
            "property_tax_rate": property_tax_rate,
            "hoa_monthly": hoa_monthly,
            "insurance_annual": insurance_annual,
            "pmi_rate": pmi_rate if down_payment_percent < 0.20 else 0.0,
            "rental_income_monthly": rental_income_monthly,
        },
        "30_year": {
            "monthly_payment_principal_interest": round(monthly_payment_30, 2),
            "total_paid_principal_interest": round(total_paid_30, 2),
            "total_interest": round(total_interest_30, 2),
            "property_tax_monthly": round(property_tax_monthly, 2),
            "hoa_monthly": round(hoa_monthly, 2),
            "insurance_monthly": round(insurance_monthly, 2),
            "pmi_monthly": round(pmi_monthly, 2),
            "all_in_monthly": round(all_in_30, 2),
            "net_monthly_after_rent": round(net_monthly_30, 2),
            "amortization_schedule": schedule_30,
        },
        "15_year": {
            "monthly_payment_principal_interest": round(monthly_payment_15, 2),
            "total_paid_principal_interest": round(total_paid_15, 2),
            "total_interest": round(total_interest_15, 2),
            "property_tax_monthly": round(property_tax_monthly, 2),
            "hoa_monthly": round(hoa_monthly, 2),
            "insurance_monthly": round(insurance_monthly, 2),
            "pmi_monthly": round(pmi_monthly, 2),
            "all_in_monthly": round(all_in_15, 2),
            "net_monthly_after_rent": round(net_monthly_15, 2),
            "amortization_schedule": schedule_15,
        },
    }


def main() -> None:
    """Command line entry point for the module.  Parses arguments and prints
    the resulting JSON to stdout."""
    parser = argparse.ArgumentParser(
        description=(
            "Generate mortgage payment and housing cost projections for a New "
            "Jersey home purchase.  See the module docstring for default "
            "assumptions.  All rates should be provided as decimals (e.g. "
            "0.062 for 6.2%)."
        )
    )
    parser.add_argument("--home_price", type=float, default=500_000.0, help="Total home price in dollars")
    parser.add_argument(
        "--down_payment_percent",
        type=float,
        default=0.10,
        help="Down payment as a fraction of home price (0–1).",
    )
    parser.add_argument(
        "--rate_30",
        type=float,
        default=0.0620,
        help="Annual interest rate (decimal) for a 30‑year fixed mortgage",
    )
    parser.add_argument(
        "--rate_15",
        type=float,
        default=0.0575,
        help="Annual interest rate (decimal) for a 15‑year fixed mortgage",
    )
    parser.add_argument(
        "--property_tax_rate",
        type=float,
        default=0.0223,
        help="Effective property tax rate as a fraction of home value",
    )
    parser.add_argument(
        "--hoa_monthly",
        type=float,
        default=600.0,
        help="Monthly homeowners association fee",
    )
    parser.add_argument(
        "--insurance_annual",
        type=float,
        default=1_526.0,
        help="Annual homeowners insurance cost",
    )
    parser.add_argument(
        "--pmi_rate",
        type=float,
        default=0.008,
        help=(
            "Annual private mortgage insurance rate (0–1).  This is applied "
            "only if the down payment is less than 20%.  For example, "
            "0.008 represents 0.8% of the loan amount per year."
        ),
    )
    parser.add_argument(
        "--rental_income_monthly",
        type=float,
        default=0.0,
        help="Optional monthly rental income offset (e.g. basement rental)",
    )
    args = parser.parse_args()
    data = generate_data(
        home_price=args.home_price,
        down_payment_percent=args.down_payment_percent,
        rate_30=args.rate_30,
        rate_15=args.rate_15,
        property_tax_rate=args.property_tax_rate,
        hoa_monthly=args.hoa_monthly,
        insurance_annual=args.insurance_annual,
        pmi_rate=args.pmi_rate,
        rental_income_monthly=args.rental_income_monthly,
    )
    json.dump(data, fp=sys.stdout, indent=2)


if __name__ == "__main__":
    import sys
    main()
