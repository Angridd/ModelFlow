import { describe, it } from "vitest";
import {
  calculateAnnualCashFlows,
  calculateOpexDetails,
} from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";

// ---------------------------------------------------------------------------
// BANC D'ESSAI — calibration Golf de Baugé ligne par ligne contre le BP Excel.
// Ce fichier N'A PAS vocation à "passer". Il AFFICHE le détail année par année
// pour comparaison visuelle avec le BP. On ne modifie pas le moteur tant qu'on
// n'a pas identifié la première ligne qui diverge.
// ---------------------------------------------------------------------------

function baugeInput(): FinanceEngineInput {
  return {
    capacityMw: 7,
    capex: 0,
    opex: 0,
    yieldMwh: 1198,          // irradiation P50 (1210 brut × dispo ~99%)
    yieldP90Mwh: 1198 * 0.93,
    tariff: 75,
    tariffInflationRate: 0.4,
    opexInflationRate: 2,
    contractDuration: 20,
    projectLifeYears: 35,
    degradationRate: 0.4,
    discountRate: 7.5,
    debtInterestRate: 4.2,
    debtMaturityYears: 24,
    debtTenorYears: 24,
    constructionYears: 1,
    commissioningYear: 2029,
    gearingMax: 95,
    gearingMaxPct: 95,
    dscrSchedule: [
      { yearFrom: 1, yearTo: 20, dscrValue: 1.15 },
      { yearFrom: 21, yearTo: 24, dscrValue: 1.4 },
    ],
    // CAPEX
    prixModuleUSDWc: 0.15,
    tauxEURUSD: 1.16,
    boSCtWc: 35,
    raccordementOuvrageKEuro: 1500,
    otherSoftCapexKeuro: 90,
    contingencyRate: 2,
    devFeesKEuroPerMW: 110,
    // OPEX
    omFixedEuroKwc: 4.585,
    mraEuroKwc: 1.157,
    backOfficeKeuro: 22.5,
    assuranceRate: 1.5,
    inflationAssurance: 3,
    balancingCost: 2,
    surfaceHa: 15,
    loyerMode: "euroParHa",
    loyerValeur: 1000,
    loyerInflation: 0.4,
    inflationOM: 2,
    inflationMRA: 2,
    inflationBackOffice: 2,
    diversOpexKeuro: 8.611,
    // Taxes
    methodeTaxes: "comptable",
    tauxTFCommune: 0.3069,
    tauxTFEPCI: 0.0287,
    tauxTSE: 0.0024,
    tauxGEMAPI: 0.0023,
    tauxCFEEPCI: 0.2594,
    tauxCCI: 0.0112,
    iferRate1: 3.685,
    iferRate2: 8.854,
    iferRpn: 1.35,
    inflationTaxes: 2,
    // Fiscal
    tauxIS: 25,
    amortDuree: 20,
    capexType1Keuro: 3404.172,
    capexType2Keuro: 2270.0,
    // SHL / CCA
    ccaApportKeuro: 789,
    ccaRemunRate: 5,
    // Aurora (year, central, low)
    inflationAurora: 2,
    investorCurveW: 1,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    auroraCurves: [
      { year: 2025, high: 81, central: 42, low: 32 },
      { year: 2026, high: 80.77, central: 40.94, low: 31.16 },
      { year: 2027, high: 68.2, central: 34.03, low: 25.97 },
      { year: 2028, high: 67.93, central: 33.41, low: 25.89 },
      { year: 2029, high: 62.95, central: 34.92, low: 26.83 },
      { year: 2030, high: 62.29, central: 39.58, low: 30.28 },
      { year: 2031, high: 63.03, central: 42.98, low: 31.28 },
      { year: 2032, high: 62.27, central: 42.76, low: 31.06 },
      { year: 2033, high: 60.77, central: 42.8, low: 31.21 },
      { year: 2034, high: 64.48, central: 47.65, low: 35.02 },
      { year: 2035, high: 62.64, central: 47.78, low: 36.23 },
      { year: 2036, high: 62.21, central: 49.72, low: 38.51 },
      { year: 2037, high: 62.64, central: 51.43, low: 39.84 },
      { year: 2038, high: 61.25, central: 50.89, low: 39.69 },
      { year: 2039, high: 61.53, central: 51.31, low: 40.27 },
      { year: 2040, high: 60, central: 50.87, low: 40.49 },
      { year: 2041, high: 60, central: 51.33, low: 41.28 },
      { year: 2042, high: 60, central: 51.32, low: 41.61 },
      { year: 2043, high: 60, central: 50.25, low: 41.92 },
      { year: 2044, high: 60, central: 48.54, low: 41.69 },
      { year: 2045, high: 60, central: 47.17, low: 40.77 },
      { year: 2046, high: 60, central: 47.38, low: 41.26 },
      { year: 2047, high: 60, central: 47.58, low: 40.38 },
      { year: 2048, high: 60, central: 47.43, low: 38.9 },
      { year: 2049, high: 60, central: 47.13, low: 37.78 },
      { year: 2050, high: 60, central: 45.16, low: 35.46 },
      { year: 2051, high: 60, central: 44.46, low: 36.34 },
      { year: 2052, high: 60, central: 43.11, low: 36.16 },
      { year: 2053, high: 60, central: 42.6, low: 35.92 },
      { year: 2054, high: 60, central: 43.35, low: 37.17 },
      { year: 2055, high: 60, central: 43.53, low: 37.22 },
      { year: 2056, high: 60, central: 42.82, low: 34.4 },
      { year: 2057, high: 60, central: 42.83, low: 33.7 },
      { year: 2058, high: 60, central: 42.22, low: 31.9 },
      { year: 2059, high: 60, central: 42.69, low: 32.95 },
      { year: 2060, high: 60, central: 42.15, low: 33.09 },
    ],
  };
}

// Valeurs de référence du BP Golf de Baugé (onglet C_P50), en k€ sauf production.
const BP = {
  production: { 1: 8385, 2: 8352, 5: 8251, 10: 8083, 21: 7782, 35: 7346 },
  revenuePV:  { 1: 628.9, 5: 628.8, 10: 628.4, 21: 595.6 },       // k€
  opex:       { 1: 139.6, 5: 147.2, 10: 157.99, 21: 238.5 },      // k€ (Total operational expenses PV)
  ebitda:     { 1: 495.97, 5: 488.81, 10: 471.99, 21: 391.15 },   // k€
};

function fmt(n: number, dec = 1) {
  return Number.isFinite(n) ? n.toFixed(dec) : "—";
}

describe("calibration Baugé — ligne par ligne", () => {
  it("affiche le waterfall annuel vs BP", () => {
    const rows = calculateAnnualCashFlows(baugeInput());
    const ops = rows.filter((r) => r.year >= 1);

    const watchYears = [1, 2, 5, 10, 21, 35];

    console.log("\n=== LIGNE 1 — PRODUCTION P50 (MWh) ===");
    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      const bp = (BP.production as Record<number, number>)[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.productionP50Mwh ?? 0, 0).padStart(7)} | BP ${bp != null ? String(bp).padStart(7) : "   —   "}`,
      );
    }

    console.log("\n=== LIGNE 2 — TARIF (€/MWh) & REVENU P50 (k€) ===");
    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      const bp = (BP.revenuePV as Record<number, number>)[y];
      console.log(
        `an ${String(y).padStart(2)} | tarif ${fmt(r?.annualTariff ?? 0, 2).padStart(7)} | MF rev ${fmt(r?.revenueP50Keuro ?? 0).padStart(7)} | BP rev ${bp != null ? fmt(bp).padStart(7) : "   —   "}`,
      );
    }

    console.log("\n=== LIGNE 3 — OPEX (k€) ===");
    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      const bp = (BP.opex as Record<number, number>)[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.opexKeuro ?? 0).padStart(7)} | BP ${bp != null ? fmt(bp).padStart(7) : "   —   "}`,
      );
    }

    console.log("\n=== LIGNE 4 — EBITDA = CFADS pré-IS (k€) ===");
    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      const bp = (BP.ebitda as Record<number, number>)[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.cashFlowKeuro ?? 0).padStart(7)} | BP ${bp != null ? fmt(bp).padStart(7) : "   —   "}`,
      );
    }

    console.log("\n=== LIGNE 5 — AMORTISSEMENT (k€) ===");
    const BP_amort = { 1: 496.5, 2: 453.4, 5: 351.1, 10: 244.3, 13: 215.1, 21: 215.1 };
    for (const y of [1, 2, 5, 10, 13, 21]) {
      const r = ops.find((x) => x.year === y);
      const bp = (BP_amort as Record<number, number>)[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${(r?.amort ?? 0).toFixed(1).padStart(7)} | BP ${bp != null ? bp.toFixed(1).padStart(7) : "   —   "}`,
      );
    }

    console.log("\n=== LIGNES SUIVANTES (MF seul, pour info) ===");
    console.log("an | amort | ebit | interets | ebt | is | cfadsAT | divid | fluxAct");
    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      if (!r) continue;
      console.log(
        `${String(y).padStart(2)} | ${fmt(r.amort).padStart(6)} | ${fmt(r.ebit).padStart(6)} | ${fmt(r.interets).padStart(6)} | ${fmt(r.ebt).padStart(6)} | ${fmt(r.is).padStart(5)} | ${fmt(r.cfadsAfterTax).padStart(6)} | ${fmt(r.dividende).padStart(6)} | ${fmt(r.fluxActionnaire).padStart(6)}`,
      );
    }

    const inp = baugeInput();
    const rev1 = ops.find((x) => x.year === 1)?.revenueP50Keuro ?? 0;
    const prod1 = ops.find((x) => x.year === 1)?.productionP50Mwh ?? 0;
    const opex1 = calculateOpexDetails(inp, 1, rev1, prod1);
    console.log("\n=== DÉTAIL OPEX AN 1 (MF, k€) ===");
    console.log(JSON.stringify(opex1, null, 2));
  });
});
