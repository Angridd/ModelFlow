export type FinancialAssumptions = {
  projectLifeYears: number;
  degradationRate: number;
  discountRate: number;
  debtInterestRate: number;
  debtMaturityYears: number;
  tariffInflationRate: number;
  opexInflationRate: number;
};

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialAssumptions = {
  projectLifeYears: 35,
  degradationRate: 0.4,
  discountRate: 7.5,
  debtInterestRate: 4,
  debtMaturityYears: 20,
  tariffInflationRate: 0.4,
  opexInflationRate: 2,
};

export const DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS = {
  tauxIS: 25,
  tauxISEntreprise: 25,
  dsraMonths: 6,
  devFeesKEuroPerMW: 110,
  contingencyRate: 2,
  longueurModule: 2.382,
  largeurModule: 1.134,
  txAmenagementRate: 4.5,
  coefArcheo: 0.71,
  gearingMax: 95,
  contractDuration: 20,
  constructionYears: 1,
  assuranceRate: 2.5,
  inflationAssurance: 2,
  balancingCost: 2,
  omFixedEuroKwc: 5.1,
  mraEuroKwc: 1.1,
  backOfficeKeuro: 22,
  diversOpexKeuro: 35,
  loyerInflation: 0.4,
  inflationOM: 2,
  inflationMRA: 2,
  inflationBackOffice: 2,
  inflationDivers: 2,
  methodeTaxes: "appreciation_directe",
  prixTerrainHa: 5000,
  abattTerrain: 0,
  inflationTaxes: 2,
  iferRate1: 3.5,
  iferRate2: 8.5,
  iferRpn: 1.35,
  inflationAurora: 2,
  // Constantes template BP (pré-remplies, modulables) — cf docs/SPEC_BP_SIGOULES.md.
  coefDegressif: 2.25,
  goPriceBase: 1,
  taxeFinaleSizingKeuro: 0,
  fonciereBienEuroWc: 0.017,
  batimentsFonciersKeuro: 0,
  legalFeesKEuro: 10,
  technicalDDKEuro: 5,
  arrangerFeesRate: 0.8,
  participantFeesRate: 0.4,
  bankFeesPLTKEuroPerMW: 1.5,
  interimFinancingRate: 2.5,
  commitmentFeesRate: 0.1,
  dscrSchedule: [
    { yearFrom: 1, yearTo: 20, dscrValue: 1.15 },
    { yearFrom: 21, yearTo: 24, dscrValue: 1.4 },
  ],
} as const;

export type DebtScheduleItem = {
  year: number;
  principal: number;
  interest: number;
  outstanding: number;
};

export type DscrTranche = {
  yearFrom: number;
  yearTo: number;
  dscrValue: number;
};

export type SizingResult = {
  debtSculptedKeuro: number;
  debtGearingMaxKeuro: number | null;
  debtRetenuKeuro: number;
  margeFactKeuro: number;
  gearingActuel: number;
  bindingConstraint: "dscr" | "gearing" | "equal";
  iterationsCount: number;
};

export type T0Flows = {
  projectInvestmentKeuro: number;
  equityInvestmentKeuro: number;
  dsraInitialKeuro: number;
  devFeesKeuro: number;
  miseNetteInvest: number;
  miseNetteEntrep: number;
};

export type DoubleIRR = {
  irrInvest: number;
  irrEntreprise: number;
  npvSPV: number;
  npvEntreprise: number;
  miseNette: number;
};

export type AnnualCashFlowWaterfallFields = {
  deficitCumuleKeuro: number;
  resultatCumuleKeuro: number;
  dsraSoldeKeuro: number;
  dsraDepotKeuro: number;
  dsraRetraitKeuro: number;
  cashBloqueKeuro: number;
};

export type FinanceEngineInputDsraDevFees = {
  gearingMaxPct?: number | null;
  dsraMonths?: number | null;
  devFeesKEuroPerMW?: number | null;
  tauxISEntreprise?: number | null;
};
