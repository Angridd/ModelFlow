import { describe, expect, it } from "vitest";
import {
  calculateAnnualCashFlows,
  sculptDebt,
} from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";
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

type BpComparisonRow = {
  year: number;
  bpRevenueEuro: number;
  modelRevenueEuro: number;
  revenueGapPct: number;
  bpOpexEuro: number;
  modelOpexEuro: number;
  opexGapPct: number;
};

const bpSigoulesRows = [
  { year: 1, revenueEuro: 1_260_718, opexEuro: -235_945 },
  { year: 2, revenueEuro: 1_260_706, opexEuro: -240_278 },
  { year: 3, revenueEuro: 1_260_641, opexEuro: -244_694 },
  { year: 4, revenueEuro: 1_261_337, opexEuro: -249_194 },
  { year: 5, revenueEuro: 1_261_509, opexEuro: -253_779 },
] as const;

function relativeGap(modelValue: number, bpValue: number) {
  return Math.abs(modelValue - bpValue) / Math.abs(bpValue);
}

function compareWithBP() {
  it("compare Sigoules P50 years 1-5 with BP within 2%", () => {
    const capacityMw = 15;
    const capexTotalKeuro = 12_395;
    const opexInflation = 2;
    const loyerInflation = 0.4;
    const assuranceInflation = 3;
    const revenueYear1Keuro = bpSigoulesRows[0].revenueEuro / 1000;
    const taxesCapexBaseEuro = capexTotalKeuro * 1000 * 0.04 * (1 - 0.3);
    const tfRate =
      (5_272 / (taxesCapexBaseEuro * 1.03)) * 100 /
      (1 + loyerInflation / 100);
    const cfeRate =
      (4_342 / (taxesCapexBaseEuro * 1.03)) * 100 /
      (1 + loyerInflation / 100);

    const input: FinanceEngineInput = {
      capacityMw,
      capex: capexTotalKeuro / capacityMw,
      opex: 0,
      yieldMwh: 1_188,
      yieldP90Mwh: 1_188,
      tariff: 70,
      debtRate: 0,
      projectLifeYears: 35,
      degradationRate: 0.4,
      discountRate: 7.5,
      debtInterestRate: 4,
      debtMaturityYears: 20,
      tariffInflationRate: 0.4,
      opexInflationRate: opexInflation,
      contractDuration: 35,
      loyerMode: "fixe",
      loyerValeur: 15 / (1 + loyerInflation / 100),
      loyerInflation,
      backOfficeKeuro: 22.5 / (1 + opexInflation / 100),
      omFixedEuroKwc: 61.522 / capacityMw / (1 + opexInflation / 100),
      mraEuroKwc: 14.345 / capacityMw / (1 + opexInflation / 100),
      diversOpexKeuro: (12.167 + 6.304) / (1 + 3.5 / 100),
      inflationOM: opexInflation,
      inflationMRA: opexInflation,
      inflationBackOffice: opexInflation,
      inflationDivers: 3.5,
      assuranceRate:
        (18.711 / (revenueYear1Keuro * (1 + assuranceInflation / 100))) * 100,
      inflationAssurance: assuranceInflation,
      balancingCost: 2,
      iferRpn: 1.35,
      iferRate1: 40.143 / (capacityMw / 1.35),
      iferRate2: 40.143 / (capacityMw / 1.35),
      methodeTaxes: "comptable",
      tauxTFCommune: tfRate,
      tauxCFECommune: cfeRate,
      inflationTaxes: opexInflation,
      tauxTFEPCI: 0,
      tauxTSE: 0,
      tauxGEMAPI: 0,
      tauxTEOM: 0,
      tauxCFEEPCI: 0,
      tauxCCI: 0,
    };

    const rows = calculateAnnualCashFlows(input);
    const comparisonRows: BpComparisonRow[] = bpSigoulesRows.map((bpRow) => {
      const modelRow = rows[bpRow.year - 1];
      const modelRevenueEuro = modelRow.revenueP50Keuro * 1000;
      const modelOpexEuro = -modelRow.opexKeuro * 1000;

      return {
        year: bpRow.year,
        bpRevenueEuro: Math.round(bpRow.revenueEuro),
        modelRevenueEuro: Math.round(modelRevenueEuro),
        revenueGapPct: Number((relativeGap(modelRevenueEuro, bpRow.revenueEuro) * 100).toFixed(2)),
        bpOpexEuro: Math.round(bpRow.opexEuro),
        modelOpexEuro: Math.round(modelOpexEuro),
        opexGapPct: Number((relativeGap(modelOpexEuro, bpRow.opexEuro) * 100).toFixed(2)),
      };
    });

    console.table(comparisonRows);

    for (const row of comparisonRows) {
      expect(row.revenueGapPct).toBeLessThan(2);
      expect(row.opexGapPct).toBeLessThan(2);
    }
  });
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

describe("compareWithBP", () => {
  compareWithBP();
});

function lastOutstanding(schedule: { outstanding: number }[]) {
  return schedule.at(-1)?.outstanding ?? NaN;
}
