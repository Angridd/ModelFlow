import { describe, expect, it } from "vitest";
import { sculptDebt } from "@/app/lib/finance/engine";
import type { DscrTranche } from "@/app/lib/finance/types";

// Helpers to build minimal cash-flow rows for testing.
function makeFlows(cfadsP90PerYear: number[], startYear = 1) {
  return cfadsP90PerYear.map((cfadsP90Keuro, i) => ({
    year: startYear + i,
    cfadsP90Keuro,
  }));
}

function tranche(yearFrom: number, yearTo: number, dscrValue: number): DscrTranche {
  return { yearFrom, yearTo, dscrValue };
}

describe("sculptDebt", () => {
  it("cas nominal — DSCR cible 1.30, ténor 15 ans, taux 4 %", () => {
    // Constant CFADS P90 of 1000 kEUR/year over 15 years.
    const flows = makeFlows(Array(15).fill(1000));
    const schedule = [tranche(1, 15, 1.3)];
    const result = sculptDebt(flows, schedule, 4, 15);

    expect(result).not.toBeNull();

    // Debt amount = PV of (1000/1.3) annuities at 4%.
    // PV factor for 15 years at 4% ≈ 11.1184 → 769.23 * 11.1184 ≈ 8553 kEUR
    const annuity = 1000 / 1.3;
    const debtRate = 0.04;
    const expectedDebt = Array.from({ length: 15 }, (_, i) =>
      annuity / (1 + debtRate) ** (i + 1),
    ).reduce((a, b) => a + b, 0);

    expect(result!.debtAmountKeuro).toBeCloseTo(expectedDebt, 1);

    // Schedule must span exactly 15 years.
    expect(result!.schedule).toHaveLength(15);

    // Outstanding at end of tenor must be ≈ 0.
    const lastRow = result!.schedule.at(-1)!;
    expect(lastRow.outstanding).toBeCloseTo(0, 1);

    // Each year: interest = outstanding_{t-1} * rate, principal ≥ 0.
    let outstanding = result!.debtAmountKeuro;
    for (const item of result!.schedule) {
      expect(item.interest).toBeCloseTo(outstanding * debtRate, 2);
      expect(item.principal).toBeGreaterThanOrEqual(0);
      outstanding -= item.principal;
    }
  });

  it("profil multi-tranches — DSCR 1.35 ans 1–5, DSCR 1.20 ans 6–15", () => {
    const flows = makeFlows(Array(15).fill(1200));
    const schedule = [tranche(1, 5, 1.35), tranche(6, 15, 1.2)];
    const result = sculptDebt(flows, schedule, 4, 15);

    expect(result).not.toBeNull();
    expect(result!.schedule).toHaveLength(15);

    // For year 1: annuity should use DSCR 1.35 → annuity = 1200 / 1.35 ≈ 888.9
    // For year 6: annuity should use DSCR 1.20 → annuity = 1200 / 1.20 = 1000
    // Verify debt amount = sum of PV(annuities) at 4%
    const debtRate = 0.04;
    const expectedDebt = flows.reduce((pv, row) => {
      const dscr = row.year <= 5 ? 1.35 : 1.2;
      return pv + row.cfadsP90Keuro / dscr / (1 + debtRate) ** row.year;
    }, 0);

    expect(result!.debtAmountKeuro).toBeCloseTo(expectedDebt, 1);
    expect(lastOutstanding(result!.schedule)).toBeCloseTo(0, 1);
  });

  it("schedule vide — retourne null", () => {
    const flows = makeFlows(Array(15).fill(1000));

    expect(sculptDebt(flows, [], 4, 15)).toBeNull();
  });

  it("ténor nul ou négatif — retourne null", () => {
    const flows = makeFlows(Array(15).fill(1000));
    const schedule = [tranche(1, 15, 1.3)];

    expect(sculptDebt(flows, schedule, 4, 0)).toBeNull();
    expect(sculptDebt(flows, schedule, 4, -1)).toBeNull();
  });

  it("CFADS insuffisant — dette nulle attendue", () => {
    // Negative CFADS: sculpted annuities are all negative.
    const flows = makeFlows(Array(15).fill(-500));
    const result = sculptDebt(flows, [tranche(1, 15, 1.3)], 4, 15);

    expect(result).not.toBeNull();
    // Sum of negative PVs → debtAmount ≤ 0 → returns {debtAmountKeuro: 0, schedule: []}.
    expect(result!.debtAmountKeuro).toBe(0);
    expect(result!.schedule).toHaveLength(0);
  });
});

function lastOutstanding(schedule: { outstanding: number }[]) {
  return schedule.at(-1)?.outstanding ?? NaN;
}
