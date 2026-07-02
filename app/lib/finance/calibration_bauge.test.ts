import { describe, it } from "vitest";
import { calculateAnnualCashFlows, calculateCapexDetails, calculateOpexDetails, calculateScenarioMetrics, calculateTaxesFoncieres } from "@/app/lib/finance/engine";
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
    // Courbe de dégradation tabulée BP (garantie fabricant), base 1.0, an1→an24.
    // Source : screenshot C_P90 "Annual production PV", vérifiée 7798×0.91972=7174=BP an21.
    degradationCurve: [
      1.0000, 0.99603, 0.99205, 0.98808, 0.98410, 0.98000, 0.97602, 0.97205, 0.96807, 0.96409,
      0.95999, 0.95602, 0.95204, 0.94807, 0.94409, 0.94000, 0.93601, 0.93203, 0.92806, 0.92408,
      0.91972, 0.91575, 0.91177, 0.90779,
    ],
    discountRate: 7.5,
    debtInterestRate: 4.2,
    debtMaturityYears: 24,
    debtTenorYears: 24,
    // "Taxes P&L" BP : seul IS injecté dans le repayment, uniquement an24 (dernière année du
    // tenor). an1-23 sculptent pré-IS. Cf CALIBRATION.md, "MÉCANISME DE SCULPTING COMPLET".
    taxeFinaleSizingKeuro: 15.129,
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
    indemnitesImmoKeuro: 50,
    financingFeesKeuro: 241.906,
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
    aleasOpexRate: 0.5,
    // Taxes — Appréciation Directe (Règle 6, base cadastrale commune = 7498 €)
    methodeTaxes: "appreciation_directe",
    baseFonciereKeuro: 168.257,
    valeurTerrainKeuro: 75,
    tauxTFCommune: 0.3069,
    tauxTFEPCI: 0.0287,
    tauxTSE: 0.0024,
    tauxGEMAPI: 0.0023,
    tauxTEOM: 0,
    tauxCFECommune: 0,
    tauxCFEEPCI: 0.2594,
    tauxTSECfe: 0.0086,
    tauxGEMAPICfe: 0,
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
    capacityCertificateMw: 0.2,
    goStartYear: 21,
    goPriceBase: 1,
    capacityPriceCurve: [
      23.53, 5.40, 30.84, 30.79, 30.22, 29.57, 30.64, 30.58, 30.53, 29.06,
      29.06, 5.40, 5.40, 5.40, 5.40, 70.63, 70.63, 74.03, 74.03, 70.69,
      70.69, 88.00, 88.00, 68.78, 68.78, 21.63, 21.63, 22.35, 22.35, 22.35,
      22.35, 61.34, 61.34, 61.44, 61.44, 84.90,
    ],
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

// ---------------------------------------------------------------------------
// BP Baugé — ventilation CAPEX de référence (onglet CAPEX du BP Excel, en k€)
// Source : Règle 3 CALIBRATION.md + onglet CAPEX BP
// Type 1 (dégressif) = modules + BoS + EPC/MOD    = 3 404.172 k€
// Type 2 (linéaire)  = raccordement + other capex  = 2 270.000 k€
//   dont raccordement ouvrage                       = 1 500.000 k€
//   dont other capex (amortissable)                 =   770.000 k€  ← dev fees 110 k€/MW × 7
// No D&A             = démantèlement + otherSoft +  ≈   332.000 k€
//                      financing fees + etc.
// TOTAL                                             = 6 005.975 k€ (≈ 6 006 k€)
// ---------------------------------------------------------------------------
const BP_CAPEX = {
  modules:        954.172,   // type1 (3 404.172) − BoS (2 450) − contingency(≈0, dans type1?)
  bos:           2450.000,   // 35 ct€/Wc × 7 MWc = 2 450 k€
  raccordement:  1500.000,
  devFees:        770.000,   // 110 k€/MW × 7 = 770 k€ (= other capex amortissable type2)
  contingency:     49.000,   // ~2 % de BoS seul (hors modules) ≈ 49 k€ — inclus type1 BP
  otherSoft:       90.000,   // champ otherSoftCapexKeuro (90 dans test, 50 corrigé CALIB.md)
  taxesFoncieres:  40.000,   // taxe aménagement + archéo (estimé)
  noDaOther:      152.803,   // solde No D&A (démantèlement, financing, etc.)
  total:         6005.975,
};

describe("calibration Baugé — CAPEX poste par poste", () => {
  it("affiche le détail CAPEX moteur vs BP", () => {
    const input = baugeInput();
    const capex = calculateCapexDetails(input);

    console.log("\n=== CAPEX DETAIL MOTEUR vs BP Baugé (en k€) ===");
    console.log(
      `${"Poste".padEnd(30)} | ${"MF (k€)".padStart(10)} | ${"BP (k€)".padStart(10)} | ${"Δ (k€)".padStart(10)}`,
    );
    console.log("-".repeat(70));

    const rows: Array<[string, number, number | null]> = [
      ["Modules (prixModule USD/Wc)",     capex.modulesKeuro,       BP_CAPEX.modules],
      ["BoS (boSCtWc)",                   capex.boSKeuro,           BP_CAPEX.bos],
      ["Raccordement ouvrage",            capex.raccordementKeuro,  BP_CAPEX.raccordement],
      ["Apport affaire",                  capex.apportAffaireKeuro, null],
      ["Dev fees (devFeesKEuroPerMW)",    capex.devFeesKeuro,       BP_CAPEX.devFees],
      ["Contingency (% BoS)",             capex.contingencyKeuro,   BP_CAPEX.contingency],
      ["Taxe aménagement",                capex.taxeAmenagementKeuro, null],
      ["Taxe archéo",                     capex.taxeArcheoKeuro,    null],
      ["Taxes foncières (total)",         capex.taxesFoncieresKeuro, BP_CAPEX.taxesFoncieres],
      ["Indemnités immo (No D&A)",        capex.indemnitesImmoKeuro, 50],
      ["Financing fees (No D&A)",         capex.financingFeesKeuro,  241.906],
    ];

    for (const [label, mf, bp] of rows) {
      const delta = bp != null ? mf - bp : null;
      console.log(
        `${label.padEnd(30)} | ${mf.toFixed(1).padStart(10)} | ${bp != null ? bp.toFixed(1).padStart(10) : "         —"} | ${delta != null ? delta.toFixed(1).padStart(10) : "         —"}`,
      );
    }

    console.log("-".repeat(70));
    console.log(
      `${"TOTAL CAPEX".padEnd(30)} | ${capex.capexTotalKeuro.toFixed(1).padStart(10)} | ${BP_CAPEX.total.toFixed(1).padStart(10)} | ${(capex.capexTotalKeuro - BP_CAPEX.total).toFixed(1).padStart(10)}`,
    );

    console.log("\n--- Détail formule modules ---");
    const prixModule = input.prixModuleUSDWc ?? 0;
    const tauxEURUSD = input.tauxEURUSD ?? 1.16;
    console.log(`  prixModuleUSDWc = ${prixModule} USD/Wc`);
    console.log(`  tauxEURUSD      = ${tauxEURUSD}`);
    console.log(`  formule actuelle : ${prixModule} / 100 / ${tauxEURUSD} = ${(prixModule / 100 / tauxEURUSD).toFixed(6)} €/Wc`);
    console.log(`  formule correcte : ${prixModule} / ${tauxEURUSD}       = ${(prixModule / tauxEURUSD).toFixed(6)} €/Wc`);
    console.log(`  modules actuels  : ${capex.modulesKeuro.toFixed(3)} k€`);
    console.log(`  modules corrigés : ${(prixModule / tauxEURUSD * input.capacityMw * 1_000_000 / 1000).toFixed(3)} k€  (cible BP ≈ ${BP_CAPEX.modules} k€)`);
    console.log(`  écart formule    : × 100 (division superflue par 100)`);

    console.log("\n--- Champs non gérés par calculateCapexDetails ---");
    // otherSoftCapexKeuro est dans baugeInput() mais absent de FinanceEngineInput
    const rawInput = input as Record<string, unknown>;
    console.log(`  otherSoftCapexKeuro : ${rawInput["otherSoftCapexKeuro"] ?? "ABSENT du type"} k€ → non utilisé dans le moteur`);

    console.log("\n--- Réconciliation CAPEX BP 6006 k€ ---");
    const capexIfFixed = capex.capexTotalKeuro
      - capex.modulesKeuro
      + (prixModule / tauxEURUSD * input.capacityMw * 1_000_000 / 1000)
      + (Number(rawInput["otherSoftCapexKeuro"] ?? 0));
    console.log(`  CAPEX moteur actuel                  : ${capex.capexTotalKeuro.toFixed(1)} k€`);
    console.log(`  + correction formule modules (+896k) : ${(capex.capexTotalKeuro - capex.modulesKeuro + prixModule / tauxEURUSD * input.capacityMw * 1_000_000 / 1000).toFixed(1)} k€`);
    console.log(`  + ajout otherSoftCapex               : ${capexIfFixed.toFixed(1)} k€`);
    console.log(`  BP cible                             : ${BP_CAPEX.total.toFixed(1)} k€`);
    console.log(`  Écart résiduel après 2 corrections   : ${(capexIfFixed - BP_CAPEX.total).toFixed(1)} k€`);
  });
});

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

    // -----------------------------------------------------------------------
    // RÈGLE 4 — SHL (CCA) : observation avant modification du moteur
    // BP Baugé de référence :
    //   ccaOutstanding BoP an1 = 828.5k (789k × 1.05, intérêts an0 capitalisés)
    //   ccaInterets an1=41.4k, an2=38.3k  (décroissant)
    //   ccaRemboursement an1=62.6k, an2=65.4k, an12=73.7k, an13+ = 0
    //   dividende an1-12=0, an13=17.6k, an14-18≈112k, an21≈xx
    //   FCF after debt (=cfadsAfterTax - debtService) an1=104k, an2=103.7k
    // -----------------------------------------------------------------------
    const BP_SHL: Record<string, Record<number, number>> = {
      ccaOutstanding: { 1: 828.5, 2: 790.2, 5: 671.0, 10: 469.8, 13: 341.3, 14: 264.6 },
      ccaInterets:    { 1: 41.4,  2: 38.3,  5: 33.6,  10: 23.5 },
      ccaRemb:        { 1: 62.6,  2: 65.4,  5: 71.3,  10: 74.6, 12: 73.7, 13: 341.3 },
      dividende:      { 1: 0,     2: 0,     5: 0,     10: 0,    13: 17.6, 14: 112.0, 21: 0 },
    };
    const shlYears = [1, 2, 5, 10, 13, 14, 21, 35];

    console.log("\n=== RÈGLE 4 — SHL outstanding (k€) BoP ===");
    console.log("an | MF ccaOut | BP ccaOut");
    for (const y of shlYears) {
      const r = ops.find((x) => x.year === y);
      const bpOut = BP_SHL.ccaOutstanding[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.ccaOutstandingKeuro ?? 0).padStart(8)} | BP ${bpOut != null ? fmt(bpOut).padStart(8) : "       —"}`,
      );
    }

    console.log("\n=== RÈGLE 4 — SHL intérêts (k€) ===");
    console.log("an | MF ccaInt | BP ccaInt");
    for (const y of shlYears) {
      const r = ops.find((x) => x.year === y);
      const bpInt = BP_SHL.ccaInterets[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.ccaInteretsKeuro ?? 0).padStart(8)} | BP ${bpInt != null ? fmt(bpInt).padStart(8) : "       —"}`,
      );
    }

    console.log("\n=== RÈGLE 4 — SHL remboursement (k€) ===");
    console.log("an | MF ccaRemb | BP ccaRemb");
    for (const y of shlYears) {
      const r = ops.find((x) => x.year === y);
      const bpRemb = BP_SHL.ccaRemb[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.ccaRemboursementKeuro ?? 0).padStart(9)} | BP ${bpRemb != null ? fmt(bpRemb).padStart(9) : "        —"}`,
      );
    }

    console.log("\n=== RÈGLE 4 — Dividendes (k€) ===");
    console.log("an | MF divid | BP divid | MF fluxAct");
    for (const y of shlYears) {
      const r = ops.find((x) => x.year === y);
      const bpDiv = BP_SHL.dividende[y];
      console.log(
        `an ${String(y).padStart(2)} | MF ${fmt(r?.dividende ?? 0).padStart(7)} | BP ${bpDiv != null ? fmt(bpDiv).padStart(7) : "      —"} | fluxAct ${fmt(r?.fluxActionnaire ?? 0).padStart(7)}`,
      );
    }

    console.log("\n=== RÈGLE 4 — FCF after debt service (cfadsAT − debtService) ===");
    console.log("BP an1=104.0k, an2=103.7k (cash AVANT SHL)");
    for (const y of shlYears) {
      const r = ops.find((x) => x.year === y);
      if (!r) continue;
      const debtSvc = r.debtServiceSculptedKeuro ?? r.debtServiceKeuro;
      const fcfAfterDebt = r.cfadsAfterTax - debtSvc;
      console.log(
        `an ${String(y).padStart(2)} | cfadsAT ${fmt(r.cfadsAfterTax).padStart(8)} | debtSvc ${fmt(debtSvc).padStart(8)} | FCF ${fmt(fcfAfterDebt).padStart(8)}`,
      );
    }

  });
});

describe("calibration Baugé — sizing dette vs BP", () => {
  it("affiche dette / CCA / gearing moteur vs BP", () => {
    const input = baugeInput();
    const capex = calculateCapexDetails(input);
    const metrics = calculateScenarioMetrics(input);
    const rows = calculateAnnualCashFlows(input);
    const sizing = metrics.sizing;

    const capexTotal = capex.capexTotalKeuro;
    const dette = sizing?.debtRetenuKeuro ?? 0;
    const cca = capexTotal - dette;
    const gearing = sizing?.gearingActuel != null ? sizing.gearingActuel * 100 : 0;
    const ccaOutAn1 = rows.find((r) => r.year === 1)?.ccaOutstandingKeuro ?? 0;

    const BP_SZ = { capex: 6005.975, dette: 5216.873, cca: 789.101, gearing: 86.86, ccaOutAn1: 828.5 };

    console.log("\n=== SIZING — DETTE / CCA / GEARING vs BP ===");
    console.log(`${"Poste".padEnd(30)} | ${"MF".padStart(10)} | ${"BP".padStart(10)} | ${"Δ".padStart(10)}`);
    console.log("-".repeat(68));
    console.log(`${"CAPEX total (k€)".padEnd(30)} | ${capexTotal.toFixed(3).padStart(10)} | ${BP_SZ.capex.toFixed(3).padStart(10)} | ${(capexTotal - BP_SZ.capex).toFixed(3).padStart(10)}`);
    console.log(`${"Dette retenue (k€)".padEnd(30)} | ${dette.toFixed(3).padStart(10)} | ${BP_SZ.dette.toFixed(3).padStart(10)} | ${(dette - BP_SZ.dette).toFixed(3).padStart(10)}`);
    console.log(`${"CCA = CAPEX − dette (k€)".padEnd(30)} | ${cca.toFixed(3).padStart(10)} | ${BP_SZ.cca.toFixed(3).padStart(10)} | ${(cca - BP_SZ.cca).toFixed(3).padStart(10)}`);
    console.log(`${"Gearing effectif (%)".padEnd(30)} | ${gearing.toFixed(2).padStart(10)} | ${BP_SZ.gearing.toFixed(2).padStart(10)} | ${(gearing - BP_SZ.gearing).toFixed(2).padStart(10)}`);
    console.log(`${"CCA outstanding BoP an1 (k€)".padEnd(30)} | ${ccaOutAn1.toFixed(1).padStart(10)} | ${BP_SZ.ccaOutAn1.toFixed(1).padStart(10)} | ${(ccaOutAn1 - BP_SZ.ccaOutAn1).toFixed(1).padStart(10)}`);

    // Détail sizing
    console.log(`\n  debtSculptedKeuro  = ${(sizing?.debtSculptedKeuro ?? 0).toFixed(3)} k€`);
    console.log(`  debtGearingMaxKeuro= ${(sizing?.debtGearingMaxKeuro ?? 0).toFixed(3)} k€  (95% × ${capexTotal.toFixed(3)})`);
    console.log(`  debtRetenuKeuro    = ${dette.toFixed(3)} k€  (min des deux)`);
  });
});

describe("calibration Baugé — CFADS P90 + sculpting DSCR", () => {
  it("affiche CFADS P90 et service dette par année vs BP", () => {
    const input = baugeInput();
    const rows = calculateAnnualCashFlows(input);
    const ops = rows.filter((r) => r.year >= 1);
    const metrics = calculateScenarioMetrics(input);
    const sizing = metrics.sizing;

    // BP CFADS P90 (k€) — onglet sizing DSCR BP Excel (EBITDA P90 = revPV P90 − OPEX P90)
    // Années 21-24 : cible = revenu P90 BP − OPEX P90 BP (queue élucidée, cf CALIBRATION.md).
    const BP_CFADS_P90: Record<number, number> = {
      1: 446.459,
      2: 443.985,
      3: 441.455,
      5: 436.222,
      21: 520.954 - 236.864,
      22: 504.296 - 240.883,
      23: 509.396 - 245.341,
      24: 505.007 - 249.677,
    };

    const watchYears = [1, 2, 3, 5, 10, 19, 20, 21, 22, 24];

    console.log("\n=== CFADS P90 — DÉCOMPOSITION vs BP (k€) ===");
    console.log(
      `${"an".padStart(3)} | ${"revP90".padStart(8)} | ${"balancP90".padStart(10)} | ${"opexP90".padStart(8)} | ${"cfadsP90 MF".padStart(12)} | ${"cfadsP90 BP".padStart(12)} | ${"Δ".padStart(7)}`,
    );
    console.log("-".repeat(78));

    for (const y of watchYears) {
      const r = ops.find((x) => x.year === y);
      if (!r) continue;
      const revP90 = r.revenueP90Keuro;
      const cfadsP90MF = r.cfadsP90Keuro;
      const opexP90MF = revP90 - cfadsP90MF;
      const balancP90 = (input.balancingCost ?? 2) * r.productionP90Mwh / 1000;
      const bpVal = BP_CFADS_P90[y];
      const delta = bpVal != null ? cfadsP90MF - bpVal : null;
      console.log(
        `${String(y).padStart(3)} | ${revP90.toFixed(2).padStart(8)} | ${balancP90.toFixed(3).padStart(10)} | ${opexP90MF.toFixed(2).padStart(8)} | ${cfadsP90MF.toFixed(3).padStart(12)} | ${bpVal != null ? bpVal.toFixed(3).padStart(12) : "           —"} | ${delta != null ? delta.toFixed(3).padStart(7) : "      —"}`,
      );
    }

    console.log("\n=== SIZING après correction balancing P90 ===");
    const capexTotal = metrics.debtAmountKeuro != null
      ? (sizing?.debtRetenuKeuro ?? 0) / (sizing?.gearingActuel ?? 1)
      : 0;
    console.log(`  debtSculptedKeuro   = ${(sizing?.debtSculptedKeuro ?? 0).toFixed(3)} k€`);
    console.log(`  debtGearingMaxKeuro = ${(sizing?.debtGearingMaxKeuro ?? 0).toFixed(3)} k€`);
    console.log(`  debtRetenuKeuro     = ${(sizing?.debtRetenuKeuro ?? 0).toFixed(3)} k€  (BP : 5 216.873)`);
    const cca = (sizing?.debtRetenuKeuro ?? 0) > 0
      ? (sizing!.debtGearingMaxKeuro ?? 0) / (sizing!.gearingActuel!) - (sizing?.debtRetenuKeuro ?? 0)
      : 0;
    console.log(`  gearingActuel       = ${((sizing?.gearingActuel ?? 0) * 100).toFixed(2)} %  (BP : 86.86 %)`);
    console.log(`\n  an1 : CFADS P50=${ops.find(r => r.year === 1)?.cashFlowKeuro.toFixed(2)} k€  CFADS P90=${ops.find(r => r.year === 1)?.cfadsP90Keuro.toFixed(3)} k€`);
  });
});

describe("calibration Baugé — OPEX P90 queue 21-24", () => {
  it("affiche OPEX P90 / CFADS P90 années 19-24 vs BP + année bornant le sculpting", () => {
    const input = baugeInput();
    const rows = calculateAnnualCashFlows(input);
    const ops = rows.filter((r) => r.year >= 1);
    const metrics = calculateScenarioMetrics(input);
    const sizing = metrics.sizing;

    // OPEX P90 BP (k€) — queue élucidée via screenshots C_P90 années 19-30 (cf CALIBRATION.md).
    const BP_OPEX_P90: Record<number, number> = {
      5: 148.559,
      19: 190.743,
      20: 194.205,
      21: 236.864,
      22: 240.883,
      23: 245.341,
      24: 249.677,
    };

    console.log("\n=== OPEX P90 — QUEUE 21-24 vs BP (k€) ===");
    console.log(
      `${"an".padStart(3)} | ${"opexP90 MF".padStart(10)} | ${"opexP90 BP".padStart(10)} | ${"Δ".padStart(7)} | ${"cfadsP90 MF".padStart(12)}`,
    );
    console.log("-".repeat(60));
    for (const y of [5, 19, 20, 21, 22, 23, 24]) {
      const r = ops.find((x) => x.year === y);
      if (!r) continue;
      const opexP90MF = r.revenueP90Keuro - r.cfadsP90Keuro;
      const bpVal = BP_OPEX_P90[y];
      const delta = bpVal != null ? opexP90MF - bpVal : null;
      console.log(
        `${String(y).padStart(3)} | ${opexP90MF.toFixed(3).padStart(10)} | ${bpVal != null ? bpVal.toFixed(3).padStart(10) : "         —"} | ${delta != null ? delta.toFixed(3).padStart(7) : "      —"} | ${r.cfadsP90Keuro.toFixed(3).padStart(12)}`,
      );
    }

    console.log("\n=== SIZING — dette après fix queue 21-24 ===");
    console.log(`  debtSculptedKeuro = ${(sizing?.debtSculptedKeuro ?? 0).toFixed(3)} k€  (BP : 5 216.873)`);
    console.log(`  debtRetenuKeuro   = ${(sizing?.debtRetenuKeuro ?? 0).toFixed(3)} k€`);
    console.log(`  bindingConstraint = ${sizing?.bindingConstraint ?? "—"}`);

    // Le sculpting fixe le service de dette de CHAQUE année pile sur son DSCR cible tant que
    // l'amortissement le permet : "l'année qui borne" n'est donc pas un minimum isolé, mais la
    // dernière tranche où le DSCR réalisé colle exactement à la cible ET où l'outstanding
    // s'annule pile au dernier exercice du tenor (an24) — cf table détaillée ci-dessous.
    const boundYears = rows
      .filter((r) => r.year >= 1 && r.year <= 24)
      .filter((r) => r.dscrRealized !== null && r.dscrTargetAtYear !== null
        && Math.abs(r.dscrRealized - r.dscrTargetAtYear) < 0.001)
      .map((r) => r.year);
    console.log(`  années au DSCR cible exact (bornantes) = [${boundYears.join(", ")}]`);

    console.log("\n=== OUTSTANDING / SERVICE DETTE — QUEUE 18-24 (k€) ===");
    console.log(`${"an".padStart(3)} | ${"cfadsP90".padStart(10)} | ${"debtSvc sculpté".padStart(16)} | ${"outstanding".padStart(12)} | ${"dscrTarget".padStart(10)} | ${"dscrRealisé".padStart(11)}`);
    console.log("-".repeat(75));
    for (const r of rows) {
      if (r.year < 18 || r.year > 24) continue;
      console.log(
        `${String(r.year).padStart(3)} | ${r.cfadsP90Keuro.toFixed(2).padStart(10)} | ${(r.debtServiceSculptedKeuro ?? r.debtServiceKeuro).toFixed(2).padStart(16)} | ${r.debtOutstandingKeuro.toFixed(2).padStart(12)} | ${r.dscrTargetAtYear != null ? r.dscrTargetAtYear.toFixed(2).padStart(10) : "        —"} | ${r.dscrRealized != null ? r.dscrRealized.toFixed(4).padStart(11) : "         —"}`,
      );
    }
  });
});

describe("calibration Baugé — dégradation tabulée (fix courbe P90/P50)", () => {
  it("affiche production P50/P90, revenu merchant, CFADS P90 et sizing vs BP", () => {
    const input = baugeInput();
    const rows = calculateAnnualCashFlows(input);
    const metrics = calculateScenarioMetrics(input);
    const sizing = metrics.sizing;

    const BP_PROD_P50: Record<number, number> = { 1: 8385, 5: 8251, 10: 8083, 21: 7782, 24: null as unknown as number };
    const BP_PROD_P90: Record<number, number> = { 1: 7798, 5: 7674, 10: 7518, 21: 7174, 24: 7081 };

    console.log("\n=== PRODUCTION P50 / P90 — courbe tabulée vs BP (MWh) ===");
    console.log(
      `${"an".padStart(3)} | ${"prodP50 MF".padStart(10)} | ${"prodP50 BP".padStart(10)} | ${"prodP90 MF".padStart(10)} | ${"prodP90 BP".padStart(10)} | ${"ratio P90/P50".padStart(13)}`,
    );
    console.log("-".repeat(75));
    for (const y of [1, 5, 10, 21, 24]) {
      const r = rows.find((x) => x.year === y)!;
      const bp50 = BP_PROD_P50[y];
      const bp90 = BP_PROD_P90[y];
      console.log(
        `${String(y).padStart(3)} | ${r.productionP50Mwh.toFixed(1).padStart(10)} | ${bp50 != null ? bp50.toFixed(0).padStart(10) : "         —"} | ${r.productionP90Mwh.toFixed(1).padStart(10)} | ${bp90 != null ? bp90.toFixed(0).padStart(10) : "         —"} | ${(r.productionP90Mwh / r.productionP50Mwh).toFixed(4).padStart(13)}`,
      );
    }

    const r21 = rows.find((x) => x.year === 21)!;
    console.log("\n=== REVENU MERCHANT P90 an21 vs BP ===");
    console.log(`  revenueP90Keuro MF = ${r21.revenueP90Keuro.toFixed(3)} k€   (BP : 520.954 k€)`);
    console.log(`  cfadsP90Keuro   MF = ${r21.cfadsP90Keuro.toFixed(3)} k€   (BP : 284.089 k€)`);

    console.log("\n=== SIZING — dette après fix courbe dégradation tabulée ===");
    console.log(`  debtSculptedKeuro = ${(sizing?.debtSculptedKeuro ?? 0).toFixed(3)} k€  (BP : 5 216.873)`);
    console.log(`  debtRetenuKeuro   = ${(sizing?.debtRetenuKeuro ?? 0).toFixed(3)} k€`);
    console.log(`  gearingActuel     = ${((sizing?.gearingActuel ?? 0) * 100).toFixed(2)} %  (BP : 86.86 %)`);
    console.log(`  bindingConstraint = ${sizing?.bindingConstraint ?? "—"}`);

    const boundYears = rows
      .filter((r) => r.year >= 1 && r.year <= 24)
      .filter((r) => r.dscrRealized !== null && r.dscrTargetAtYear !== null
        && Math.abs(r.dscrRealized - r.dscrTargetAtYear) < 0.001)
      .map((r) => r.year);
    console.log(`  années au DSCR cible exact (bornantes) = [${boundYears.join(", ")}]`);

    // NOTE : cfadsP90Keuro est le CFADS PRÉ-IS brut (rev-opex) ; l'écart de -15.129k affiché
    // an24 vs la ligne BP "repayment" est ATTENDU (c'est justement la "Taxes P&L" que le
    // sizing retranche en interne via taxeFinaleSizingKeuro — vérifiable ci-dessus : dscrRealisé
    // an24 = 1.4000 pile, et debtSvc sculpté matche le Target Debt Service BP).
    console.log("\n=== CFADS P90 (pré-IS brut) — TOUTE LA QUEUE 18-24 vs ligne BP 'repayment' ===");
    const BP_CFADS_SCULPT: Record<number, number> = {
      18: 396.034, 19: 392.457, 20: 388.805, 21: 284.089, 22: 263.412, 23: 264.055, 24: 240.201,
    };
    for (const r of rows) {
      if (r.year < 18 || r.year > 24) continue;
      const bp = BP_CFADS_SCULPT[r.year];
      console.log(
        `  an${String(r.year).padStart(2)} : cfadsP90 MF = ${r.cfadsP90Keuro.toFixed(3).padStart(10)} k€   BP = ${bp.toFixed(3).padStart(10)} k€   Δ = ${(r.cfadsP90Keuro - bp).toFixed(3)}`,
      );
    }

    console.log("\n=== VÉRIF SCHEDULE DETTE — principal/intérêts an1 et an24 vs BP ===");
    let outstandingBefore = sizing?.debtRetenuKeuro ?? 0;
    for (const y of [1, 2, 23, 24]) {
      const r = rows.find((x) => x.year === y)!;
      const debtService = r.debtServiceSculptedKeuro ?? r.debtServiceKeuro;
      const interest = y === 1
        ? outstandingBefore * asRateLocal(input.debtInterestRate)
        : (rows.find((x) => x.year === y - 1)!.debtOutstandingKeuro) * asRateLocal(input.debtInterestRate);
      const principal = debtService - interest;
      console.log(
        `  an${y} : principal = ${principal.toFixed(3)} k€   intérêts = ${interest.toFixed(3)} k€   EoP outstanding = ${r.debtOutstandingKeuro.toFixed(3)} k€`,
      );
    }
    console.log(`  (BP : principal an1 169.117 · intérêts an1 219.109 · EoP an24 = 0)`);
  });
});

function asRateLocal(percent: number) {
  return percent / 100;
}

describe("calibration Baugé — OPEX an1 poste par poste", () => {
  it("affiche le détail OPEX an1 vs BP", () => {
    const input = baugeInput();
    const capex = calculateCapexDetails(input);
    const rows = calculateAnnualCashFlows(input);
    const an1 = rows.find((r) => r.year === 1)!;

    const opex = calculateOpexDetails(
      input,
      1,
      an1.revenueP50Keuro,
      an1.productionP50Mwh,
      capex.capexTotalKeuro,
    );

    // Valeurs BP Baugé an1 (k€) — d'après onglet charges BP Excel
    const BP_OPEX: Record<string, number | null> = {
      om:          32.100,   // O&M fixe (4.585 €/kWc × 7 MWc ÷ 1000)
      mra:          8.099,   // MRA (1.157 €/kWc × 7 MWc ÷ 1000)
      backOffice:  22.500,   // back-office
      divers:       8.611,   // divers
      loyer:       15.000,   // 15 ha × 1000 €/ha
      assurance:    9.434,   // 1.5% × revenu P50 628.9 k€
      balancing:   16.772,   // 2 €/MWh × 8386 MWh / 1000
      ifer:        19.108,   // IFER = (3.685 + 8.854 / 1.35) × 7 MWc
      tf:           2.629,   // TF (BP exact 2629 €)
      cfe:          2.165,   // CFE (BP exact 2165 €)
      aleas:        3.178,   // 0.5% × revenu P50 635.6 k€
      total:      139.600,   // Total OPEX an1 BP
    };

    console.log("\n=== OPEX AN1 — DÉTAIL POSTE PAR POSTE (k€) ===");
    console.log(
      `${"Poste".padEnd(20)} | ${"MF (k€)".padStart(10)} | ${"BP (k€)".padStart(10)} | ${"Δ (k€)".padStart(10)} | ${"Δ (€)".padStart(10)}`,
    );
    console.log("-".repeat(72));

    const postes: Array<[string, number, number | null]> = [
      ["O&M fixe",     opex.omKeuro,          BP_OPEX.om],
      ["MRA",          opex.mraKeuro,          BP_OPEX.mra],
      ["Back-office",  opex.backOfficeKeuro,   BP_OPEX.backOffice],
      ["Divers",       opex.diversKeuro,       BP_OPEX.divers],
      ["Loyer",        opex.loyerKeuro,        BP_OPEX.loyer],
      ["Assurance",    opex.assuranceKeuro,    BP_OPEX.assurance],
      ["Balancing",    opex.balancingKeuro,    BP_OPEX.balancing],
      ["IFER",         opex.iferKeuro,         BP_OPEX.ifer],
      ["TF",           opex.tfKeuro,           BP_OPEX.tf],
      ["CFE",          opex.cfeKeuro,          BP_OPEX.cfe],
      ["Aléas (0.5%)", opex.aleasKeuro,        BP_OPEX.aleas],
    ];

    for (const [label, mf, bp] of postes) {
      const delta = bp != null ? mf - bp : null;
      const deltaEuro = delta != null ? delta * 1000 : null;
      console.log(
        `${label.padEnd(20)} | ${mf.toFixed(3).padStart(10)} | ${bp != null ? bp.toFixed(3).padStart(10) : "         —"} | ${delta != null ? delta.toFixed(3).padStart(10) : "         —"} | ${deltaEuro != null ? deltaEuro.toFixed(0).padStart(10) : "         —"}`,
      );
    }

    console.log("-".repeat(72));
    console.log(
      `${"TOTAL OPEX".padEnd(20)} | ${opex.opexTotalKeuro.toFixed(3).padStart(10)} | ${(BP_OPEX.total ?? 0).toFixed(3).padStart(10)} | ${(opex.opexTotalKeuro - (BP_OPEX.total ?? 0)).toFixed(3).padStart(10)} | ${((opex.opexTotalKeuro - (BP_OPEX.total ?? 0)) * 1000).toFixed(0).padStart(10)}`,
    );

    console.log(`\n  (an1 cashflow check : opexTotalKeuro=${opex.opexTotalKeuro.toFixed(3)} = opexKeuro=${an1.opexKeuro.toFixed(3)} ?  match=${Math.abs(opex.opexTotalKeuro - an1.opexKeuro) < 0.01})`);
  });
});

describe("calibration Baugé — Règle 6 TF/CFE (Appréciation Directe)", () => {
  it("affiche TF, CFE, OPEX an1, dette et CCA vs BP", () => {
    const input = baugeInput();
    const capex = calculateCapexDetails(input);
    const taxes = calculateTaxesFoncieres(input, capex.capexTotalKeuro, 1);
    const rows = calculateAnnualCashFlows(input);
    const metrics = calculateScenarioMetrics(input);
    const an1 = rows.find((r) => r.year === 1);
    const sizing = metrics.sizing;

    const tfEuro   = taxes.tfAnnuelleKeuro * 1000;
    const cfeEuro  = taxes.cfeAnnuelleKeuro * 1000;
    const baseCad  = taxes.baseTaxesKeuro * 1000;

    console.log("\n=== RÈGLE 6 — TF / CFE (Appréciation Directe) ===");
    console.log(`  Base cadastrale commune  = ${baseCad.toFixed(0)} €   (BP : 7 498 €)`);
    console.log(`  TF  calculé              = ${tfEuro.toFixed(0)} €   (BP : 2 629 €,  Δ = ${(tfEuro - 2629).toFixed(0)} €)`);
    console.log(`  CFE calculé              = ${cfeEuro.toFixed(0)} €   (BP : 2 165 €,  Δ = ${(cfeEuro - 2165).toFixed(0)} €)`);
    console.log(`  TF + CFE                 = ${(tfEuro + cfeEuro).toFixed(0)} €   (BP : 4 794 €,  Δ = ${(tfEuro + cfeEuro - 4794).toFixed(0)} €)`);

    console.log("\n=== OPEX an1 vs BP ===");
    console.log(`  OPEX MF an1  = ${(an1?.opexKeuro ?? 0).toFixed(2)} k€   (BP cible : 139.6 k€)`);

    console.log("\n=== SIZING — DETTE / CCA vs BP ===");
    const capexTotal = capex.capexTotalKeuro;
    const dette = sizing?.debtRetenuKeuro ?? 0;
    const cca = capexTotal - dette;
    const gearing = sizing?.gearingActuel != null ? sizing.gearingActuel * 100 : 0;
    console.log(`  CAPEX    = ${capexTotal.toFixed(3)} k€   (BP : 6 005.975)`);
    console.log(`  Dette    = ${dette.toFixed(3)} k€   (BP : 5 216.873,  Δ = ${(dette - 5216.873).toFixed(3)})`);
    console.log(`  CCA      = ${cca.toFixed(3)} k€   (BP :   789.101,  Δ = ${(cca - 789.101).toFixed(3)})`);
    console.log(`  Gearing  = ${gearing.toFixed(2)} %    (BP :    86.86 %)`);
  });
});

describe("calibration Baugé — Règle 4 SHL schedule complet", () => {
  it("affiche schedule SHL années -1 à 13 vs BP", () => {
    const rows = calculateAnnualCashFlows(baugeInput());
    const watchYears = [-1, 0, 1, 2, 3, 5, 10, 13];

    // Valeurs BP de référence (k€)
    const BP_SHL: Record<number, { bop: number | null; capit: number | null; intPaid: number | null; remb: number | null; eop: number | null; cash: number | null }> = {
      [-1]: { bop: 0,     capit: null,  intPaid: null,  remb: null,  eop: 789.1, cash: null },
      [0]:  { bop: 789.1, capit: 39.5,  intPaid: null,  remb: null,  eop: 828.6, cash: null },
      [1]:  { bop: 828.6, capit: null,  intPaid: 41.4,  remb: 62.6,  eop: 766.0, cash: 104.0 },
      [2]:  { bop: 766.0, capit: null,  intPaid: 38.3,  remb: 65.4,  eop: 700.6, cash: 103.7 },
      [3]:  { bop: 700.6, capit: null,  intPaid: 35.0,  remb: 68.7,  eop: 631.9, cash: 103.7 },
      [5]:  { bop: 631.9, capit: null,  intPaid: 28.0,  remb: 75.2,  eop: null,  cash: 103.2 },
      [10]: { bop: null,  capit: null,  intPaid: null,   remb: null,  eop: null,  cash: null },
      [13]: { bop: 341.3, capit: null,  intPaid: null,  remb: 341.3, eop: 0,     cash: null },
    };

    const hdr = `${"an".padStart(3)} | ${"ccaBoP".padStart(8)} | ${"drawdown".padStart(8)} | ${"capitInt".padStart(8)} | ${"intPaid".padStart(8)} | ${"remb".padStart(8)} | ${"ccaEoP".padStart(8)} | ${"cashAvail".padStart(9)}`;
    console.log("\n=== RÈGLE 4 — SCHEDULE SHL COMPLET (k€) ===");
    console.log(hdr);
    console.log("-".repeat(hdr.length));

    for (const y of watchYears) {
      const r = rows.find((x) => x.year === y);
      if (!r) { console.log(`${String(y).padStart(3)} | —`); continue; }
      const bp = BP_SHL[y];
      const debtSvc = r.debtServiceSculptedKeuro ?? r.debtServiceKeuro;
      const cashAvail = Math.max(0, r.cfadsAfterTax - debtSvc);

      const fmtD = (v: number, bpV: number | null) => {
        const s = v.toFixed(1).padStart(8);
        return bpV != null ? `${s}(${(v - bpV >= 0 ? "+" : "")}${(v - bpV).toFixed(1)})` : s;
      };

      console.log(
        `${String(y).padStart(3)} | ${fmtD(r.ccaBoPKeuro, bp?.bop ?? null).padStart(14)} | ${fmtD(r.ccaDrawdownKeuro, null).padStart(8)} | ${fmtD(r.ccaCapitalizedInterestKeuro, bp?.capit ?? null).padStart(14)} | ${fmtD(r.ccaInteretsKeuro, bp?.intPaid ?? null).padStart(14)} | ${fmtD(r.ccaRemboursementKeuro, bp?.remb ?? null).padStart(14)} | ${fmtD(r.ccaEoPKeuro, bp?.eop ?? null).padStart(14)} | ${fmtD(cashAvail, bp?.cash ?? null).padStart(14)}`,
      );
    }

    const an1 = rows.find((r) => r.year === 1)!;
    const an0 = rows.find((r) => r.year === 0)!;
    console.log(`\n  Drawdown (y-1) : ${rows.find(r => r.year === -1)?.ccaDrawdownKeuro.toFixed(3)} k€   (BP 789.101 k€)`);
    console.log(`  Capitalisé y0  : ${an0.ccaCapitalizedInterestKeuro.toFixed(3)} k€  (BP 39.455 k€)`);
    console.log(`  BoP y1         : ${an1.ccaBoPKeuro.toFixed(3)} k€  (BP 828.556 k€)`);
    console.log(`  Intérêts y1    : ${an1.ccaInteretsKeuro.toFixed(3)} k€  (BP 41.428 k€)`);
    console.log(`  Remb y1        : ${an1.ccaRemboursementKeuro.toFixed(3)} k€  (BP 62.600 k€)`);
    console.log(`  EoP y1         : ${an1.ccaEoPKeuro.toFixed(3)} k€  (BP 765.956 k€)`);
  });
});
