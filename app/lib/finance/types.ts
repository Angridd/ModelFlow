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
  projectLifeYears: 30,
  degradationRate: 0.3,
  discountRate: 6,
  debtInterestRate: 4,
  debtMaturityYears: 20,
  tariffInflationRate: 0,
  opexInflationRate: 2,
};

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
  debtGearingMaxKeuro: number | null; // null when gearingMax not configured
  debtRetenuKeuro: number;
  headroomKeuro: number;
  bindingConstraint: "dscr" | "gearing" | "equal";
  structuringFeeKeuro: number;
  structuringFeeRate: number;
};
