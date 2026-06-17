import type { FinancialAssumptions } from "@/app/lib/finance/types";

const IRR_MIN_RATE = -0.9999;
const IRR_MAX_RATE = 10;

export type FinanceEngineInput = FinancialAssumptions & {
  capacityMw: number;
  capex: number;
  opex: number;
  yieldMwh: number;
  tariff: number;
  debtRate: number;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  lcoe: number;
  dscr: number;
};

export type AnnualCashFlow = {
  year: number;
  productionMwh: number;
  revenueKeuro: number;
  opexKeuro: number;
  cashFlowKeuro: number;
  discountedCashFlowKeuro: number;
  debtServiceKeuro: number;
  dscr: number | null;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function discounted(value: number, year: number, rate: number) {
  return value / (1 + rate) ** year;
}

function calculateNpvAtRate(initialInvestment: number, cashFlows: number[], rate: number) {
  return cashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, rate),
    -initialInvestment,
  );
}

function calculateIrr(initialInvestment: number, cashFlows: number[]) {
  let low = IRR_MIN_RATE;
  let high = 1;
  let lowNpv = calculateNpvAtRate(initialInvestment, cashFlows, low);
  let highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);

  while (highNpv > 0 && high < IRR_MAX_RATE) {
    high *= 2;
    highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);
  }

  if (lowNpv * highNpv > 0) {
    return 0;
  }

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const midNpv = calculateNpvAtRate(initialInvestment, cashFlows, mid);

    if (Math.abs(midNpv) < 0.000001) {
      return mid;
    }

    if (lowNpv * midNpv <= 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }

  return (low + high) / 2;
}

function asRate(percent: number) {
  return percent / 100;
}

function calculateAnnualDebtService(
  initialDebt: number,
  debtInterestRate: number,
  debtMaturityYears: number,
) {
  if (initialDebt <= 0 || debtMaturityYears <= 0) {
    return 0;
  }

  // Debt is modeled as a constant annuity: same total debt service every year.
  if (debtInterestRate === 0) {
    return initialDebt / debtMaturityYears;
  }

  return (
    (initialDebt * debtInterestRate) /
    (1 - (1 + debtInterestRate) ** -debtMaturityYears)
  );
}

export function calculateAnnualCashFlows(input: FinanceEngineInput): AnnualCashFlow[] {
  const initialInvestment = input.capex * input.capacityMw;
  const initialDebt = initialInvestment * (input.debtRate / 100);
  const degradationRate = asRate(input.degradationRate);
  const discountRate = asRate(input.discountRate);
  const debtInterestRate = asRate(input.debtInterestRate);
  const annualDebtService = calculateAnnualDebtService(
    initialDebt,
    debtInterestRate,
    input.debtMaturityYears,
  );
  const annualOpex = input.opex * input.capacityMw;
  const rows: AnnualCashFlow[] = [];

  for (let year = 1; year <= input.projectLifeYears; year += 1) {
    const degradationFactor = (1 - degradationRate) ** (year - 1);

    // Production year N = yield MWh/MW/year * MW * annual degradation.
    const production = input.yieldMwh * input.capacityMw * degradationFactor;

    // Revenue kEUR = production MWh * tariff EUR/MWh / 1000.
    const revenue = (production * input.tariff) / 1000;

    // Annual OPEX kEUR = opex kEUR/MW/year * MW.
    // CFADS kEUR = revenue kEUR - annual OPEX kEUR.
    const cfads = revenue - annualOpex;
    const debtService = year <= input.debtMaturityYears ? annualDebtService : 0;

    rows.push({
      year,
      productionMwh: production,
      revenueKeuro: revenue,
      opexKeuro: annualOpex,
      cashFlowKeuro: cfads,
      discountedCashFlowKeuro: discounted(cfads, year, discountRate),
      debtServiceKeuro: debtService,
      dscr: debtService > 0 ? cfads / debtService : null,
    });
  }

  return rows;
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  // Initial investment kEUR = capex kEUR/MW * project capacity MW.
  const initialInvestment = input.capex * input.capacityMw;
  const annualCashFlows = calculateAnnualCashFlows(input);
  const cashFlows = annualCashFlows.map((row) => row.cashFlowKeuro);
  const discountedCashFlows = annualCashFlows.reduce(
    (total, row) => total + row.discountedCashFlowKeuro,
    0,
  );
  const discountedOpex = annualCashFlows.reduce(
    (total, row) => total + discounted(row.opexKeuro, row.year, asRate(input.discountRate)),
    0,
  );
  const discountedProduction = annualCashFlows.reduce(
    (total, row) =>
      total + discounted(row.productionMwh, row.year, asRate(input.discountRate)),
    0,
  );
  const dscrValues = annualCashFlows
    .map((row) => row.dscr)
    .filter((value): value is number => value !== null);

  // NPV kEUR = sum of discounted cash-flows - initial investment.
  const npv = discountedCashFlows - initialInvestment;

  // IRR % = rate that sets NPV to zero for the initial investment and annual flows.
  const irr = calculateIrr(initialInvestment, cashFlows) * 100;

  // LCOE EUR/MWh = discounted total cost kEUR / discounted production MWh * 1000.
  const lcoe =
    discountedProduction > 0
      ? ((initialInvestment + discountedOpex) / discountedProduction) * 1000
      : 0;

  // Minimum DSCR over the debt maturity. If there is no debt, DSCR is stored as 0.
  const dscr = dscrValues.length > 0 ? Math.min(...dscrValues) : 0;

  return {
    npv: round(npv),
    irr: round(irr),
    lcoe: round(lcoe),
    dscr: round(dscr),
  };
}
