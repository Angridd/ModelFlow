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
const CCA_REMUN_RATE = 0;
const CONTRACT_DURATION_FALLBACK = 20;
const CONSTRUCTION_YEARS_FALLBACK = 1;
const ASSURANCE_RATE_FALLBACK = 2.5;
const INFLATION_ASSURANCE_FALLBACK = 2;
const BALANCING_COST_FALLBACK = 2;
const TAUX_EUR_USD_FALLBACK = 1.16;
const OM_FIXED_EURO_KWC_FALLBACK = 5.1;
const MRA_EURO_KWC_FALLBACK = 1.1;
const BACK_OFFICE_KEURO_FALLBACK = 22;
const DIVERS_OPEX_KEURO_FALLBACK = 35;
const LOYER_INFLATION_FALLBACK = 0.4;
const INFLATION_OM_FALLBACK = 2;
const INFLATION_MRA_FALLBACK = 2;
const INFLATION_BACK_OFFICE_FALLBACK = 2;
const INFLATION_DIVERS_FALLBACK = 2;
const METHODE_TAXES_FALLBACK = "appreciation_directe";
const IFER_RATE_1_FALLBACK = 3.5;
const IFER_RATE_2_FALLBACK = 8.5;
const IFER_RPN_FALLBACK = 1.35;
const INFLATION_AURORA_FALLBACK = 2;
const TAUX_LF_AD = 0.08;
const TAUX_LF_COMPTA = 0.04;
const ABATT_IMMO = 0.30;
const COEF_NEUTRAL = 0.14632;
const FRAIS_TF = [0.03, 0.03, 0.09, 0.03, 0.08] as const;
const FRAIS_CFE = [0.03, 0.03, 0.09, 0.00, 0.09] as const;
// Appréciation Directe (Règle 6)
const ABATT_AD = 0.50;
const COEF_NEUTRAL_AD = 0.26;
const RATIO_PART_FONC_AD = 0.0293;
const VALEUR_VENALE_HA_AD = 5000;
const FRAIS_TF_EURO = 78;
const FRAIS_CFE_EURO = 72;

export type FinanceEngineInput = FinancialAssumptions & {
  capacityMw: number;
  commissioningYear?: number | null;
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
  structuringFeeRate?: number | null;
  tauxIS?: number | null;
  amortDuree?: number | null;
  capexType1Keuro?: number | null;
  capexType2Keuro?: number | null;
  margeDevKeuro?: number | null;
  dsraMonths?: number | null;
  devFeesKEuroPerMW?: number | null;
  tauxISEntreprise?: number | null;
  contingencyRate?: number | null;
  longueurModule?: number | null;
  largeurModule?: number | null;
  txAmenagementRate?: number | null;
  coefArcheo?: number | null;
  legalFeesKEuro?: number | null;
  technicalDDKEuro?: number | null;
  arrangerFeesRate?: number | null;
  participantFeesRate?: number | null;
  bankFeesPLTKEuroPerMW?: number | null;
  interimFinancingRate?: number | null;
  commitmentFeesRate?: number | null;
  contractDuration?: number | null;
  constructionYears?: number | null;
  auroraCurves?: Array<{
    year: number;
    high: number;
    central: number;
    low: number;
  }> | null;
  capacityPriceCurve?: number[];
  capacityCertificateMw?: number;
  goStartYear?: number;
  goPriceBase?: number;
  debtSizingCentralW?: number | null;
  debtSizingLowW?: number | null;
  investorCurveW?: number | null;
  assuranceRate?: number | null;
  inflationAssurance?: number | null;
  balancingCost?: number | null;
  surfaceHa?: number | null;
  indemnitesImmoKeuro?: number | null;
  financingFeesKeuro?: number | null;
  prixModuleUSDWc?: number | null;
  tauxEURUSD?: number | null;
  boSCtWc?: number | null;
  raccordementOuvrageKEuro?: number | null;
  tarifQPKEuroPerMW?: number | null;
  apportAffaireMode?: string | null;
  apportAffaireValeur?: number | null;
  omFixedEuroKwc?: number | null;
  mraEuroKwc?: number | null;
  backOfficeKeuro?: number | null;
  diversOpexKeuro?: number | null;
  loyerMode?: string | null;
  loyerValeur?: number | null;
  loyerInflation?: number | null;
  inflationOM?: number | null;
  inflationMRA?: number | null;
  inflationBackOffice?: number | null;
  inflationDivers?: number | null;
  methodeTaxes?: string | null;
  tauxTFCommune?: number | null;
  tauxTFEPCI?: number | null;
  tauxTSE?: number | null;
  tauxGEMAPI?: number | null;
  tauxTEOM?: number | null;
  tauxCFECommune?: number | null;
  tauxCFEEPCI?: number | null;
  tauxTSECfe?: number | null;
  tauxGEMAPICfe?: number | null;
  tauxCCI?: number | null;
  baseFonciereKeuro?: number | null;
  valeurTerrainKeuro?: number | null;
  prixTerrainHa?: number | null;
  abattTerrain?: number | null;
  inflationTaxes?: number | null;
  iferRate1?: number | null;
  iferRate2?: number | null;
  iferRpn?: number | null;
  inflationAurora?: number | null;
  aleasOpexRate?: number | null;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  lcoe: number;
  dscr: number | null;
  debtAmountKeuro: number | null;
  sizing: SizingResult | null;
  doubleIRR: DoubleIRR | null;
  sizingIterations: number;
  financingFeesKeuro: number;
  estimatedPltKeuro: number;
  financingFeesDetail: FinancingFeesDetail;
  contingencyKeuro: number;
  tfAnnuelleKeuro: number;
  cfeAnnuelleKeuro: number;
  iferKeuroAn1: number;
  iferKeuroAn21: number;
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
  debtOutstandingKeuro: number;
  cfadsP90Keuro: number;
  cfadsP90AfterTaxKeuro: number;
  amort: number;
  vncKeuro: number;
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

export type CapexDetails = {
  hasDetailedCapex: boolean;
  modulesKeuro: number;
  modulesCtWc: number;
  boSKeuro: number;
  boSCtWc: number;
  raccordementKeuro: number;
  apportAffaireKeuro: number;
  devFeesKeuro: number;
  capexBeforeContingencyKeuro: number;
  contingencyKeuro: number;
  nbPanneaux: number;
  m2PV: number;
  taxeAmenagementKeuro: number;
  taxeArcheoKeuro: number;
  taxesFoncieresKeuro: number;
  indemnitesImmoKeuro: number;
  financingFeesKeuro: number;
  capexTotalKeuro: number;
  capexPerMwKeuro: number;
};

export type FinancingFeesDetail = {
  legalFees: number;
  technicalDD: number;
  arrangerFees: number;
  participantFees: number;
  bankFeesPLT: number;
  interimFinancing: number;
  commitmentFees: number;
};

export type FinancingFeesResult = {
  financingFeesKeuro: number;
  estimatedPltKeuro: number;
  financingFeesDetail: FinancingFeesDetail;
};

type FinancingFeesInput = Pick<
  FinanceEngineInput,
  | "capacityMw"
  | "gearingMaxPct"
  | "gearingMax"
  | "legalFeesKEuro"
  | "technicalDDKEuro"
  | "arrangerFeesRate"
  | "participantFeesRate"
  | "bankFeesPLTKEuroPerMW"
  | "interimFinancingRate"
  | "commitmentFeesRate"
> & { capexTotalKeuro: number };

export type OpexDetails = {
  hasDetailedOpex: boolean;
  omKeuro: number;
  mraKeuro: number;
  backOfficeKeuro: number;
  diversKeuro: number;
  loyerKeuro: number;
  assuranceKeuro: number;
  balancingKeuro: number;
  iferKeuro: number;
  baseTaxesKeuro: number;
  tfKeuro: number;
  cfeKeuro: number;
  aleasKeuro: number;
  opexTotalKeuro: number;
  opexPerMwKeuro: number;
};

export type TaxesFoncieresOpexResult = {
  baseTaxesKeuro: number;
  tfAnnuelleKeuro: number;
  cfeAnnuelleKeuro: number;
  tfKeuro: number;
  cfeKeuro: number;
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
  standardDebtOutstandingKeuro: number;
  amort: number;
  vncKeuro: number;
};

type AmortizationScheduleItem = {
  amort: number;
  vncKeuro: number;
};

type RetainedDebtScheduleItem = Pick<
  DebtScheduleItem,
  "principal" | "interest" | "outstanding"
>;

type SizingComputation = {
  sizing: SizingResult | null;
  scheduleByYear: Map<number, RetainedDebtScheduleItem>;
  annualCashFlows: AnnualCashFlow[];
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
  _projectCashFlows: number[],
  equityCashFlows: number[],
): DoubleIRR {
  const projectInvestment = t0Flows.miseNetteInvest;
  const equityInvestment = t0Flows.miseNetteEntrep;
  const projectIrr = calculateIrr(projectInvestment, equityCashFlows) * 100;
  const equityIrr = calculateIrr(equityInvestment, equityCashFlows) * 100;
  const npvRate = asRate(6);
  const npvSPV = equityCashFlows.reduce(
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
    schedule.set(year, { principal, interest, outstanding });
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

function resolveConstructionYears(input: Pick<FinanceEngineInput, "constructionYears">) {
  return Math.max(0, Math.trunc(input.constructionYears ?? CONSTRUCTION_YEARS_FALLBACK));
}

function buildAuroraCurveByYear(input: FinanceEngineInput) {
  return new Map(
    input.auroraCurves?.map((curve) => [
      curve.year,
      {
        high: curve.high,
        central: curve.central,
        low: curve.low,
      },
    ]) ?? [],
  );
}

function resolveMerchantPrices(
  input: FinanceEngineInput,
  auroraCurveByYear: Map<number, { high: number; central: number; low: number }>,
  projectYear: number,
) {
  const hasCalendarYears = input.commissioningYear != null && input.commissioningYear > 0;
  const calendarYear = hasCalendarYears
    ? input.commissioningYear! + projectYear - 1
    : projectYear;
  const auroraCurve = auroraCurveByYear.get(calendarYear);
  const inflationRate = asRate(input.inflationAurora ?? INFLATION_AURORA_FALLBACK);
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const inflFactor = hasCalendarYears
    ? (1 + inflationRate) ** (calendarYear - 2024)
    : (1 + inflationRate) ** Math.max(0, projectYear - contractDuration);

  if (!auroraCurve) {
    if (auroraCurveByYear.size === 0) {
      return { investorPrice: 0, debtSizingPrice: 0 };
    }

    const lastYear = Math.max(...auroraCurveByYear.keys());
    const lastCurve = auroraCurveByYear.get(lastYear)!;
    return {
      investorPrice: lastCurve.central * (input.investorCurveW ?? 1) * inflFactor,
      debtSizingPrice:
        (lastCurve.central * (input.debtSizingCentralW ?? 0.7) +
          lastCurve.low * (input.debtSizingLowW ?? 0.3)) *
        inflFactor,
    };
  }

  return {
    investorPrice: auroraCurve.central * (input.investorCurveW ?? 1) * inflFactor,
    debtSizingPrice:
      (auroraCurve.central * (input.debtSizingCentralW ?? 0.7) +
        auroraCurve.low * (input.debtSizingLowW ?? 0.3)) *
      inflFactor,
  };
}

function hasDetailedCapexInput(input: FinanceEngineInput) {
  return (
    input.surfaceHa != null ||
    input.prixModuleUSDWc != null ||
    input.boSCtWc != null ||
    input.raccordementOuvrageKEuro != null ||
    input.tarifQPKEuroPerMW != null ||
    input.apportAffaireMode != null ||
    input.apportAffaireValeur != null ||
    input.contingencyRate != null ||
    input.longueurModule != null ||
    input.largeurModule != null ||
    input.txAmenagementRate != null ||
    input.coefArcheo != null
  );
}

function hasDetailedOpexInput(input: FinanceEngineInput) {
  return (
    input.omFixedEuroKwc != null ||
    input.mraEuroKwc != null ||
    input.backOfficeKeuro != null ||
    input.diversOpexKeuro != null ||
    input.loyerMode != null ||
    input.loyerValeur != null ||
    input.loyerInflation != null ||
    input.inflationOM != null ||
    input.inflationMRA != null ||
    input.inflationBackOffice != null ||
    input.inflationDivers != null ||
    input.methodeTaxes != null ||
    input.tauxTFCommune != null ||
    input.tauxTFEPCI != null ||
    input.tauxTSE != null ||
    input.tauxGEMAPI != null ||
    input.tauxTEOM != null ||
    input.tauxCFECommune != null ||
    input.tauxCFEEPCI != null ||
    input.tauxCCI != null ||
    input.prixTerrainHa != null ||
    input.abattTerrain != null ||
    input.inflationTaxes != null ||
    input.iferRate1 != null ||
    input.iferRate2 != null ||
    input.iferRpn != null
  );
}

function taxeLocale(baseEuro: number, taux: number[], frais: readonly number[]) {
  const composantes = taux.map((tauxValue) => tauxValue / 100 * baseEuro);
  const fraisGestion = composantes.reduce(
    (total, composante, index) => total + composante * (frais[index] ?? 0),
    0,
  );

  return composantes.reduce((total, composante) => total + composante, 0) + fraisGestion;
}

function calculateIferKeuro(input: FinanceEngineInput, year: number) {
  const rpn = input.iferRpn ?? IFER_RPN_FALLBACK;
  const puissanceInjectee = rpn > 0 ? input.capacityMw / rpn : 0;
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const iferRate =
    year <= contractDuration
      ? input.iferRate1 ?? IFER_RATE_1_FALLBACK
      : input.iferRate2 ?? IFER_RATE_2_FALLBACK;

  return puissanceInjectee * iferRate;
}

export function calculateTaxesFoncieres(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  year = 1,
): TaxesFoncieresOpexResult {
  const methode = input.methodeTaxes ?? METHODE_TAXES_FALLBACK;
  const capexTotalEuro = capexTotalKeuro * 1000;
  const inflationFactor = (1 + asRate(input.inflationTaxes ?? 0.4)) ** year;

  if (methode === "appreciation_directe") {
    // Base foncière passible (€) — input direct ou fallback 2.93% du CAPEX
    const baseFonciereEuro =
      input.baseFonciereKeuro != null
        ? input.baseFonciereKeuro * 1000
        : capexTotalEuro * RATIO_PART_FONC_AD;
    // Valeur terrain (€) — input direct ou fallback surface × 5000 €/ha
    const valeurTerrainEuro =
      input.valeurTerrainKeuro != null
        ? input.valeurTerrainKeuro * 1000
        : (input.surfaceHa ?? 0) * VALEUR_VENALE_HA_AD;

    // Base cadastrale commune TF et CFE (Règle 6 — base TFPB confirmée = 7 498 €)
    const revCadCentrale = baseFonciereEuro * TAUX_LF_AD * (1 - ABATT_AD);
    const revCadTerrain  = valeurTerrainEuro * TAUX_LF_AD * COEF_NEUTRAL_AD * (1 - ABATT_AD);
    const baseCadEuro    = revCadCentrale + revCadTerrain;

    // Taux appliqués en décimal (0.3069 = 30.69% — pas de /100)
    const sommeTF =
      (input.tauxTFCommune ?? 0) + (input.tauxTFEPCI ?? 0) +
      (input.tauxTSE ?? 0) + (input.tauxGEMAPI ?? 0) + (input.tauxTEOM ?? 0);
    const sommeCFE =
      (input.tauxCFECommune ?? 0) + (input.tauxCFEEPCI ?? 0) +
      (input.tauxTSECfe ?? 0) + (input.tauxGEMAPICfe ?? 0) + (input.tauxCCI ?? 0);

    const tfAnnuelleKeuro  = (baseCadEuro * sommeTF  + FRAIS_TF_EURO)  / 1000;
    const cfeAnnuelleKeuro = (baseCadEuro * sommeCFE + FRAIS_CFE_EURO) / 1000;

    return {
      baseTaxesKeuro: baseCadEuro / 1000,
      tfAnnuelleKeuro,
      cfeAnnuelleKeuro,
      tfKeuro:  tfAnnuelleKeuro  * inflationFactor,
      cfeKeuro: cfeAnnuelleKeuro * inflationFactor,
    };
  }

  // Chemin "comptable" — inchangé (Sigoulès)
  const baseTaxesEuro =
    methode === "comptable"
      ? capexTotalEuro * TAUX_LF_COMPTA * (1 - ABATT_IMMO)
      : capexTotalEuro * TAUX_LF_AD * (1 - ABATT_IMMO) +
        (input.surfaceHa ?? 0) *
          (input.prixTerrainHa ?? 5000) *
          TAUX_LF_AD *
          COEF_NEUTRAL *
          (1 - (input.abattTerrain ?? 0) / 100);
  const tauxTF = [
    input.tauxTFCommune,
    input.tauxTFEPCI,
    input.tauxTSE,
    input.tauxGEMAPI,
    input.tauxTEOM,
  ].map((taux) => taux ?? 0);
  const tauxCFE = [
    input.tauxCFECommune,
    input.tauxCFEEPCI,
    input.tauxGEMAPI,
    input.tauxCCI,
  ].map((taux) => taux ?? 0);
  const tfAnnuelleKeuro  = taxeLocale(baseTaxesEuro, tauxTF,  FRAIS_TF)  / 1000;
  const cfeAnnuelleKeuro = taxeLocale(baseTaxesEuro, tauxCFE, FRAIS_CFE) / 1000;

  return {
    baseTaxesKeuro: baseTaxesEuro / 1000,
    tfAnnuelleKeuro,
    cfeAnnuelleKeuro,
    tfKeuro:  tfAnnuelleKeuro  * inflationFactor,
    cfeKeuro: cfeAnnuelleKeuro * inflationFactor,
  };
}

export function calculateCapexDetails(input: FinanceEngineInput): CapexDetails {
  const hasDetailedCapex = hasDetailedCapexInput(input);
  const legacyCapexTotal = input.capex * input.capacityMw;

  if (!hasDetailedCapex) {
    return {
      hasDetailedCapex,
      modulesKeuro: 0,
      modulesCtWc: 0,
      boSKeuro: 0,
      boSCtWc: 0,
      raccordementKeuro: 0,
      apportAffaireKeuro: 0,
      devFeesKeuro: 0,
      capexBeforeContingencyKeuro: legacyCapexTotal,
      contingencyKeuro: 0,
      nbPanneaux: 0,
      m2PV: 0,
      taxeAmenagementKeuro: 0,
      taxeArcheoKeuro: 0,
      taxesFoncieresKeuro: 0,
      indemnitesImmoKeuro: 0,
      financingFeesKeuro: 0,
      capexTotalKeuro: legacyCapexTotal,
      capexPerMwKeuro: input.capacityMw > 0 ? legacyCapexTotal / input.capacityMw : 0,
    };
  }

  const tauxEURUSD = input.tauxEURUSD ?? TAUX_EUR_USD_FALLBACK;
  const modulePriceEurWc =
    input.prixModuleUSDWc != null && tauxEURUSD > 0
      ? input.prixModuleUSDWc / tauxEURUSD
      : 0;
  const modulesKeuro = modulePriceEurWc * input.capacityMw * 1_000_000 / 1000;
  const modulesCtWc =
    input.capacityMw > 0 ? modulesKeuro / (input.capacityMw * 1000) * 100 : 0;
  const boSKeuro = ((input.boSCtWc ?? 0) / 100) * input.capacityMw * 1000;
  const raccordQpKeuro = (input.capacityMw / 1.35) * (input.tarifQPKEuroPerMW ?? 0);
  const raccordementKeuro = (input.raccordementOuvrageKEuro ?? 0) + raccordQpKeuro;
  const apportAffaireValeur = input.apportAffaireValeur ?? 0;
  const apportAffaireKeuro =
    input.apportAffaireMode === "fixe"
      ? apportAffaireValeur
      : input.apportAffaireMode === "euroParMWc"
        ? apportAffaireValeur * input.capacityMw
        : input.apportAffaireMode === "euroParHa"
          ? apportAffaireValeur * (input.surfaceHa ?? 0)
          : 0;
  const devFeesKeuro = (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const capexBeforeContingencyKeuro =
    modulesKeuro + boSKeuro + raccordementKeuro + apportAffaireKeuro + devFeesKeuro;
  const contingencyKeuro = boSKeuro * (input.contingencyRate ?? 2) / 100;
  const nbPanneaux = (input.capacityMw * 1_000_000) / 650;
  const m2PV = nbPanneaux * (input.longueurModule ?? 2.382) * (input.largeurModule ?? 1.134);
  const taxeAmenagementEuro =
    (10 * m2PV + 21 * input.capacityMw * 930) *
    (input.txAmenagementRate ?? 4.5) /
    100;
  const taxeArcheoEuro = (input.coefArcheo ?? 0.71) * m2PV;
  const taxeAmenagementKeuro = taxeAmenagementEuro / 1000;
  const taxeArcheoKeuro = taxeArcheoEuro / 1000;
  const taxesFoncieresKeuro = taxeAmenagementKeuro + taxeArcheoKeuro;
  const indemnitesImmoKeuro = input.indemnitesImmoKeuro ?? 0;
  const financingFeesKeuro = input.financingFeesKeuro ?? 0;
  const capexTotalKeuro =
    capexBeforeContingencyKeuro + contingencyKeuro + taxesFoncieresKeuro
    + indemnitesImmoKeuro + financingFeesKeuro;

  return {
    hasDetailedCapex,
    modulesKeuro,
    modulesCtWc,
    boSKeuro,
    boSCtWc: input.boSCtWc ?? 0,
    raccordementKeuro,
    apportAffaireKeuro,
    devFeesKeuro,
    capexBeforeContingencyKeuro,
    contingencyKeuro,
    nbPanneaux,
    m2PV,
    taxeAmenagementKeuro,
    taxeArcheoKeuro,
    taxesFoncieresKeuro,
    indemnitesImmoKeuro,
    financingFeesKeuro,
    capexTotalKeuro,
    capexPerMwKeuro: input.capacityMw > 0 ? capexTotalKeuro / input.capacityMw : 0,
  };
}

function resolveBaseCapexKeuro(input: FinanceEngineInput) {
  return input.capex > 0
    ? input.capex * input.capacityMw
    : calculateCapexDetails(input).capexTotalKeuro;
}

function hasFinancingFeesInput(input: FinancingFeesInput) {
  return (
    input.legalFeesKEuro != null ||
    input.technicalDDKEuro != null ||
    input.arrangerFeesRate != null ||
    input.participantFeesRate != null ||
    input.bankFeesPLTKEuroPerMW != null ||
    input.interimFinancingRate != null ||
    input.commitmentFeesRate != null
  );
}

export function calculateFinancingFees(
  input: FinancingFeesInput,
): FinancingFeesResult {
  if (!hasFinancingFeesInput(input)) {
    return {
      financingFeesKeuro: 0,
      estimatedPltKeuro: 0,
      financingFeesDetail: {
        legalFees: 0,
        technicalDD: 0,
        arrangerFees: 0,
        participantFees: 0,
        bankFeesPLT: 0,
        interimFinancing: 0,
        commitmentFees: 0,
      },
    };
  }

  const gearingMaxPct = input.gearingMaxPct ?? input.gearingMax ?? 95;
  const estimatedPltKeuro = input.capexTotalKeuro * 1.04 * gearingMaxPct / 100;
  const financingFeesDetail = {
    legalFees: input.legalFeesKEuro ?? 10,
    technicalDD: input.technicalDDKEuro ?? 5,
    arrangerFees: estimatedPltKeuro * (input.arrangerFeesRate ?? 0.8) / 100,
    participantFees: estimatedPltKeuro * (input.participantFeesRate ?? 0.4) / 100,
    bankFeesPLT: (input.bankFeesPLTKEuroPerMW ?? 1.5) * input.capacityMw,
    interimFinancing: estimatedPltKeuro * (input.interimFinancingRate ?? 2.5) / 100,
    commitmentFees: estimatedPltKeuro * (input.commitmentFeesRate ?? 0.1) / 100,
  };
  const financingFeesKeuro = Object.values(financingFeesDetail).reduce(
    (total, value) => total + value,
    0,
  );

  return {
    financingFeesKeuro,
    estimatedPltKeuro,
    financingFeesDetail,
  };
}

export function calculateOpexDetails(
  input: FinanceEngineInput,
  year: number,
  revenueP50Keuro: number,
  productionP50Mwh: number,
  baseCapexKeuro?: number,
): OpexDetails {
  const assuranceRate = asRate(input.assuranceRate ?? ASSURANCE_RATE_FALLBACK);
  const inflationAssurance = asRate(
    input.inflationAssurance ?? INFLATION_ASSURANCE_FALLBACK,
  );
  const balancingCost = input.balancingCost ?? BALANCING_COST_FALLBACK;
  const assuranceKeuro =
    assuranceRate * revenueP50Keuro * (1 + inflationAssurance) ** (year - 1);
  const balancingKeuro = (balancingCost * productionP50Mwh) / 1000;
  const iferKeuro = calculateIferKeuro(input, year);
  const hasDetailedOpex = hasDetailedOpexInput(input);
  const taxesLocales = calculateTaxesFoncieres(
    input,
    baseCapexKeuro ?? resolveBaseCapexKeuro(input),
    year,
  );

  const aleasKeuro = asRate(input.aleasOpexRate ?? 0.5) * revenueP50Keuro;

  if (!hasDetailedOpex) {
    const legacyOpexKeuro =
      input.opex * input.capacityMw * (1 + asRate(input.opexInflationRate)) ** year;
    const opexTotalKeuro =
      legacyOpexKeuro +
      assuranceKeuro +
      balancingKeuro +
      iferKeuro +
      taxesLocales.tfKeuro +
      taxesLocales.cfeKeuro +
      aleasKeuro;

    return {
      hasDetailedOpex,
      omKeuro: 0,
      mraKeuro: 0,
      backOfficeKeuro: 0,
      diversKeuro: legacyOpexKeuro,
      loyerKeuro: 0,
      assuranceKeuro,
      balancingKeuro,
      iferKeuro,
      baseTaxesKeuro: taxesLocales.baseTaxesKeuro,
      tfKeuro: taxesLocales.tfKeuro,
      cfeKeuro: taxesLocales.cfeKeuro,
      aleasKeuro,
      opexTotalKeuro,
      opexPerMwKeuro: input.capacityMw > 0 ? opexTotalKeuro / input.capacityMw : 0,
    };
  }

  const omKeuro =
    (input.omFixedEuroKwc ?? OM_FIXED_EURO_KWC_FALLBACK) *
    input.capacityMw *
    (1 + asRate(input.inflationOM ?? INFLATION_OM_FALLBACK)) ** (year - 1);
  const mraKeuro =
    (input.mraEuroKwc ?? MRA_EURO_KWC_FALLBACK) *
    input.capacityMw *
    (1 + asRate(input.inflationMRA ?? INFLATION_MRA_FALLBACK)) ** (year - 1);
  const backOfficeKeuro =
    (input.backOfficeKeuro ?? BACK_OFFICE_KEURO_FALLBACK) *
    (1 + asRate(input.inflationBackOffice ?? INFLATION_BACK_OFFICE_FALLBACK)) ** (year - 1);
  const diversKeuro =
    (input.diversOpexKeuro ?? DIVERS_OPEX_KEURO_FALLBACK) *
    (1 + asRate(input.inflationDivers ?? INFLATION_DIVERS_FALLBACK)) ** (year - 1);
  const loyerValeur = input.loyerValeur ?? 0;
  const loyerBaseKeuro =
    input.loyerMode === "fixe"
      ? loyerValeur
      : input.loyerMode === "euroParHa"
        ? loyerValeur * (input.surfaceHa ?? 0) / 1000
        : input.loyerMode === "euroParMWc"
          ? loyerValeur * input.capacityMw / 1000
          : input.loyerMode === "pctCA"
            ? asRate(loyerValeur) * revenueP50Keuro
            : 0;
  const loyerKeuro =
    loyerBaseKeuro * (1 + asRate(input.loyerInflation ?? LOYER_INFLATION_FALLBACK)) ** (year - 1);
  const opexTotalKeuro =
    omKeuro +
    mraKeuro +
    backOfficeKeuro +
    diversKeuro +
    loyerKeuro +
    assuranceKeuro +
    balancingKeuro +
    iferKeuro +
    taxesLocales.tfKeuro +
    taxesLocales.cfeKeuro +
    aleasKeuro;

  return {
    hasDetailedOpex,
    omKeuro,
    mraKeuro,
    backOfficeKeuro,
    diversKeuro,
    loyerKeuro,
    assuranceKeuro,
    balancingKeuro,
    iferKeuro,
    baseTaxesKeuro: taxesLocales.baseTaxesKeuro,
    tfKeuro: taxesLocales.tfKeuro,
    cfeKeuro: taxesLocales.cfeKeuro,
    aleasKeuro,
    opexTotalKeuro,
    opexPerMwKeuro: input.capacityMw > 0 ? opexTotalKeuro / input.capacityMw : 0,
  };
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
function resolveBindingConstraint(
  debtSculptedKeuro: number,
  debtGearingMaxKeuro: number | null,
): SizingResult["bindingConstraint"] {
  if (debtGearingMaxKeuro === null) {
    return "dscr";
  }

  if (Math.abs(debtSculptedKeuro - debtGearingMaxKeuro) < 0.001) {
    return "equal";
  }

  return debtSculptedKeuro < debtGearingMaxKeuro ? "dscr" : "gearing";
}

/**
 * Sculpts debt: determines the maximum senior debt amount compatible with a
 * per-year DSCR schedule, given a P90 CFADS profile over the debt tenor.
 *
 * Method:
 *   - Bisection on the debt amount between 0 and the effective CAPEX ceiling.
 *   - Debt service for year t targets cfadsP90(t) / dscrForYear(t, schedule).
 *   - For each candidate, interest is charged on the outstanding
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
  debtMaxKeuro?: number,
): { debtAmountKeuro: number; schedule: DebtScheduleItem[] } | null {
  if (dscrSchedule.length === 0 || tenorYears <= 0) {
    return null;
  }

  const debtRate = asRate(debtInterestRatePercent);
  const tenorFlows = cashFlows.filter((r) => r.year <= tenorYears);

  // debtAmount = Σ(t=1..tenor) [cfadsP90(t) / dscrTarget(t)] / (1 + r)^t
  const legacyDebtCapacityKeuro = tenorFlows.reduce((pv, row) => {
    return (
      pv +
      row.cfadsP90Keuro / dscrForYear(row.year, dscrSchedule) / (1 + debtRate) ** row.year
    );
  }, 0);

  if (legacyDebtCapacityKeuro <= 0) {
    return { debtAmountKeuro: 0, schedule: [] };
  }

  const buildSchedule = (debtAmountKeuro: number) => {
    const schedule: DebtScheduleItem[] = [];
    let outstanding = debtAmountKeuro;
    let minDscrDelta = Number.POSITIVE_INFINITY;
    let maxAbsDscrDelta = 0;

    for (const row of tenorFlows) {
      const interest = outstanding * debtRate;
      const targetDscr = dscrForYear(row.year, dscrSchedule);
      const targetDebtService = row.cfadsP90Keuro / targetDscr;
      const principal = Math.min(Math.max(0, targetDebtService - interest), outstanding);
      const debtService = principal + interest;
      outstanding = Math.max(0, outstanding - principal);

      if (debtService > 0) {
        const dscrRealized = row.cfadsP90Keuro / debtService;
        const dscrDelta = dscrRealized - targetDscr;
        minDscrDelta = Math.min(minDscrDelta, dscrDelta);
        maxAbsDscrDelta = Math.max(maxAbsDscrDelta, Math.abs(dscrDelta));
      }

      schedule.push({ year: row.year, principal, interest, outstanding });
    }

    return { schedule, outstanding, minDscrDelta, maxAbsDscrDelta };
  };

  let debtMin = 0;
  let debtMax = Math.max(0, debtMaxKeuro ?? legacyDebtCapacityKeuro);
  let debtAmountKeuro = debtMin;
  let result = buildSchedule(debtAmountKeuro);

  for (let index = 0; index < 100; index += 1) {
    const debtMid = (debtMin + debtMax) / 2;
    const candidate = buildSchedule(debtMid);
    debtAmountKeuro = debtMid;
    result = candidate;

    const hasRemainingDebt = candidate.outstanding > 0.0001;
    const dscrBelowTarget = candidate.minDscrDelta < -0.0001;

    if (!hasRemainingDebt && candidate.maxAbsDscrDelta < 0.0001) {
      break;
    }

    if (hasRemainingDebt || dscrBelowTarget) {
      debtMax = debtMid;
    } else {
      debtMin = debtMid;
    }
  }

  return { debtAmountKeuro, schedule: result.schedule };
}

function debtScheduleFromRetainedDebt(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90AfterTaxKeuro: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
  debtRetenuKeuro: number,
) {
  const debtRate = asRate(debtInterestRatePercent);
  const schedule = new Map<number, RetainedDebtScheduleItem>();
  let outstanding = Math.max(0, debtRetenuKeuro);

  for (const row of cashFlows.filter((cashFlow) => cashFlow.year <= tenorYears)) {
    if (outstanding <= 0) {
      schedule.set(row.year, { principal: 0, interest: 0, outstanding: 0 });
      continue;
    }

    const interest = outstanding * debtRate;
    const targetDebtService =
      row.cfadsP90AfterTaxKeuro / dscrForYear(row.year, dscrSchedule);
    const principal = Math.min(Math.max(0, targetDebtService - interest), outstanding);

    outstanding = Math.max(0, outstanding - principal);
    schedule.set(row.year, { principal, interest, outstanding });
  }

  return schedule;
}

function presentValueDebtCapacity(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90AfterTaxKeuro: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
) {
  const debtRate = asRate(debtInterestRatePercent);

  return Math.max(
    0,
    cashFlows
      .filter((row) => row.year <= tenorYears)
      .reduce((pv, row) => {
        const service = row.cfadsP90AfterTaxKeuro / dscrForYear(row.year, dscrSchedule);
        return pv + service / (1 + debtRate) ** row.year;
      }, 0),
  );
}

type MarginSizingResult = {
  sizing: SizingResult;
  scheduleByYear: Map<number, RetainedDebtScheduleItem>;
  iterationsCount: number;
};

function sizingWithFacturableMargin(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  margeFactKeuro: number,
  dscrSchedule: DscrTranche[],
  debtTenorYears: number,
  gearingMaxPct: number | null,
): MarginSizingResult {
  const discountRate = asRate(input.discountRate);
  const capexEffectifKeuro = capexTotalKeuro + margeFactKeuro;
  const debtGearingMaxKeuro =
    gearingMaxPct !== null ? capexEffectifKeuro * gearingMaxPct / 100 : null;
  let debtRetenuKeuro = 0;
  let scheduleByYear = new Map<number, RetainedDebtScheduleItem>();
  let preRows = buildPreRows(input, capexEffectifKeuro);
  let taxRows = applyWaterfall(
    preRows,
    scheduleByYear,
    input,
    discountRate,
    dscrSchedule,
    debtTenorYears,
    0,
  );
  let debtSculptedKeuro = 0;
  let iterationsCount = 0;

  for (let iteration = 0; iteration < 50; iteration += 1) {
    iterationsCount = iteration + 1;
    scheduleByYear = debtScheduleFromRetainedDebt(
      taxRows,
      dscrSchedule,
      input.debtInterestRate,
      debtTenorYears,
      debtRetenuKeuro,
    );
    preRows = buildPreRows(input, capexEffectifKeuro);
    taxRows = applyWaterfall(
      preRows,
      scheduleByYear,
      input,
      discountRate,
      dscrSchedule,
      debtTenorYears,
      0,
    );
    debtSculptedKeuro = presentValueDebtCapacity(
      taxRows,
      dscrSchedule,
      input.debtInterestRate,
      debtTenorYears,
    );

    const nextDebtRetenuKeuro =
      debtGearingMaxKeuro !== null
        ? Math.min(debtSculptedKeuro, debtGearingMaxKeuro)
        : debtSculptedKeuro;

    if (Math.abs(nextDebtRetenuKeuro - debtRetenuKeuro) < 0.001) {
      debtRetenuKeuro = nextDebtRetenuKeuro;
      break;
    }

    debtRetenuKeuro = nextDebtRetenuKeuro;
  }

  scheduleByYear = debtScheduleFromRetainedDebt(
    taxRows,
    dscrSchedule,
    input.debtInterestRate,
    debtTenorYears,
    debtRetenuKeuro,
  );
  preRows = buildPreRows(input, capexEffectifKeuro);
  taxRows = applyWaterfall(
    preRows,
    scheduleByYear,
    input,
    discountRate,
    dscrSchedule,
    debtTenorYears,
    0,
  );
  debtSculptedKeuro = presentValueDebtCapacity(
    taxRows,
    dscrSchedule,
    input.debtInterestRate,
    debtTenorYears,
  );

  const gearingActuel =
    capexEffectifKeuro > 0 ? debtRetenuKeuro / capexEffectifKeuro : 0;

  return {
    sizing: {
      debtSculptedKeuro,
      debtGearingMaxKeuro,
      debtRetenuKeuro,
      margeFactKeuro,
      gearingActuel,
      bindingConstraint: resolveBindingConstraint(debtSculptedKeuro, debtGearingMaxKeuro),
      iterationsCount,
    },
    scheduleByYear,
    iterationsCount,
  };
}

function ajusteMargeFacturable(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  dscrSchedule: DscrTranche[],
  debtTenorYears: number,
  gearingMaxPct: number,
): MarginSizingResult {
  let iterationsCount = 0;
  let result = sizingWithFacturableMargin(
    input,
    capexTotalKeuro,
    0,
    dscrSchedule,
    debtTenorYears,
    gearingMaxPct,
  );
  iterationsCount += result.iterationsCount;
  const gearingMaxRatio = gearingMaxPct / 100;

  if (result.sizing.gearingActuel < gearingMaxRatio) {
    result.sizing.iterationsCount = iterationsCount;
    return result;
  }

  let marge = 0;
  let margePrecedente = 0;
  let pas = 20_000;
  const maxIter = 500;
  let marginIterations = 0;

  while (result.sizing.gearingActuel > gearingMaxRatio && marginIterations < maxIter) {
    margePrecedente = marge;
    marge += pas;
    result = sizingWithFacturableMargin(
      input,
      capexTotalKeuro,
      marge,
      dscrSchedule,
      debtTenorYears,
      gearingMaxPct,
    );
    iterationsCount += result.iterationsCount;
    pas *= 2;
    marginIterations += 1;
  }

  pas = (marge - margePrecedente) / 2;
  marge = margePrecedente;

  while (pas > 1 && marginIterations < maxIter) {
    marge += pas;
    result = sizingWithFacturableMargin(
      input,
      capexTotalKeuro,
      marge,
      dscrSchedule,
      debtTenorYears,
      gearingMaxPct,
    );
    iterationsCount += result.iterationsCount;

    if (result.sizing.gearingActuel < gearingMaxRatio) {
      marge -= pas;
    }

    pas /= 2;
    marginIterations += 1;
  }

  result = sizingWithFacturableMargin(
    input,
    capexTotalKeuro,
    marge,
    dscrSchedule,
    debtTenorYears,
    gearingMaxPct,
  );
  iterationsCount += result.iterationsCount;
  result.sizing.iterationsCount = iterationsCount;

  return result;
}

function degressiveAmortizationCoefficient(durationYears: number) {
  if (durationYears >= 3 && durationYears <= 4) {
    return 1.25;
  }

  if (durationYears >= 5 && durationYears <= 6) {
    return 1.75;
  }

  if (durationYears > 6) {
    return 2.25;
  }

  return 1;
}

function buildAmortizationSchedule(
  initialInvestmentKeuro: number,
  amortDuree: number,
  projectLifeYears: number,
  capexType1Keuro?: number | null,
  capexType2Keuro?: number | null,
): AmortizationScheduleItem[] {
  const schedule: AmortizationScheduleItem[] = [];
  const hasTypedCapex = capexType1Keuro != null || capexType2Keuro != null;
  let type1OutstandingKeuro = hasTypedCapex
    ? Math.max(0, capexType1Keuro ?? 0)
    : Math.max(0, initialInvestmentKeuro);
  let type2OutstandingKeuro = hasTypedCapex
    ? Math.max(0, capexType2Keuro ?? 0)
    : 0;
  let vncKeuro = type1OutstandingKeuro + type2OutstandingKeuro;

  if (projectLifeYears <= 0) {
    return schedule;
  }

  if (amortDuree <= 0) {
    for (let year = 1; year <= projectLifeYears; year += 1) {
      schedule.push({ amort: 0, vncKeuro });
    }

    return schedule;
  }

  const linearRate = 1 / amortDuree;
  const degressiveRate = linearRate * degressiveAmortizationCoefficient(amortDuree);
  const type2AnnualAmortKeuro = type2OutstandingKeuro / amortDuree;

  for (let year = 1; year <= projectLifeYears; year += 1) {
    let type1AmortKeuro = 0;
    let type2AmortKeuro = 0;

    if (year <= amortDuree && type1OutstandingKeuro > 0) {
      const remainingYears = amortDuree - year + 1;
      const degressiveAmort = type1OutstandingKeuro * degressiveRate;
      const linearAmort = remainingYears > 0
        ? type1OutstandingKeuro / remainingYears
        : type1OutstandingKeuro;
      type1AmortKeuro = Math.min(
        type1OutstandingKeuro,
        Math.max(degressiveAmort, linearAmort),
      );
      type1OutstandingKeuro = Math.max(0, type1OutstandingKeuro - type1AmortKeuro);
    }

    if (year <= amortDuree && type2OutstandingKeuro > 0) {
      type2AmortKeuro = Math.min(type2OutstandingKeuro, type2AnnualAmortKeuro);
      type2OutstandingKeuro = Math.max(0, type2OutstandingKeuro - type2AmortKeuro);
    }

    const amort = type1AmortKeuro + type2AmortKeuro;
    vncKeuro = type1OutstandingKeuro + type2OutstandingKeuro;
    schedule.push({ amort, vncKeuro });
  }

  return schedule;
}

function buildPreRows(
  input: FinanceEngineInput,
  investmentOverrideKeuro?: number,
): PreRow[] {
  const initialInvestment =
    investmentOverrideKeuro ?? calculateCapexDetails(input).capexTotalKeuro;
  const initialDebt = initialInvestment * (input.debtRate / 100);
  const degradationRate = asRate(input.degradationRate);
  const debtInterestRate = asRate(input.debtInterestRate);
  const tariffInflationRate = asRate(input.tariffInflationRate);
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
  const amortizationSchedule = buildAmortizationSchedule(
    initialInvestment,
    input.amortDuree ?? input.projectLifeYears,
    input.projectLifeYears,
    input.capexType1Keuro,
    input.capexType2Keuro,
  );
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const auroraCurveByYear = buildAuroraCurveByYear(input);
  const baseCapexKeuro = resolveBaseCapexKeuro(input);
  // P90 yield: use provided value or fall back to P50 * 0.93.
  const effectiveYieldP90 = input.yieldP90Mwh ?? input.yieldMwh * 0.93;

  const preRows: PreRow[] = [];

  for (let year = 1; year <= input.projectLifeYears; year += 1) {
    const degradationFactor = (1 - degradationRate) ** (year - 1);

    // P50 production year N = yield P50 MWh/MW/year * MW * annual degradation.
    const productionP50 = input.yieldMwh * input.capacityMw * degradationFactor;

    // P90 production year N = yield P90 MWh/MW/year * MW * annual degradation.
    const productionP90 = effectiveYieldP90 * input.capacityMw * degradationFactor;

    const contractedTariff = input.tariff * (1 + tariffInflationRate) ** (year - 1);
    const merchantPrices = resolveMerchantPrices(
      input,
      auroraCurveByYear,
      year,
    );
    // Tariff year N applies during the contract period, then merchant prices take over.
    const annualTariff =
      year <= contractDuration
        ? contractedTariff
        : merchantPrices.investorPrice;

    const annualTariffP90 =
      year <= contractDuration
        ? contractedTariff
        : merchantPrices.debtSizingPrice;

    // Revenue kEUR = production MWh * price EUR/MWh / 1000.
    const revenueP50 = (productionP50 * annualTariff) / 1000;

    // Capacity certificate revenue, inflated from the fixed 2024 BP base year.
    const calendarYear = (input.commissioningYear ?? 0) + year - 1;
    const capacityPriceCurve = input.capacityPriceCurve ?? [];
    const capacityIdx = calendarYear - 2025;
    const capacityPriceBrut =
      capacityIdx >= 0 && capacityIdx < capacityPriceCurve.length
        ? capacityPriceCurve[capacityIdx]
        : (capacityPriceCurve.length > 0
            ? capacityPriceCurve[capacityPriceCurve.length - 1]
            : 0);
    const capacityInflation =
      (1 + asRate(input.inflationAurora ?? 2)) ** (calendarYear - 2024);
    const capacityKw = (input.capacityCertificateMw ?? 0) * 1000;
    const revenueCapacityKeuro =
      (capacityPriceBrut * capacityInflation * capacityKw) / 1000;

    // Guarantees of origin start at the configured project year.
    const hasGoRevenue = input.goStartYear != null || input.goPriceBase != null;
    const goStartYear = input.goStartYear ?? 21;
    const goPriceBase = input.goPriceBase ?? 1;
    const goInflation = (1 + asRate(input.inflationOM ?? 2)) ** (year - 1);
    const revenueGoKeuro =
      hasGoRevenue && year >= goStartYear
        ? (goPriceBase * goInflation * productionP50) / 1000
        : 0;
    const revenueP50Total = revenueP50 + revenueCapacityKeuro + revenueGoKeuro;
    const revenueP90 = (productionP90 * annualTariffP90) / 1000;

    const annualOpex =
      calculateOpexDetails(
        input,
        year,
        revenueP50Total,
        productionP50,
        baseCapexKeuro,
      ).opexTotalKeuro;

    // Equity cash-flow (P50) kEUR = revenue P50 - OPEX (project NPV/IRR base).
    const cfadsP50 = revenueP50Total - annualOpex;

    // Banking CFADS (P90) kEUR = revenue P90 - OPEX (DSCR sizing base).
    const cfadsP90 = revenueP90 - annualOpex;

    const debtService = year <= input.debtMaturityYears ? annualDebtService : 0;
    const standardDebtInterest =
      standardDebtSchedule.get(year)?.interest ?? 0;
    const standardDebtOutstanding =
      standardDebtSchedule.get(year)?.outstanding ?? 0;
    const amortization = amortizationSchedule[year - 1] ?? {
      amort: 0,
      vncKeuro: initialInvestment,
    };

    preRows.push({
      year,
      annualTariff,
      productionP50Mwh: productionP50,
      productionP90Mwh: productionP90,
      revenueP50Keuro: revenueP50Total,
      revenueP90Keuro: revenueP90,
      opexKeuro: annualOpex,
      cashFlowKeuro: cfadsP50,
      cfadsP90Keuro: cfadsP90,
      debtServiceKeuro: debtService,
      standardDebtInterestKeuro: standardDebtInterest,
      standardDebtOutstandingKeuro: standardDebtOutstanding,
      amort: amortization.amort,
      vncKeuro: amortization.vncKeuro,
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
      debtOutstandingKeuro: scheduleItem?.outstanding ?? pre.standardDebtOutstandingKeuro,
      cfadsP90Keuro: pre.cfadsP90Keuro,
      amort: pre.amort,
      vncKeuro: pre.vncKeuro,
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
        debtService > 0
          ? (pre.cfadsP90Keuro - isP90) / debtService
          : null,
      // Target DSCR for this year from the schedule (null when no sculpting or beyond tenor).
      dscrTargetAtYear:
        effectiveSchedule !== null && pre.year <= effectiveTenor
          ? dscrForYear(pre.year, effectiveSchedule)
          : null,
    };
  });
}

function zeroAnnualCashFlow(year: number): AnnualCashFlow {
  return {
    year,
    annualTariff: 0,
    productionP50Mwh: 0,
    productionP90Mwh: 0,
    revenueP50Keuro: 0,
    revenueP90Keuro: 0,
    opexKeuro: 0,
    cashFlowKeuro: 0,
    discountedCashFlowKeuro: 0,
    debtServiceKeuro: 0,
    debtServiceSculptedKeuro: null,
    debtOutstandingKeuro: 0,
    cfadsP90Keuro: 0,
    cfadsP90AfterTaxKeuro: 0,
    amort: 0,
    vncKeuro: 0,
    ebit: 0,
    interets: 0,
    ebt: 0,
    is: 0,
    resultatNet: 0,
    cfadsAfterTax: 0,
    dividende: 0,
    fluxActionnaire: 0,
    ccaRemboursementKeuro: 0,
    ccaInteretsKeuro: 0,
    ccaOutstandingKeuro: 0,
    deficitCumuleKeuro: 0,
    resultatCumuleKeuro: 0,
    dsraSoldeKeuro: 0,
    dsraDepotKeuro: 0,
    dsraRetraitKeuro: 0,
    cashBloqueKeuro: 0,
    dscr: null,
    dscrRealized: null,
    dscrTargetAtYear: null,
  };
}

function withConstructionRows(
  rows: AnnualCashFlow[],
  constructionYears: number,
): AnnualCashFlow[] {
  const constructionRows = Array.from(
    { length: constructionYears + 1 },
    (_, index) => zeroAnnualCashFlow(-constructionYears + index),
  );

  return [...constructionRows, ...rows];
}

function calculateFinancing(input: FinanceEngineInput): SizingComputation {
  const capexTotalKeuro = calculateCapexDetails(input).capexTotalKeuro;
  const financingFees = calculateFinancingFees({
    ...input,
    capexTotalKeuro,
  });
  const initialInvestment = capexTotalKeuro + financingFees.financingFeesKeuro;
  const discountRate = asRate(input.discountRate);
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor = input.debtTenorYears ?? input.debtMaturityYears;

  const hasSculpting = effectiveSchedule !== null && effectiveTenor > 0;

  if (!hasSculpting) {
    const retainedDebt = initialInvestment * input.debtRate / 100;
    const annualCashFlows = applyWaterfall(
      buildPreRows(input, initialInvestment),
      new Map(),
      input,
      discountRate,
      effectiveSchedule,
      effectiveTenor,
      Math.max(0, initialInvestment - retainedDebt),
    );

    return {
      sizing: null,
      scheduleByYear: new Map(),
      annualCashFlows: withConstructionRows(
        annualCashFlows,
        resolveConstructionYears(input),
      ),
      iterations: 0,
    };
  }

  const gearingMaxPct = resolveGearingMaxPct(input);
  const marginResult =
    gearingMaxPct === null
      ? sizingWithFacturableMargin(
          input,
          initialInvestment,
          0,
          effectiveSchedule,
          effectiveTenor,
          null,
        )
      : ajusteMargeFacturable(
          input,
          initialInvestment,
          effectiveSchedule,
          effectiveTenor,
          gearingMaxPct,
        );
  const capexEffectif = initialInvestment + marginResult.sizing.margeFactKeuro;
  const ccaPrincipalKeuro = Math.max(0, capexEffectif - marginResult.sizing.debtRetenuKeuro);
  const annualCashFlows = applyWaterfall(
    buildPreRows(input, capexEffectif),
    marginResult.scheduleByYear,
    input,
    discountRate,
    effectiveSchedule,
    effectiveTenor,
    ccaPrincipalKeuro,
  );

  return {
    sizing: marginResult.sizing,
    scheduleByYear: marginResult.scheduleByYear,
    annualCashFlows: withConstructionRows(
      annualCashFlows,
      resolveConstructionYears(input),
    ),
    iterations: marginResult.sizing.iterationsCount,
  };
}

export function calculateAnnualCashFlows(input: FinanceEngineInput): AnnualCashFlow[] {
  return calculateFinancing(input).annualCashFlows;
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  // Initial investment kEUR comes from detailed CAPEX when configured, else legacy capex kEUR/MW.
  const capexTotalKeuro = calculateCapexDetails(input).capexTotalKeuro;
  const financingFees = calculateFinancingFees({
    ...input,
    capexTotalKeuro,
  });
  const taxesLocales = calculateTaxesFoncieres(input, resolveBaseCapexKeuro(input));
  const iferKeuroAn1 = calculateIferKeuro(input, 1);
  const iferKeuroAn21 = calculateIferKeuro(input, 21);
  const initialInvestment = capexTotalKeuro + financingFees.financingFeesKeuro;
  const financing = calculateFinancing(input);
  const annualCashFlows = financing.annualCashFlows;
  const operatingCashFlows = annualCashFlows.filter((row) => row.year >= 1);
  const constructionYears = resolveConstructionYears(input);
  const postInvestmentZeroFlows = Array(constructionYears).fill(0) as number[];

  // VAN and TRI use after-tax P50 operating cash-flows.
  const cashFlows = operatingCashFlows.map((row) => row.cfadsAfterTax);
  const irrCashFlows = [...postInvestmentZeroFlows, ...cashFlows];
  const discountedCashFlows = operatingCashFlows.reduce(
    (total, row) => total + row.discountedCashFlowKeuro,
    0,
  );
  const discountedOpex = operatingCashFlows.reduce(
    (total, row) => total + discounted(row.opexKeuro, row.year, asRate(input.discountRate)),
    0,
  );
  // LCOE uses P50 production.
  const discountedProduction = operatingCashFlows.reduce(
    (total, row) =>
      total + discounted(row.productionP50Mwh, row.year, asRate(input.discountRate)),
    0,
  );
  // Minimum DSCR uses realized debt service only on years where principal + interest is paid.
  const dscrValues = annualCashFlows
    .map((row) => {
      const debtService = row.debtServiceSculptedKeuro ?? row.debtServiceKeuro;
      return debtService > 0 && row.dscrRealized !== null && row.dscrRealized < 100
        ? row.dscrRealized
        : null;
    })
    .filter((value): value is number => value !== null);

  const dscr = dscrValues.length > 0 ? Math.min(...dscrValues) : null;

  const sizing = financing.sizing;

  const margeFact = sizing?.margeFactKeuro ?? 0;
  const capexEffectif = initialInvestment + margeFact;

  // NPV kEUR = sum of discounted P50 cash-flows - effective CAPEX.
  const npv = discountedCashFlows - capexEffectif;

  // LCOE EUR/MWh = discounted total cost / discounted P50 production * 1000.
  const lcoe =
    discountedProduction > 0
      ? ((capexEffectif + discountedOpex) / discountedProduction) * 1000
      : 0;
  const retainedDebt = sizing?.debtRetenuKeuro ?? initialInvestment * input.debtRate / 100;
  const ccaKeuro = Math.max(0, capexEffectif - retainedDebt);
  const margeDev = input.margeDevKeuro ?? margeFact;
  const devFeesKeuro = (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const tauxISEntreprise = input.tauxISEntreprise ?? input.tauxIS ?? 0;
  const netEntrepriseFactor = 1 - asRate(tauxISEntreprise);
  const dsraInitialKeuro =
    operatingCashFlows.length > 0
      ? (operatingCashFlows[0].debtServiceSculptedKeuro ??
          operatingCashFlows[0].debtServiceKeuro) *
        (input.dsraMonths ?? 0) / 12
      : 0;
  const miseNetteInvest =
    ccaKeuro + devFeesKeuro + margeDev * (1 - asRate(input.tauxIS ?? 0));
  const miseNetteEntrep =
    miseNetteInvest - margeDev * netEntrepriseFactor - devFeesKeuro * netEntrepriseFactor;
  const shareholderFlows = [
    ...postInvestmentZeroFlows,
    ...operatingCashFlows.map((row) => row.fluxActionnaire),
  ];
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
        irrCashFlows,
        shareholderFlows,
      )
    : null;

  return {
    npv: round(npv),
    irr: round(calculateIrr(miseNetteInvest, shareholderFlows) * 100),
    lcoe: round(lcoe),
    dscr: dscr !== null ? round(dscr) : null,
    debtAmountKeuro: sizing !== null ? round(sizing.debtRetenuKeuro) : null,
    doubleIRR,
    sizingIterations: financing.iterations,
    financingFeesKeuro: round(financingFees.financingFeesKeuro),
    estimatedPltKeuro: round(financingFees.estimatedPltKeuro),
    financingFeesDetail: {
      legalFees: round(financingFees.financingFeesDetail.legalFees),
      technicalDD: round(financingFees.financingFeesDetail.technicalDD),
      arrangerFees: round(financingFees.financingFeesDetail.arrangerFees),
      participantFees: round(financingFees.financingFeesDetail.participantFees),
      bankFeesPLT: round(financingFees.financingFeesDetail.bankFeesPLT),
      interimFinancing: round(financingFees.financingFeesDetail.interimFinancing),
      commitmentFees: round(financingFees.financingFeesDetail.commitmentFees),
    },
    contingencyKeuro: round(calculateCapexDetails(input).contingencyKeuro),
    tfAnnuelleKeuro: round(taxesLocales.tfAnnuelleKeuro),
    cfeAnnuelleKeuro: round(taxesLocales.cfeAnnuelleKeuro),
    iferKeuroAn1: round(iferKeuroAn1),
    iferKeuroAn21: round(iferKeuroAn21),
    sizing: sizing !== null
      ? {
          ...sizing,
          debtSculptedKeuro: round(sizing.debtSculptedKeuro),
          debtGearingMaxKeuro:
            sizing.debtGearingMaxKeuro !== null ? round(sizing.debtGearingMaxKeuro) : null,
          debtRetenuKeuro: round(sizing.debtRetenuKeuro),
          margeFactKeuro: round(sizing.margeFactKeuro),
          gearingActuel: round(sizing.gearingActuel, 6),
        }
      : null,
  };
}
