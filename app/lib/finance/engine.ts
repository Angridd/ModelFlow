import type {
  DebtScheduleItem,
  DoubleIRR,
  DscrTranche,
  FinancialAssumptions,
  SizingResult,
  T0Flows,
} from "@/app/lib/finance/types";

const IRR_MIN_RATE = -0.9999;
const IRR_MAX_RATE = 10;
const DSCR_FALLBACK = 1.3;
const STRUCTURING_FEE_RATE = 1;
const CCA_REMUN_RATE = 0;
const CONTRACT_DURATION_FALLBACK = 20;
const PRIX_MARCHE_P50_FALLBACK = 60;
const PRIX_MARCHE_P90_FALLBACK = 55;
const ASSURANCE_RATE_FALLBACK = 2.5;
const INFLATION_ASSURANCE_FALLBACK = 2;
const BALANCING_COST_FALLBACK = 2;

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
  gearingMaxPct?: number | null;
  gearingMax?: number | null;
  tauxIS?: number | null;
  amortDuree?: number | null;
  margeDevKeuro?: number | null;
  dsraMonths?: number | null;
  devFeesKEuroPerMW?: number | null;
  tauxISEntreprise?: number | null;
  contractDuration?: number | null;
  prixMarcheP50?: number | null;
  prixMarcheP90?: number | null;
  assuranceRate?: number | null;
  inflationAssurance?: number | null;
  balancingCost?: number | null;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  lcoe: number;
  dscr: number;
  debtAmountKeuro: number | null;
  sizing: SizingResult | null;
  doubleIRR: DoubleIRR | null;
  sizingIterations: number;
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
  amort: number;
  ebit: number;
  interets: number;
  ebt: number;
  is: number;
  resultatNet: number;
  cfadsAfterTax: number;
  dividende: number;
  fluxActionnaire: number;
  ccaRemboursementKeuro: number;
  ccaInteretsKeuro: number;
  ccaOutstandingKeuro: number;
  deficitCumuleKeuro: number;
  resultatCumuleKeuro: number;
  dsraSoldeKeuro: number;
  dsraDepotKeuro: number;
  dsraRetraitKeuro: number;
  cashBloqueKeuro: number;
  dscr: number | null;
  dscrRealized: number | null;
  dscrTargetAtYear: number | null;
};

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
  standardDebtInterestKeuro: number;
  amort: number;
};

type RetainedDebtScheduleItem = Pick<DebtScheduleItem, "principal" | "interest">;

type SizingComputation = {
  sizing: SizingResult | null;
  scheduleByYear: Map<number, RetainedDebtScheduleItem>;
  iterations: number;
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
  if (initialInvestment <= 0 && cashFlows.some((cashFlow) => cashFlow > 0)) {
    return IRR_MAX_RATE;
  }

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

export function calculateDoubleIRR(
  t0Flows: T0Flows,
  projectCashFlows: number[],
  equityCashFlows: number[],
): DoubleIRR {
  const projectInvestment = t0Flows.miseNetteInvest;
  const equityInvestment = t0Flows.miseNetteEntrep;
  const projectIrr = calculateIrr(projectInvestment, projectCashFlows) * 100;
  const equityIrr = calculateIrr(equityInvestment, equityCashFlows) * 100;
  const npvRate = asRate(6);
  const npvSPV = projectCashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, npvRate),
    -projectInvestment,
  );
  const npvEntreprise = equityCashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, npvRate),
    -equityInvestment,
  );

  return {
    irrInvest: round(projectIrr),
    irrEntreprise: round(equityIrr),
    npvSPV: round(npvSPV),
    npvEntreprise: round(npvEntreprise),
    miseNette: round(equityInvestment),
  };
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

function buildStandardDebtSchedule(
  initialDebt: number,
  annualDebtService: number,
  debtInterestRate: number,
  debtMaturityYears: number,
) {
  const schedule = new Map<number, RetainedDebtScheduleItem>();
  let outstanding = initialDebt;

  for (let year = 1; year <= debtMaturityYears; year += 1) {
    const interest = outstanding * debtInterestRate;
    const principal = Math.min(Math.max(0, annualDebtService - interest), outstanding);
    outstanding -= principal;
    schedule.set(year, { principal, interest });
  }

  return schedule;
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

function resolveGearingMaxPct(input: FinanceEngineInput) {
  return input.gearingMaxPct ?? input.gearingMax ?? null;
}

/**
 * Computes the two-constraint sizing result from sculpted debt and a gearing cap.
 *
 *   debtRetenu   = min(debtSculpted, debtGearingMax)
 *   headroom     = debtGearingMax - debtRetenu          (≥ 0)
 *   structuringFee = headroom × structuringFeeRate
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
  const structuringFeeKeuro = headroomKeuro * structuringFeeRate;

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

function buildPreRows(input: FinanceEngineInput): PreRow[] {
  const initialInvestment = input.capex * input.capacityMw;
  const initialDebt = initialInvestment * (input.debtRate / 100);
  const degradationRate = asRate(input.degradationRate);
  const debtInterestRate = asRate(input.debtInterestRate);
  const tariffInflationRate = asRate(input.tariffInflationRate);
  const opexInflationRate = asRate(input.opexInflationRate);
  const annualDebtService = calculateAnnualDebtService(
    initialDebt,
    debtInterestRate,
    input.debtMaturityYears,
  );
  const standardDebtSchedule = buildStandardDebtSchedule(
    initialDebt,
    annualDebtService,
    debtInterestRate,
    input.debtMaturityYears,
  );
  const amortDuree = input.amortDuree ?? input.projectLifeYears;
  const annualAmort = amortDuree > 0
    ? initialInvestment / amortDuree
    : 0;
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const prixMarcheP50 = input.prixMarcheP50 ?? PRIX_MARCHE_P50_FALLBACK;
  const prixMarcheP90 = input.prixMarcheP90 ?? PRIX_MARCHE_P90_FALLBACK;
  const assuranceRate = asRate(input.assuranceRate ?? ASSURANCE_RATE_FALLBACK);
  const inflationAssurance = asRate(
    input.inflationAssurance ?? INFLATION_ASSURANCE_FALLBACK,
  );
  const balancingCost = input.balancingCost ?? BALANCING_COST_FALLBACK;
  // P90 yield: use provided value or fall back to P50 * 0.93.
  const effectiveYieldP90 = input.yieldP90Mwh ?? input.yieldMwh * 0.93;

  const preRows: PreRow[] = [];

  for (let year = 1; year <= input.projectLifeYears; year += 1) {
    const degradationFactor = (1 - degradationRate) ** (year - 1);

    // P50 production year N = yield P50 MWh/MW/year * MW * annual degradation.
    const productionP50 = input.yieldMwh * input.capacityMw * degradationFactor;

    // P90 production year N = yield P90 MWh/MW/year * MW * annual degradation.
    const productionP90 = effectiveYieldP90 * input.capacityMw * degradationFactor;

    // Tariff year N applies during the contract period, then merchant prices take over.
    const annualTariff =
      year <= contractDuration
        ? input.tariff * (1 + tariffInflationRate) ** year
        : prixMarcheP50;

    const annualTariffP90 = year <= contractDuration ? annualTariff : prixMarcheP90;

    // Revenue kEUR = production MWh * price EUR/MWh / 1000.
    const revenueP50 = (productionP50 * annualTariff) / 1000;
    const revenueP90 = (productionP90 * annualTariffP90) / 1000;

    const opexBase =
      input.opex * input.capacityMw * (1 + opexInflationRate) ** year;
    const assurance = assuranceRate * revenueP50 * (1 + inflationAssurance) ** year;
    const balancing = (balancingCost * productionP50) / 1000;
    const annualOpex = opexBase + assurance + balancing;

    // Equity cash-flow (P50) kEUR = revenue P50 - OPEX (project NPV/IRR base).
    const cfadsP50 = revenueP50 - annualOpex;

    // Banking CFADS (P90) kEUR = revenue P90 - OPEX (DSCR sizing base).
    const cfadsP90 = revenueP90 - annualOpex;

    const debtService = year <= input.debtMaturityYears ? annualDebtService : 0;
    const standardDebtInterest =
      standardDebtSchedule.get(year)?.interest ?? 0;

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
      standardDebtInterestKeuro: standardDebtInterest,
      amort: annualAmort,
    });
  }

  return preRows;
}

function taxAmount(ebt: number, tauxIS: number | null | undefined) {
  return tauxIS != null ? Math.max(0, ebt * asRate(tauxIS)) : 0;
}

function applyWaterfall(
  preRows: PreRow[],
  scheduleByYear: Map<number, RetainedDebtScheduleItem>,
  input: Pick<FinanceEngineInput, "tauxIS" | "dsraMonths">,
  discountRate: number,
  effectiveSchedule: DscrTranche[] | null,
  effectiveTenor: number,
  ccaPrincipalKeuro: number,
): Array<AnnualCashFlow & { cfadsP90AfterTaxKeuro: number }> {
  let ccaOutstanding = Math.max(0, ccaPrincipalKeuro);
  let deficitCumule = 0;
  let deficitCumuleP90 = 0;
  let resultatCumule = 0;
  let dsraSolde = 0;

  return preRows.map((pre) => {
    const scheduleItem = scheduleByYear.get(pre.year) ?? null;
    const sculptedService =
      scheduleItem !== null ? scheduleItem.principal + scheduleItem.interest : null;
    const nextScheduleItem = scheduleByYear.get(pre.year + 1) ?? null;
    const nextSculptedService =
      nextScheduleItem !== null
        ? nextScheduleItem.principal + nextScheduleItem.interest
        : null;
    const debtInterest = scheduleItem?.interest ?? pre.standardDebtInterestKeuro;
    const ccaInterets = ccaOutstanding * asRate(CCA_REMUN_RATE);
    const interets = debtInterest + ccaInterets;
    const ebit = pre.cashFlowKeuro - pre.amort;
    const ebt = ebit - interets;
    const baseImposable = ebt - deficitCumule;
    const is = taxAmount(baseImposable, input.tauxIS);
    deficitCumule =
      ebt < 0 ? deficitCumule + Math.abs(ebt) : Math.max(0, deficitCumule - ebt);
    const resultatNet = ebt - is;
    resultatCumule += resultatNet;
    const cfadsAfterTax = pre.cashFlowKeuro - is;
    const ebitP90 = pre.cfadsP90Keuro - pre.amort;
    const ebtP90 = ebitP90 - interets;
    const baseImposableP90 = ebtP90 - deficitCumuleP90;
    const isP90 = taxAmount(baseImposableP90, input.tauxIS);
    deficitCumuleP90 =
      ebtP90 < 0
        ? deficitCumuleP90 + Math.abs(ebtP90)
        : Math.max(0, deficitCumuleP90 - ebtP90);
    const debtService = sculptedService ?? pre.debtServiceKeuro;
    const nextDebtService =
      nextSculptedService ??
      (pre.year + 1 <= preRows.length
        ? (preRows[pre.year]?.debtServiceKeuro ?? 0)
        : 0);
    const dsraTarget =
      pre.year < effectiveTenor ? nextDebtService * (input.dsraMonths ?? 0) / 12 : 0;
    let cashAvailable = Math.max(0, cfadsAfterTax - debtService);
    let dsraRetrait = 0;

    if (pre.year === effectiveTenor && dsraSolde > 0) {
      dsraRetrait = dsraSolde;
      dsraSolde = 0;
      cashAvailable += dsraRetrait;
    } else if (dsraSolde > dsraTarget) {
      dsraRetrait = dsraSolde - dsraTarget;
      dsraSolde = dsraTarget;
      cashAvailable += dsraRetrait;
    }

    const dsraDepot = Math.min(cashAvailable, Math.max(0, dsraTarget - dsraSolde));
    dsraSolde += dsraDepot;
    cashAvailable -= dsraDepot;

    const cashAfterCcaInterest = Math.max(0, cashAvailable - ccaInterets);
    const ccaRemboursement = Math.min(ccaOutstanding, cashAfterCcaInterest);
    ccaOutstanding -= ccaRemboursement;
    const residualAfterCca = Math.max(0, cashAfterCcaInterest - ccaRemboursement);
    const dividende = resultatCumule > 0 ? residualAfterCca : 0;
    const cashBloque = dsraSolde + (resultatCumule > 0 ? 0 : residualAfterCca);
    const fluxActionnaire =
      dividende + ccaRemboursement + ccaInterets + cashBloque;

    return {
      year: pre.year,
      annualTariff: pre.annualTariff,
      productionP50Mwh: pre.productionP50Mwh,
      productionP90Mwh: pre.productionP90Mwh,
      revenueP50Keuro: pre.revenueP50Keuro,
      revenueP90Keuro: pre.revenueP90Keuro,
      opexKeuro: pre.opexKeuro,
      cashFlowKeuro: pre.cashFlowKeuro,
      discountedCashFlowKeuro: discounted(cfadsAfterTax, pre.year, discountRate),
      debtServiceKeuro: pre.debtServiceKeuro,
      debtServiceSculptedKeuro: sculptedService,
      cfadsP90Keuro: pre.cfadsP90Keuro,
      amort: pre.amort,
      ebit,
      interets,
      ebt,
      is,
      resultatNet,
      cfadsAfterTax,
      dividende,
      fluxActionnaire,
      ccaRemboursementKeuro: ccaRemboursement,
      ccaInteretsKeuro: ccaInterets,
      ccaOutstandingKeuro: ccaOutstanding,
      deficitCumuleKeuro: deficitCumule,
      resultatCumuleKeuro: resultatCumule,
      dsraSoldeKeuro: dsraSolde,
      dsraDepotKeuro: dsraDepot,
      dsraRetraitKeuro: dsraRetrait,
      cashBloqueKeuro: cashBloque,
      cfadsP90AfterTaxKeuro: pre.cfadsP90Keuro - isP90,
      // Standard DSCR: after-tax P90 CFADS / constant-annuity service.
      dscr:
        pre.debtServiceKeuro > 0
          ? (pre.cfadsP90Keuro - isP90) / pre.debtServiceKeuro
          : null,
      // Realized DSCR: after-tax P90 CFADS / retained sculpted service.
      dscrRealized:
        sculptedService !== null && sculptedService > 0
          ? (pre.cfadsP90Keuro - isP90) / sculptedService
          : null,
      // Target DSCR for this year from the schedule (null when no sculpting or beyond tenor).
      dscrTargetAtYear:
        effectiveSchedule !== null && pre.year <= effectiveTenor
          ? dscrForYear(pre.year, effectiveSchedule)
          : null,
    };
  });
}

function scaledScheduleByYear(
  sculptedResult: { schedule: DebtScheduleItem[] } | null,
  scaleFactor: number,
) {
  return new Map(
    sculptedResult?.schedule.map((s) => [
      s.year,
      {
        principal: s.principal * scaleFactor,
        interest: s.interest * scaleFactor,
      },
    ]) ?? [],
  );
}

function calculateSculpting(
  input: FinanceEngineInput,
  preRows: PreRow[],
  initialInvestment: number,
): SizingComputation {
  const discountRate = asRate(input.discountRate);
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor = input.debtTenorYears ?? input.debtMaturityYears;

  const hasSculpting = effectiveSchedule !== null && effectiveTenor > 0;

  if (!hasSculpting) {
    return { sizing: null, scheduleByYear: new Map(), iterations: 0 };
  }

  let scheduleByYear = new Map<number, RetainedDebtScheduleItem>();
  let sizing: SizingResult | null = null;

  for (let iteration = 0; iteration < 50; iteration += 1) {
    const taxRows = applyWaterfall(
      preRows,
      scheduleByYear,
      input,
      discountRate,
      effectiveSchedule,
      effectiveTenor,
      0,
    );
    const debtSizingFlows = taxRows.map((row) => ({
      year: row.year,
      cfadsP90Keuro: row.cfadsP90AfterTaxKeuro,
    }));
    const sculptedResult = sculptDebt(
      debtSizingFlows,
      effectiveSchedule!,
      input.debtInterestRate,
      effectiveTenor,
    );
    const nextSizing =
      sculptedResult !== null
        ? sizingResult(
            sculptedResult.debtAmountKeuro,
            initialInvestment,
            resolveGearingMaxPct(input),
            STRUCTURING_FEE_RATE,
          )
        : null;
    const scaleFactor =
      nextSizing !== null && nextSizing.debtSculptedKeuro > 0
        ? nextSizing.debtRetenuKeuro / nextSizing.debtSculptedKeuro
        : 1;
    const nextScheduleByYear = scaledScheduleByYear(sculptedResult, scaleFactor);
    const previousDebt = sizing?.debtRetenuKeuro ?? 0;
    const nextDebt = nextSizing?.debtRetenuKeuro ?? 0;

    sizing = nextSizing;
    scheduleByYear = nextScheduleByYear;

    if (Math.abs(nextDebt - previousDebt) < 0.01) {
      return { sizing, scheduleByYear, iterations: iteration + 1 };
    }
  }

  return { sizing, scheduleByYear, iterations: 50 };
}

export function calculateAnnualCashFlows(input: FinanceEngineInput): AnnualCashFlow[] {
  const initialInvestment = input.capex * input.capacityMw;
  const discountRate = asRate(input.discountRate);
  const preRows = buildPreRows(input);
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor = input.debtTenorYears ?? input.debtMaturityYears;
  const { sizing, scheduleByYear } = calculateSculpting(input, preRows, initialInvestment);
  const capexEffectif = initialInvestment + (sizing?.structuringFeeKeuro ?? 0);
  const retainedDebt = sizing?.debtRetenuKeuro ?? initialInvestment * input.debtRate / 100;
  const ccaPrincipalKeuro = Math.max(0, capexEffectif - retainedDebt);

  return applyWaterfall(
    preRows,
    scheduleByYear,
    input,
    discountRate,
    effectiveSchedule,
    effectiveTenor,
    ccaPrincipalKeuro,
  ).map(({ cfadsP90AfterTaxKeuro: _cfadsP90AfterTaxKeuro, ...row }) => row);
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  // Initial investment kEUR = capex kEUR/MW * project capacity MW.
  const initialInvestment = input.capex * input.capacityMw;
  const preRows = buildPreRows(input);
  const sculpting = calculateSculpting(input, preRows, initialInvestment);
  const annualCashFlows = calculateAnnualCashFlows(input);

  // VAN and TRI use after-tax P50 operating cash-flows.
  const cashFlows = annualCashFlows.map((row) => row.cfadsAfterTax);
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

  const sizing = sculpting.sizing;

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
  const retainedDebt = sizing?.debtRetenuKeuro ?? initialInvestment * input.debtRate / 100;
  const ccaKeuro = Math.max(0, capexEffectif - retainedDebt);
  const margeDev = input.margeDevKeuro ?? structuringFee;
  const devFeesKeuro = (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const tauxISEntreprise = input.tauxISEntreprise ?? input.tauxIS ?? 0;
  const netEntrepriseFactor = 1 - asRate(tauxISEntreprise);
  const dsraInitialKeuro =
    annualCashFlows.length > 0
      ? (annualCashFlows[0].debtServiceSculptedKeuro ??
          annualCashFlows[0].debtServiceKeuro) *
        (input.dsraMonths ?? 0) / 12
      : 0;
  const miseNetteInvest = ccaKeuro;
  const miseNetteEntrep =
    ccaKeuro - margeDev * netEntrepriseFactor - devFeesKeuro * netEntrepriseFactor;
  const shareholderFlows = annualCashFlows.map((row) => row.fluxActionnaire);
  const shouldCalculateDoubleIrr =
    retainedDebt > 0 ||
    ccaKeuro > 0 ||
    margeDev > 0 ||
    devFeesKeuro > 0 ||
    input.tauxIS != null;
  const doubleIRR = shouldCalculateDoubleIrr
    ? calculateDoubleIRR(
        {
          projectInvestmentKeuro: capexEffectif,
          equityInvestmentKeuro: miseNetteEntrep,
          dsraInitialKeuro,
          devFeesKeuro,
          miseNetteInvest,
          miseNetteEntrep,
        },
        cashFlows,
        shareholderFlows,
      )
    : null;

  return {
    npv: round(npv),
    irr: round(irr),
    lcoe: round(lcoe),
    dscr: round(dscr),
    debtAmountKeuro: sizing !== null ? round(sizing.debtRetenuKeuro) : null,
    doubleIRR,
    sizingIterations: sculpting.iterations,
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
