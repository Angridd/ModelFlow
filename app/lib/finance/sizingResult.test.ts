import { describe, expect, it } from "vitest";
import { calculateScenarioMetrics } from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";

function input(overrides: Partial<FinanceEngineInput> = {}): FinanceEngineInput {
  return {
    capacityMw: 10,
    capex: 650,
    opex: 10,
    yieldMwh: 1850,
    yieldP90Mwh: 1700,
    tariff: 105,
    debtRate: 60,
    projectLifeYears: 25,
    degradationRate: 0.3,
    discountRate: 6,
    debtInterestRate: 4,
    debtMaturityYears: 12,
    tariffInflationRate: 0,
    opexInflationRate: 1,
    tauxIS: 25,
    debtTenorYears: 12,
    dscrSchedule: [{ yearFrom: 1, yearTo: 12, dscrValue: 1.25 }],
    gearingMaxPct: 70,
    ...overrides,
  };
}

describe("ajusteMargeFacturable", () => {
  it("borne le gearing, garde le DSCR cible et retourne une marge positive ou nulle", () => {
    const metrics = calculateScenarioMetrics(input());

    expect(metrics.sizing).not.toBeNull();
    expect(metrics.sizing!.gearingActuel).toBeLessThanOrEqual(0.7 + 0.0025);
    expect(metrics.dscr).not.toBeNull();
    expect(metrics.dscr!).toBeCloseTo(1.25, 1);
    expect(metrics.sizing!.margeFactKeuro).toBeGreaterThanOrEqual(0);
  });

  it("fonctionne sans contrainte gearing avec une marge nulle", () => {
    const metrics = calculateScenarioMetrics(input({ gearingMaxPct: null }));

    expect(metrics.sizing).not.toBeNull();
    expect(metrics.sizing!.debtGearingMaxKeuro).toBeNull();
    expect(metrics.sizing!.margeFactKeuro).toBe(0);
    expect(metrics.sizing!.bindingConstraint).toBe("dscr");
    expect(metrics.dscr).not.toBeNull();
    expect(metrics.dscr!).toBeCloseTo(1.25, 1);
  });
});
