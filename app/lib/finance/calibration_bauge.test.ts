import { describe, it } from "vitest";
import { calculateAnnualCashFlows, calculateCapexDetails } from "@/app/lib/finance/engine";
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
