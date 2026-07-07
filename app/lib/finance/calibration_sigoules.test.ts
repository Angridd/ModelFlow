import { describe, expect, it } from "vitest";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateScenarioMetrics,
  calculateTaxesFoncieres,
} from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";

// ---------------------------------------------------------------------------
// CALIBRATION SIGOULÈS — test permanent (verrouille l'état moteur calé au BP).
// Source de vérité : docs/SPEC_BP_SIGOULES.md (formules exactes + bancs §3.1-3.2).
// Le 1er `it` ASSERTE (CAPEX/taxes/dette/D&A/IS/flux/TRI à tolérances serrées) ; le 2nd
// AFFICHE le flux actionnaire (= FCF after debt service, C_P50!r296) an1-35 vs banc §3.1.
//
// ⚠️ Les valeurs an24-29 portent des RÉSIDUELS DOCUMENTÉS, non forcés (cf CALIBRATION.md
// "CHANTIER TRI CLOS") : IS an24 +1,9 k€ (index merchant P50 / D&A). L'assertion IS an24
// fige donc l'ÉTAT MF actuel (134 900 €), pas la cible BP (133 006 €) — résiduel intentionnel.
// Phase 3 : le démantèlement an25-29 (ex-G7) est désormais appliqué PAR DÉFAUT par la méthode
// (10 000 €/MWc × 12 MWc → 24 k€/an an25-29, non indexé = le BP, 24,68 k€/an sur 12,34 MWc
// réels). Toutes les ancres (IS an24, flux an1/21/35, TRI ±0,05) restent vertes SANS retouche.
// ---------------------------------------------------------------------------

// |MF − attendu| ≤ tol ; messages parlants en cas de dérive.
function expectClose(actual: number, expected: number, tol: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label} : MF=${actual} attendu=${expected} (±${tol}) Δ=${(actual - expected).toFixed(3)}`,
  ).toBeLessThanOrEqual(tol);
}

function sigoulesInput(): FinanceEngineInput {
  return {
    capacityMw: 12,
    capex: 0,
    opex: 0,
    yieldMwh: 1360, // P50 brut ; disponibilisé par unavailability dans le moteur
    unavailability: 0.01, // → prod P50 an1 = 12 000 × 1360 × 0,99 = 16 156,8 MWh
    tariff: 73,
    tariffInflationRate: 0.4,
    opexInflationRate: 2,
    contractDuration: 20,
    projectLifeYears: 35,
    degradationRate: 0.4, // linéaire (pas de courbe tabulée) : an21 = 16 156,8 × 0,92
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
    // CAPEX (→ total 13 151,098 k€)
    prixModuleUSDWc: 0.17,
    tauxEURUSD: 1.16,
    boSCtWc: 36,
    contingencyRate: 2,
    raccordementOuvrageKEuro: 5000,
    devFeesKEuroPerMW: 110,
    indemnitesImmoKeuro: 90,
    financingFeesKeuro: 507.684,
    // OPEX
    omFixedEuroKwc: 6,
    mraEuroKwc: 0, // Sigoulès : pas de ligne MRA distincte (O&M excl. inverters)
    backOfficeKeuro: 22.5,
    assuranceRate: 1.5,
    inflationAssurance: 2,
    balancingCost: 2,
    surfaceHa: 12,
    loyerMode: "euroParHa",
    loyerValeur: 2500,
    loyerInflation: 0.4,
    inflationOM: 2,
    inflationBackOffice: 2,
    diversOpexKeuro: 10.833, // G1/Fix 3 (Other OPEX)
    aleasOpexRate: 0.5,
    // Taxes — Appréciation Directe (Règle 6)
    methodeTaxes: "appreciation_directe",
    baseFonciereKeuro: 267.245,
    valeurTerrainKeuro: 60,
    tauxTFCommune: 0.36,
    tauxTFEPCI: 0.0287,
    tauxTSE: 0.0024,
    tauxGEMAPI: 0.0023,
    tauxTEOM: 0,
    tauxCFECommune: 0,
    tauxCFEEPCI: 0.2594,
    tauxTSECfe: 0.0086,
    tauxGEMAPICfe: 0,
    tauxCCI: 0.0112,
    iferRate1: 3.5,
    iferRate2: 8.5,
    iferRpn: 1.35,
    inflationTaxes: 2,
    // Fiscal / D&A (§2.5)
    tauxIS: 25,
    amortDuree: 20,
    capexType1Keuro: 6165.021, // modules + BOS (contingency incl.) — dégressif coef 2,25
    capexType2Keuro: 6320.0, // grid + MOD — linéaire 5%
    coefDegressif: 2.25,
    // SHL / CCA
    ccaRemunRate: 5,
    // DSRF dynamique 1,4% × (6/12 × service dette) + agent fee 1 000 × 1,02^(y-1) (§2.1/§2.7)
    dsraMonths: 6,
    dsrfFeeRate: 1.4,
    agentFeeAnnuelKeuro: 1.0,
    // Courbes merchant / capacité — techno "Fixed" partagée (même série qu'un Baugé Fixed)
    inflationAurora: 2,
    curveIndexAn1: 1.10245, // index IMF des courbes à l'an1 (MES 2029), série stockée du BP (G8)
    capacityCertificateMw: 0.3,
    goStartYear: 21,
    goPriceBase: 1,
    investorCurveW: 1,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    capacityPriceCurve: [
      23.53, 5.4, 30.84, 30.79, 30.22, 29.57, 30.64, 30.58, 30.53, 29.06,
      29.06, 5.4, 5.4, 5.4, 5.4, 70.63, 70.63, 74.03, 74.03, 70.69,
      70.69, 88.0, 88.0, 68.78, 68.78, 21.63, 21.63, 22.35, 22.35, 22.35,
      22.35, 61.34, 61.34, 61.44, 61.44, 84.9,
    ],
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

// Banc §3.1 — FCF after debt service an1-35 (flux actionnaire), en €.
const BP_FLUX: number[] = [
  197340, 196770, 196772, 196383, 195986, 195060, 194650, 185240, 184629, 184003,
  183363, 209531, 209397, 210713, 210598, 208992, 208839, 216698, 216696, 207431,
  367899, 335652, 326835, 181745, 524537, 542838, 553840, 563881, 571870, 585321,
  602799, 610148, 618210, 626338, 634532,
];
const BP_FLUX_SUM = 8828276;
const BP_MISE = 2827258;

describe("calibration Sigoulès — assertions permanentes (CAPEX/dette/taxes/TRI)", () => {
  it("CAPEX, taxes, dette, D&A, IS, flux et TRI à l'euro (état MF calé BP)", () => {
    const input = sigoulesInput();
    const capex = calculateCapexDetails(input);
    const metrics = calculateScenarioMetrics(input);
    const rows = calculateAnnualCashFlows(input);
    const ops = rows.filter((r) => r.year >= 1).sort((a, b) => a.year - b.year);
    const at = (y: number) => {
      const r = ops.find((x) => x.year === y);
      if (!r) throw new Error(`ligne an${y} absente`);
      return r;
    };
    const eur = (keuro: number) => keuro * 1000;

    // CAPEX total (§1.3) — 13 151 098 €
    expectClose(eur(capex.capexTotalKeuro), 13_151_098, 1, "CAPEX total");

    // Taxes foncières an1 (Règle 6, Appréciation Directe) — TF 4 582 € · CFE 3 264 €.
    // Valeur non arrondie (metrics.tfAnnuelleKeuro est arrondi à 2 déc. de k€ → perd les unités €).
    const taxes = calculateTaxesFoncieres(input, capex.capexTotalKeuro, 1);
    expectClose(eur(taxes.tfAnnuelleKeuro), 4_582, 1, "TF an1");
    expectClose(eur(taxes.cfeAnnuelleKeuro), 3_264, 1, "CFE an1");

    // CFADS P90 sizing an1 (§3.3) — 868 903,7 €
    expectClose(eur(at(1).cfadsP90Keuro), 868_903.7, 1, "CFADS P90 an1");

    // Dette sculptée & gearing (§2.1) — 10 323 840 € · 78,50 % (binding = DSCR < gearing 95 %)
    const dette = metrics.sizing?.debtRetenuKeuro ?? 0;
    const gearing = (metrics.sizing?.gearingActuel ?? 0) * 100;
    expectClose(eur(dette), 10_323_840, 100, "dette sculptée");
    expectClose(gearing, 78.5, 0.02, "gearing %");

    // DSRF an1 = 1,4 % × (6/12 × service dette an1) (§2.1) — 5 289 €
    const debtServiceAn1 = at(1).debtServiceSculptedKeuro ?? at(1).debtServiceKeuro;
    const dsrfAn1 = 0.014 * (6 / 12) * eur(debtServiceAn1);
    expectClose(dsrfAn1, 5_289, 1, "DSRF an1");

    // Agent fee an20 = 1 000 × 1,02^(20-1) (§2.7) — 1 456,8 €
    const agentAn20 = (input.agentFeeAnnuelKeuro ?? 0) * 1000 * 1.02 ** (20 - 1);
    expectClose(agentAn20, 1_456.8, 1, "agent an20");

    // Dotation D&A an1 (§2.5, dégressif Type1 coef 2,25 + linéaire Type2) — 1 009 565 €
    expectClose(eur(at(1).amort), 1_009_565, 1, "D&A an1");

    // Report déficitaire intégral (§2.6) : premier IS = an24 ; IS an24 = 134 900 € (état MF,
    // résiduel +1,9 k€ vs BP 133 006 documenté — l'assertion fige MF, pas la cible BP).
    const firstIsYear = ops.find((r) => r.is > 0)?.year ?? -1;
    expect(firstIsYear, "premier IS doit tomber an24").toBe(24);
    expectClose(eur(at(24).is), 134_900, 100, "IS an24");

    // Flux actionnaire = FCF after debt service (banc §3.1) — an1/an21/an35
    expectClose(eur(at(1).fluxActionnaire), 197_340, 5, "flux an1");
    expectClose(eur(at(21).fluxActionnaire), 367_899, 10, "flux an21");
    expectClose(eur(at(35).fluxActionnaire), 634_532, 10, "flux an35");

    // TRI investisseur (§2.8) — 7,45 % (cible BP 7,42 %, Δ 0,03pp)
    expectClose(metrics.investorIrr, 7.45, 0.05, "investorIrr");
  });
});

describe("calibration Sigoulès — flux actionnaire = FCF after debt service (banc §3.1)", () => {
  it("affiche flux actionnaire MF vs BP an1-35 + Σ + TRI investisseur", () => {
    const input = sigoulesInput();
    const capex = calculateCapexDetails(input);
    const metrics = calculateScenarioMetrics(input);
    const rows = calculateAnnualCashFlows(input);
    const ops = rows.filter((r) => r.year >= 1).sort((a, b) => a.year - b.year);

    const dette = metrics.sizing?.debtRetenuKeuro ?? 0;
    const mise = capex.capexTotalKeuro - dette;

    console.log("\n=== SIZING / MISE ===");
    console.log(`  CAPEX total   = ${capex.capexTotalKeuro.toFixed(3)} k€   (BP 13 151,098)`);
    console.log(`  Dette retenue = ${dette.toFixed(3)} k€   (BP 10 323,840)`);
    console.log(`  Mise (ccaKeuro) = ${(mise * 1000).toFixed(0)} €   (BP ${BP_MISE})`);

    console.log("\n=== FLUX ACTIONNAIRE (FCF after debt service) — MF vs BP §3.1 (en €) ===");
    console.log(`${"an".padStart(3)} | ${"MF (€)".padStart(10)} | ${"BP (€)".padStart(10)} | ${"Δ (€)".padStart(9)}`);
    console.log("-".repeat(42));

    let sumMf = 0;
    for (let y = 1; y <= 35; y += 1) {
      const r = ops.find((x) => x.year === y);
      const mfEuro = (r?.fluxActionnaire ?? 0) * 1000;
      const bp = BP_FLUX[y - 1];
      sumMf += mfEuro;
      const highlight = [1, 2, 12, 20, 21, 24, 25, 28, 35].includes(y) ? " ←" : "";
      console.log(
        `${String(y).padStart(3)} | ${mfEuro.toFixed(0).padStart(10)} | ${bp.toFixed(0).padStart(10)} | ${(mfEuro - bp).toFixed(0).padStart(9)}${highlight}`,
      );
    }

    console.log("-".repeat(42));
    // Le "TOT flux 8 828 276" du BP (§2.8) est NET de la mise : Σ(flux) − mise.
    // (Σ brut BP = 11 655 536 ; 11 655 536 − 2 827 258 = 8 828 278.)
    const bpSumGross = BP_FLUX.reduce((s, x) => s + x, 0);
    const mfNet = sumMf - mise * 1000;
    console.log(`Σ brut  : MF = ${sumMf.toFixed(0)} €   BP = ${bpSumGross} €   Δ = ${(sumMf - bpSumGross).toFixed(0)} €`);
    console.log(`Σ − mise : MF = ${mfNet.toFixed(0)} €   BP = ${BP_FLUX_SUM} €   Δ = ${(mfNet - BP_FLUX_SUM).toFixed(0)} € (≈ G7 démant. an25-29 + IS an24)`);

    console.log("\n=== TRI INVESTISSEUR ===");
    console.log(`  investorIrr = ${metrics.investorIrr} %   (cible BP 7,42 % ; fourchette [7,3 ; 7,6])`);
    console.log(`  investorNpv = ${metrics.investorNpv} k€`);

    console.log("\n=== IS an24-35 (contrôle report déficitaire, §3.2) ===");
    const BP_IS: Record<number, number> = {
      24: 133006, 25: 170394, 26: 180946, 27: 184613, 28: 187960, 29: 190623,
      30: 195107, 31: 200933, 32: 203383, 33: 206070, 34: 208779, 35: 211511,
    };
    for (let y = 24; y <= 35; y += 1) {
      const r = ops.find((x) => x.year === y);
      const mfEuro = (r?.is ?? 0) * 1000;
      const bp = BP_IS[y];
      console.log(`  an${y} : IS MF = ${mfEuro.toFixed(0).padStart(8)} €   BP = ${bp.toFixed(0).padStart(8)} €   Δ = ${(mfEuro - bp).toFixed(0)}`);
    }
  });
});
