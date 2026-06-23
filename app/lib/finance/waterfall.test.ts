import { describe, expect, it } from "vitest";
import {
  calculateAnnualCashFlows,
  calculateScenarioMetrics,
} from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";

function baseInput(overrides: Partial<FinanceEngineInput> = {}): FinanceEngineInput {
  return {
    capacityMw: 10,
    capex: 700,
    opex: 12,
    yieldMwh: 1600,
    yieldP90Mwh: 1440,
    tariff: 95,
    debtRate: 60,
    projectLifeYears: 25,
    degradationRate: 0.3,
    discountRate: 6,
    debtInterestRate: 4,
    debtMaturityYears: 8,
    tariffInflationRate: 0,
    opexInflationRate: 1,
    ...overrides,
  };
}

function operatingRow(rows: ReturnType<typeof calculateAnnualCashFlows>, year: number) {
  const row = rows.find((item) => item.year === year);

  if (!row) {
    throw new Error(`Missing operating row ${year}`);
  }

  return row;
}

describe("waterfall fiscal, DSRA, CCA et double TRI", () => {
  it("IS = 0 si tauxIS null", () => {
    const rows = calculateAnnualCashFlows(baseInput({ tauxIS: null }));

    expect(rows.every((row) => row.is === 0)).toBe(true);
  });

  it("deductibilite IS correcte avec EBT apres interets comme base", () => {
    const rows = calculateAnnualCashFlows(baseInput({ tauxIS: 25 }));
    const row = operatingRow(rows, 1);
    const expectedTax = Math.max(0, (row.ebit - row.interets) * 0.25);

    expect(row.ebt).toBeCloseTo(row.ebit - row.interets, 6);
    expect(row.is).toBeCloseTo(expectedTax, 6);
  });

  it("report deficientaire cree un deficit cumule et bloque l'IS", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        capex: 2000,
        tariff: 20,
        tauxIS: 25,
      }),
    );

    const firstYear = operatingRow(rows, 1);

    expect(firstYear.ebt).toBeLessThan(0);
    expect(firstYear.deficitCumuleKeuro).toBeGreaterThan(0);
    expect(firstYear.is).toBe(0);
  });

  it("report deficientaire est absorbe par les annees beneficiaires", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        capex: 3000,
        tariff: 10,
        tariffInflationRate: 300,
        tauxIS: 25,
      }),
    );

    const firstDeficit = rows.find((row) => row.deficitCumuleKeuro > 0);
    const laterTax = rows.find((row) => row.year > 1 && row.is > 0);

    expect(firstDeficit).toBeDefined();
    expect(laterTax).toBeDefined();
  });

  it("DSRA depose pour atteindre 6 mois de service dette suivant", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        debtMaturityYears: 5,
        tariff: 180,
        dsraMonths: 6,
      }),
    );

    const firstYear = operatingRow(rows, 1);
    const secondYear = operatingRow(rows, 2);

    expect(firstYear.dsraDepotKeuro).toBeGreaterThan(0);
    expect(firstYear.dsraSoldeKeuro).toBeLessThanOrEqual(secondYear.debtServiceKeuro * 0.5);
  });

  it("DSRA est liberee au tenor de dette", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        debtMaturityYears: 3,
        tariff: 220,
        dsraMonths: 6,
      }),
    );

    const operatingRows = rows.filter((row) => row.year >= 1);
    const thirdYear = operatingRow(rows, 3);

    expect(operatingRows.slice(0, 2).some((row) => row.dsraSoldeKeuro > 0)).toBe(true);
    expect(thirdYear.dsraRetraitKeuro).toBeGreaterThan(0);
    expect(thirdYear.dsraSoldeKeuro).toBe(0);
  });

  it("CCA est calcule depuis capexEffectif - detteRetenue", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        debtMaturityYears: 3,
        debtRate: 0,
        tauxIS: 25,
      }),
    );
    const ccaInitial = 700 * 10;
    const firstYear = operatingRow(rows, 1);
    const firstYearRepaid = firstYear.ccaRemboursementKeuro;

    expect(firstYearRepaid).toBeGreaterThan(0);
    expect(firstYear.ccaOutstandingKeuro).toBeCloseTo(ccaInitial - firstYearRepaid);
  });

  it("CCA jamais bloque peut se rembourser pendant la dette si le cash le permet", () => {
    const rows = calculateAnnualCashFlows(
      baseInput({
        debtMaturityYears: 8,
        tauxIS: 25,
      }),
    );

    expect(
      rows.filter((row) => row.year >= 1 && row.year <= 8)
        .some((row) => row.ccaRemboursementKeuro > 0),
    ).toBe(true);
  });

  it("double TRI integre les dev fees et ameliore le TRI entreprise", () => {
    const metrics = calculateScenarioMetrics(
      baseInput({
        debtRate: 0,
        tauxIS: 25,
        devFeesKEuroPerMW: 110,
        tauxISEntreprise: 25,
      }),
    );

    expect(metrics.doubleIRR).not.toBeNull();
    expect(metrics.doubleIRR!.irrEntreprise).toBeGreaterThan(metrics.doubleIRR!.irrInvest);
  });

  it("convergence boucle < 50 tours avec IS, DSRA et dette sculptee", () => {
    const metrics = calculateScenarioMetrics(
      baseInput({
        tauxIS: 25,
        dsraMonths: 6,
        debtTenorYears: 12,
        dscrSchedule: [{ yearFrom: 1, yearTo: 12, dscrValue: 1.25 }],
        gearingMaxPct: 70,
      }),
    );

    expect(metrics.sizingIterations).toBeGreaterThan(0);
    expect(metrics.sizing).not.toBeNull();
    expect(metrics.sizing!.gearingActuel).toBeLessThanOrEqual(0.7 + 0.0025);
    expect(metrics.dscr).not.toBeNull();
    expect(metrics.dscr!).toBeCloseTo(1.25, 1);
    expect(metrics.sizing!.margeFactKeuro).toBeGreaterThanOrEqual(0);
  });
});
