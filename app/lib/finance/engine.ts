import type {
  DebtScheduleItem,
  DscrTranche,
  FinancialAssumptions,
  SizingResult,
} from "@/app/lib/finance/types";

const IRR_MIN_RATE = -0.9999;
const IRR_MAX_RATE = 10;
const DSCR_FALLBACK = 1.3;

export type FinanceEngineInput = FinancialAssumptions & {
  capacityMw: number;
  capex: number;
  opex: number;
  yieldMwh: number;
  yieldP90Mwh?: number | null;
  tariff: number;
  debtRate: number;
  dscrTarget?: number | null;
  debtTenorYears?: number | null;
  dscrSchedule?: DscrTranche[] | null;
  gearingMax?: number | null;
  structuringFeeRate?: number | null;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  lcoe: number;
  dscr: number;
  debtAmountKeuro: number | null;
  sizing: SizingResult | null;
};

export type AnnualCashFlow = {
  year: number;
  annualTariff: number;
  productionP50Mwh: number;
  productionP90Mwh: number;
  revenueP50Keuro: number;
  revenueP90Keuro: number;
  opexKeuro: number;
  cashFlowKeuro: number;
  discountedCashFlowKeuro: number;
  debtServiceKeuro: number;
  debtServiceSculptedKeuro: number | null;
  cfadsP90Keuro: number;
  dscr: number | null;
  dscrRealized: number | null;
  dscrTargetAtYear: number | null;
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

// Returns the DSCR target for a given year from the schedule.
// Falls back to DSCR_FALLBACK (1.30) for years not covered by any tranche.
function dscrForYear(year: number, schedule: DscrTranche[]): number {
  return (
    schedule.find((t) => year >= t.yearFrom && year <= t.yearTo)?.dscrValue ??
    DSCR_FALLBACK
  );
}

// Resolves a non-empty DscrTranche[] from the input.
// Priority: dscrSchedule (if non-empty) > legacy dscrTarget scalar.
// Returns null when no sculpting is configured.
function resolveSchedule(input: FinanceEngineInput): DscrTranche[] | null {
  if (input.dscrSchedule != null && input.dscrSchedule.length > 0) {
    return input.dscrSchedule;
  }
  if (
    input.dscrTarget != null &&
    input.dscrTarget > 0 &&
    input.debtTenorYears != null &&
    input.debtTenorYears > 0
  ) {
    return [{ yearFrom: 1, yearTo: input.debtTenorYears, dscrValue: input.dscrTarget }];
  }
  return null;
}

/**
 * Computes the two-constraint sizing result from sculpted debt and a gearing cap.
 *
 *   debtRetenu   = min(debtSculpted, debtGearingMax)
 *   headroom     = debtGearingMax - debtRetenu          (≥ 0)
 *   structuringFee = headroom × structuringFeeRate / 100
 *
 * When gearingMax is null there is no bank gearing cap: debtRetenu = debtSculpted,
 * headroom = 0, structuringFee = 0.
 */
export function sizingResult(
  debtSculptedKeuro: number,
  capexKeuro: number,
  gearingMax: number | null,
  structuringFeeRate: number,
): SizingResult {
  if (gearingMax === null) {
    return {
      debtSculptedKeuro,
      debtGearingMaxKeuro: null,
      debtRetenuKeuro: debtSculptedKeuro,
      headroomKeuro: 0,
      bindingConstraint: "dscr",
      structuringFeeKeuro: 0,
      structuringFeeRate,
    };
  }

  const debtGearingMaxKeuro = capexKeuro * gearingMax / 100;
  const debtRetenuKeuro = Math.min(debtSculptedKeuro, debtGearingMaxKeuro);
  const headroomKeuro = debtGearingMaxKeuro - debtRetenuKeuro;
  const bindingConstraint: SizingResult["bindingConstraint"] =
    debtSculptedKeuro < debtGearingMaxKeuro
      ? "dscr"
      : debtSculptedKeuro > debtGearingMaxKeuro
        ? "gearing"
        : "equal";
  const structuringFeeKeuro = headroomKeuro * structuringFeeRate / 100;

  return {
    debtSculptedKeuro,
    debtGearingMaxKeuro,
    debtRetenuKeuro,
    headroomKeuro,
    bindingConstraint,
    structuringFeeKeuro,
    structuringFeeRate,
  };
}

/**
 * Sculpts debt: determines the maximum senior debt amount compatible with a
 * per-year DSCR schedule, given a P90 CFADS profile over the debt tenor.
 *
 * Method:
 *   - Sculpted annuity for year t = cfadsP90(t) / dscrForYear(t, schedule)
 *   - Debt amount = PV of sculpted annuities at the debt interest rate
 *   - Repayment schedule: each year, interest is charged on the outstanding
 *     balance, and principal = annuity − interest (floored at 0, capped at
 *     remaining outstanding).
 *
 * Returns null when dscrSchedule is empty or tenorYears is not positive.
 * Returns { debtAmountKeuro: 0, schedule: [] } when CFADS yields no capacity.
 */
export function sculptDebt(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90Keuro: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
): { debtAmountKeuro: number; schedule: DebtScheduleItem[] } | null {
  if (dscrSchedule.length === 0 || tenorYears <= 0) {
    return null;
  }

  const debtRate = asRate(debtInterestRatePercent);
  const tenorFlows = cashFlows.filter((r) => r.year <= tenorYears);

  // debtAmount = Σ(t=1..tenor) [cfadsP90(t) / dscrTarget(t)] / (1 + r)^t
  const debtAmountKeuro = tenorFlows.reduce((pv, row) => {
    return (
      pv +
      row.cfadsP90Keuro / dscrForYear(row.year, dscrSchedule) / (1 + debtRate) ** row.year
    );
  }, 0);

  if (debtAmountKeuro <= 0) {
    return { debtAmountKeuro: 0, schedule: [] };
  }

  const schedule: DebtScheduleItem[] = [];
  let outstanding = debtAmountKeuro;

  for (const row of tenorFlows) {
    const interest = outstanding * debtRate;
    const annuity = row.cfadsP90Keuro / dscrForYear(row.year, dscrSchedule);
    // Principal = annuity - interest, clamped to [0, outstanding].
    const principal = Math.min(Math.max(0, annuity - interest), outstanding);
    outstanding = outstanding - principal;

    schedule.push({ year: row.year, principal, interest, outstanding });
  }

  return { debtAmountKeuro, schedule };
}

export function calculateAnnualCashFlows(input: FinanceEngineInput): AnnualCashFlow[] {
  const initialInvestment = input.capex * input.capacityMw;
  const initialDebt = initialInvestment * (input.debtRate / 100);
  const degradationRate = asRate(input.degradationRate);
  const discountRate = asRate(input.discountRate);
  const debtInterestRate = asRate(input.debtInterestRate);
  const tariffInflationRate = asRate(input.tariffInflationRate);
  const opexInflationRate = asRate(input.opexInflationRate);
  const annualDebtService = calculateAnnualDebtService(
    initialDebt,
    debtInterestRate,
    input.debtMaturityYears,
  );
  // P90 yield: use provided value or fall back to P50 * 0.9.
  const effectiveYieldP90 = input.yieldP90Mwh ?? input.yieldMwh * 0.9;

  // Pass 1: compute all cash-flow fields (no sculpted debt yet).
  type PreRow = {
    year: number;
    annualTariff: number;
    productionP50Mwh: number;
    productionP90Mwh: number;
    revenueP50Keuro: number;
    revenueP90Keuro: number;
    opexKeuro: number;
    cashFlowKeuro: number;
    cfadsP90Keuro: number;
    debtServiceKeuro: number;
  };

  const preRows: PreRow[] = [];

  for (let year = 1; year <= input.projectLifeYears; year += 1) {
    const degradationFactor = (1 - degradationRate) ** (year - 1);

    // P50 production year N = yield P50 MWh/MW/year * MW * annual degradation.
    const productionP50 = input.yieldMwh * input.capacityMw * degradationFactor;

    // P90 production year N = yield P90 MWh/MW/year * MW * annual degradation.
    const productionP90 = effectiveYieldP90 * input.capacityMw * degradationFactor;

    // Tariff year N = base tariff EUR/MWh * tariff inflation factor.
    const annualTariff = input.tariff * (1 + tariffInflationRate) ** year;

    // Revenue P50 kEUR = production P50 MWh * annual tariff EUR/MWh / 1000.
    const revenueP50 = (productionP50 * annualTariff) / 1000;

    // Revenue P90 kEUR = production P90 MWh * annual tariff EUR/MWh / 1000.
    const revenueP90 = (productionP90 * annualTariff) / 1000;

    // Annual OPEX kEUR = opex kEUR/MW/year * MW * OPEX inflation factor.
    const annualOpex =
      input.opex * input.capacityMw * (1 + opexInflationRate) ** year;

    // Equity cash-flow (P50) kEUR = revenue P50 - OPEX (project NPV/IRR base).
    const cfadsP50 = revenueP50 - annualOpex;

    // Banking CFADS (P90) kEUR = revenue P90 - OPEX (DSCR sizing base).
    const cfadsP90 = revenueP90 - annualOpex;

    const debtService = year <= input.debtMaturityYears ? annualDebtService : 0;

    preRows.push({
      year,
      annualTariff,
      productionP50Mwh: productionP50,
      productionP90Mwh: productionP90,
      revenueP50Keuro: revenueP50,
      revenueP90Keuro: revenueP90,
      opexKeuro: annualOpex,
      cashFlowKeuro: cfadsP50,
      cfadsP90Keuro: cfadsP90,
      debtServiceKeuro: debtService,
    });
  }

  // Pass 2 (optional): sculpted debt schedule.
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor =
    input.debtTenorYears ??
    (effectiveSchedule !== null
      ? Math.max(...effectiveSchedule.map((t) => t.yearTo))
      : 0);

  const hasSculpting = effectiveSchedule !== null && effectiveTenor > 0;

  const sculptedResult = hasSculpting
    ? sculptDebt(preRows, effectiveSchedule!, input.debtInterestRate, effectiveTenor)
    : null;

  // Apply gearing cap: scale the schedule down to the retained debt amount.
  const sizing_ =
    sculptedResult !== null
      ? sizingResult(
          sculptedResult.debtAmountKeuro,
          initialInvestment,
          input.gearingMax ?? null,
          input.structuringFeeRate ?? 0,
        )
      : null;

  const scaleFactor =
    sizing_ !== null && sizing_.debtSculptedKeuro > 0
      ? sizing_.debtRetenuKeuro / sizing_.debtSculptedKeuro
      : 1;

  const sculptedScheduleByYear = new Map(
    sculptedResult?.schedule.map((s) => [
      s.year,
      {
        principal: s.principal * scaleFactor,
        interest: s.interest * scaleFactor,
      },
    ]) ?? [],
  );

  // Pass 3: assemble final AnnualCashFlow rows.
  return preRows.map((pre) => {
    const scheduleItem = sculptedScheduleByYear.get(pre.year) ?? null;
    const sculptedService =
      scheduleItem !== null ? scheduleItem.principal + scheduleItem.interest : null;

    return {
      year: pre.year,
      annualTariff: pre.annualTariff,
      productionP50Mwh: pre.productionP50Mwh,
      productionP90Mwh: pre.productionP90Mwh,
      revenueP50Keuro: pre.revenueP50Keuro,
      revenueP90Keuro: pre.revenueP90Keuro,
      opexKeuro: pre.opexKeuro,
      cashFlowKeuro: pre.cashFlowKeuro,
      discountedCashFlowKeuro: discounted(pre.cashFlowKeuro, pre.year, discountRate),
      debtServiceKeuro: pre.debtServiceKeuro,
      debtServiceSculptedKeuro: sculptedService,
      cfadsP90Keuro: pre.cfadsP90Keuro,
      // Standard DSCR: cfadsP90 / constant-annuity service.
      dscr:
        pre.debtServiceKeuro > 0 ? pre.cfadsP90Keuro / pre.debtServiceKeuro : null,
      // Realized DSCR: cfadsP90 / retained sculpted service.
      dscrRealized:
        sculptedService !== null && sculptedService > 0
          ? pre.cfadsP90Keuro / sculptedService
          : null,
      // Target DSCR for this year from the schedule (null when no sculpting or beyond tenor).
      dscrTargetAtYear:
        effectiveSchedule !== null && pre.year <= effectiveTenor
          ? dscrForYear(pre.year, effectiveSchedule)
          : null,
    };
  });
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  // Initial investment kEUR = capex kEUR/MW * project capacity MW.
  const initialInvestment = input.capex * input.capacityMw;
  const annualCashFlows = calculateAnnualCashFlows(input);

  // VAN and TRI use P50 equity cash-flows (actionnaire view).
  const cashFlows = annualCashFlows.map((row) => row.cashFlowKeuro);
  const discountedCashFlows = annualCashFlows.reduce(
    (total, row) => total + row.discountedCashFlowKeuro,
    0,
  );
  const discountedOpex = annualCashFlows.reduce(
    (total, row) => total + discounted(row.opexKeuro, row.year, asRate(input.discountRate)),
    0,
  );
  // LCOE uses P50 production.
  const discountedProduction = annualCashFlows.reduce(
    (total, row) =>
      total + discounted(row.productionP50Mwh, row.year, asRate(input.discountRate)),
    0,
  );
  // Standard DSCR uses constant-annuity service over debt maturity.
  const dscrValues = annualCashFlows
    .map((row) => row.dscr)
    .filter((value): value is number => value !== null);

  // Minimum standard DSCR. If no debt, stored as 0.
  const dscr = dscrValues.length > 0 ? Math.min(...dscrValues) : 0;

  // Sculpted debt and two-constraint sizing.
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor =
    input.debtTenorYears ??
    (effectiveSchedule !== null
      ? Math.max(...effectiveSchedule.map((t) => t.yearTo))
      : 0);
  const hasSculpting = effectiveSchedule !== null && effectiveTenor > 0;
  const sculptedResult = hasSculpting
    ? sculptDebt(annualCashFlows, effectiveSchedule!, input.debtInterestRate, effectiveTenor)
    : null;

  const sizing =
    sculptedResult !== null
      ? sizingResult(
          sculptedResult.debtAmountKeuro,
          initialInvestment,
          input.gearingMax ?? null,
          input.structuringFeeRate ?? 0,
        )
      : null;

  // Structuring fee is an upfront SPV cost — added to effective CAPEX.
  const structuringFee = sizing?.structuringFeeKeuro ?? 0;
  const capexEffectif = initialInvestment + structuringFee;

  // NPV kEUR = sum of discounted P50 cash-flows - effective CAPEX.
  const npv = discountedCashFlows - capexEffectif;

  // IRR % = rate that sets NPV to zero using effective CAPEX.
  const irr = calculateIrr(capexEffectif, cashFlows) * 100;

  // LCOE EUR/MWh = discounted total cost / discounted P50 production * 1000.
  const lcoe =
    discountedProduction > 0
      ? ((capexEffectif + discountedOpex) / discountedProduction) * 1000
      : 0;

  return {
    npv: round(npv),
    irr: round(irr),
    lcoe: round(lcoe),
    dscr: round(dscr),
    debtAmountKeuro: sizing !== null ? round(sizing.debtRetenuKeuro) : null,
    sizing: sizing !== null
      ? {
          ...sizing,
          debtSculptedKeuro: round(sizing.debtSculptedKeuro),
          debtGearingMaxKeuro:
            sizing.debtGearingMaxKeuro !== null ? round(sizing.debtGearingMaxKeuro) : null,
          debtRetenuKeuro: round(sizing.debtRetenuKeuro),
          headroomKeuro: round(sizing.headroomKeuro),
          structuringFeeKeuro: round(sizing.structuringFeeKeuro),
        }
      : null,
  };
}
