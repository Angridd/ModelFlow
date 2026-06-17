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
