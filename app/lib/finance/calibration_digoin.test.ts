import { describe, expect, it } from "vitest";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateScenarioMetrics,
  calculateTaxesFoncieres,
} from "@/app/lib/finance/engine";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";
import {
  CAPACITY_PRICE_CURVE,
  FIXED_CURVE_2026Q2,
} from "@/app/lib/finance/merchantCurves";

// ---------------------------------------------------------------------------
// CALIBRATION DIGOIN — premier test « SAISIE PURE » du template générique (T1.2).
// Source de vérité : docs/FICHE_DIGOIN.md (14 cibles) + docs/SPEC_BP_SIGOULES.md (Annexe A).
// Digoin = 4 MWc, MES 2030, PPA 80 €/MWh 20 ans. Aucune archéologie : tous les inputs sont lus
// dans le BP xlsm du 12/06/2026. On valide LIGNE PAR LIGNE de haut en bas (CALIBRATION.md).
//
// RÉSULTAT (diagnostic) : la chaîne CAPEX → dette → equity → prod → revenu → CFADS → TF/CFE →
// service dette (+ split principal/intérêts) → flux actionnaire → TRI investisseur CALE À L'EURO
// en saisie pure, AVEC l'override baseFonciereKeuro (secours fiche §6). Le 1er `it` l'ASSERTE.
// Le 2nd `it` DIAGNOSTIQUE les 2 gaps génériques restants (candidats Phase 2) : (a) base foncière
// €/Wc (Fix 2) +0,2% ; (b) TRI projet brut/net + VAN (réintégrations D/E/F + démantèlement G7).
// ---------------------------------------------------------------------------

function expectClose(actual: number, expected: number, tol: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label} : MF=${actual} attendu=${expected} (±${tol}) Δ=${(actual - expected).toFixed(3)}`,
  ).toBeLessThanOrEqual(tol);
}

// baseMode : "override" = baseFonciereKeuro pré-sommé 103,826 (secours fiche) ;
//            "wc" = saisie €/Wc 0,0224167 + bâtiments 0 + MOD 440 (teste le calcul Fix 2).
function digoinInput(baseMode: "wc" | "override"): FinanceEngineInput {
  return {
    // Timing & technique
    capacityMw: 4,
    capex: 0,
    opex: 0,
    yieldMwh: 1250,
    unavailability: 0.01, // prod P50 an1 = 4000 × 1250 × 0,99 = 4 950 MWh
    tariff: 80,
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
    commissioningYear: 2030,
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
    contingencyRate: 2, // BOS contingency 28 000 €
    raccordementOuvrageKEuro: 800,
    devFeesKEuroPerMW: 110, // MOD 440 k€
    indemnitesImmoKeuro: 50,
    // Financing fees (7 composants template, base PLT = CAPEX hors fees × 1,04 × 95%)
    legalFeesKEuro: 10,
    technicalDDKEuro: 5,
    arrangerFeesRate: 0.8,
    participantFeesRate: 0.4,
    bankFeesPLTKEuroPerMW: 1.5,
    interimFinancingRate: 2.5,
    commitmentFeesRate: 0.1,
    // OPEX
    omFixedEuroKwc: 5.615907,
    mraEuroKwc: 1.157127, // ⚠️ premier projet avec MRA onduleurs ≠ 0
    inflationMRA: 2,
    backOfficeKeuro: 22.5,
    assuranceRate: 1.5,
    inflationAssurance: 2,
    balancingCost: 2,
    surfaceHa: 3,
    loyerMode: "euroParHa",
    loyerValeur: 1000,
    loyerInflation: 0.4,
    inflationOM: 2,
    inflationBackOffice: 2,
    diversOpexKeuro: 7.277778, // compteur+télécom+inspection+autoconso
    aleasOpexRate: 0.5,
    // Taxes
    methodeTaxes: "appreciation_directe",
    ...(baseMode === "override"
      ? { baseFonciereKeuro: 103.826 }
      : {
          fonciereBienEuroWc: 0.0224167, // immo soumises = 89 666,8 €
          batimentsFonciersKeuro: 0,
          modRetraitementKeuro: 440,
        }),
    valeurTerrainKeuro: 15, // 5 000 €/ha × 3 ha
    tauxTFCommune: 0.3069,
    tauxTFEPCI: 0.0487,
    tauxTSE: 0.0024,
    tauxGEMAPI: 0.0023,
    tauxTEOM: 0,
    tauxCFECommune: 0,
    tauxCFEEPCI: 0.2594,
    tauxTSECfe: 0.0086,
    tauxGEMAPICfe: 0,
    tauxCCI: 0.0112,
    iferRate1: 3.758799, // barème MES 2030
    iferRate2: 9.03088,
    iferRpn: 1.35,
    inflationTaxes: 2,
    // Fiscal / D&A
    tauxIS: 25,
    amortDuree: 20,
    coefDegressif: 2.25,
    // SHL / DSRF / agent
    ccaRemunRate: 5,
    dsraMonths: 6,
    dsrfFeeRate: 1.4,
    agentFeeAnnuelKeuro: 1.0,
    // Courbes merchant / capacité — techno "Fixed" (partagée), décalées MES 2030
    inflationAurora: 2,
    curveIndexAn1: 1.124496, // = 1,10245 × 1,02 (MES 2030), Inp_Curve price!r34
    capacityCertificateMw: 0.1,
    goStartYear: 21,
    goPriceBase: 1,
    investorCurveW: 1,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    capacityPriceCurve: CAPACITY_PRICE_CURVE,
    auroraCurves: FIXED_CURVE_2026Q2,
  } as FinanceEngineInput;
}

describe("calibration Digoin — SAISIE PURE, chaîne calée à l'euro (base foncière override)", () => {
  it("CAPEX/dette/equity/prod/revenu/CFADS/TF-CFE/service dette/flux/TRI investisseur", () => {
    const input = digoinInput("override");
    const capex = calculateCapexDetails(input);
    const metrics = calculateScenarioMetrics(input);
    const rows = calculateAnnualCashFlows(input)
      .filter((r) => r.year >= 1)
      .sort((a, b) => a.year - b.year);
    const at = (y: number) => {
      const r = rows.find((x) => x.year === y);
      if (!r) throw new Error(`ligne an${y} absente`);
      return r;
    };
    const eur = (keuro: number) => keuro * 1000;

    // ① CAPEX total = investissement initial = CAPEX (hors fees, calculé) + financing fees
    // (7 composants). NB : calculateCapexDetails().capexTotalKeuro EXCLUT les fees calculés ;
    // le total BP = capex + fees, comme initialInvestment du moteur (metrics.financingFeesKeuro).
    const capexTotalEuro = eur(capex.capexTotalKeuro + metrics.financingFeesKeuro);
    expectClose(capexTotalEuro, 3_401_358.93, 1, "① CAPEX total (capex+fees)");

    // ② Dette sculptée (binding DSCR, gearing 92,03% < cap 95) & equity/SHL = solde.
    // ⚠️ Item 8 Phase 2 : le CFADS de dimensionnement est net de l'IS du cas P90. Digoin ayant un
    // gearing élevé (≈92 %, petit CCA → SHL éteint tôt, plus de bouclier), il est TAXÉ dès l'an20
    // (isP90 an20 ≈ 23,8 k€, an21 ≈ 32,6 k€) — cohérent avec le cluster taxé du BP (Villognon 92 %,
    // Salbris 90,6 %, Ychoux 95 %, tous taxés dans leur feuille C_P90). La dette baisse donc de
    // 3 192,5 → 3 130,4 k€ (méthode BP-correcte) ; les ex-valeurs verrouillaient la méthode pré-item-8
    // (aucun IS de sizing). Le flux actionnaire an1 (P50) reste INCHANGÉ (63 832,15 €).
    const dette = metrics.sizing?.debtRetenuKeuro ?? 0;
    const gearing = (metrics.sizing?.gearingActuel ?? 0) * 100;
    expectClose(eur(dette), 3_130_420.00, 100, "② dette sculptée");
    expectClose(gearing, 92.03, 0.02, "② gearing %");
    expect(metrics.sizing?.bindingConstraint, "② binding = dscr (pas gearing-capped)").toBe(
      "dscr",
    );
    expectClose(capexTotalEuro - eur(dette), 270_939.11, 100, "② equity/SHL");

    // ③ Production (P50 an1 = 4 950 · P90 = 4 603,5) — exact
    expectClose(at(1).productionP50Mwh, 4_950, 0.01, "③ prod P50 an1");
    expectClose(at(1).productionP90Mwh, 4_603.5, 0.01, "③ prod P90 an1");

    // ③ Revenu PPA an1 = prod P50 × 80 = 396 000 € (le revenu MF total = 399 325 inclut le
    // certificat de capacité ; le revenu P90 pur = 4 603,5 × 80 = 368 280, sans capacité).
    expectClose(eur(at(1).revenueP90Keuro), 368_280, 1, "③ revenu P90 (PV pur) an1");
    expectClose(at(1).productionP50Mwh * 80, 396_000, 1, "③ revenu PPA P50 an1");

    // CFADS sizing (P90 EBITDA) an1 — pilote le sculpting
    expectClose(eur(at(1).cfadsP90Keuro), 277_286.81, 1, "CFADS P90 an1");

    // TF / CFE an1 (Appréciation Directe, base passible 103 825,58) — override
    const taxes = calculateTaxesFoncieres(input, capex.capexTotalKeuro, 1);
    expectClose(eur(taxes.tfAnnuelleKeuro), 1_598.86, 1, "TF an1");
    expectClose(eur(taxes.cfeAnnuelleKeuro), 1_243.61, 1, "CFE an1");

    // Service dette an1 = 241 118,95 = principal 109 641,52 + intérêts 131 477,43. Le service an1
    // est INCHANGÉ (DSCR × CFADS P90 an1, IS_P90 an1 = 0) ; seule la ventilation intérêts/principal
    // bouge car la dette totale a baissé (item 8 : intérêt an1 = dette × 4,2 %).
    // ⚠️ row.interets = intérêts DETTE + intérêts SHL ; l'intérêt dette pur = interets − ccaInterets.
    const ds = at(1).debtServiceSculptedKeuro ?? at(1).debtServiceKeuro;
    const debtInterest = at(1).interets - at(1).ccaInteretsKeuro;
    expectClose(eur(ds), 241_118.95, 1, "service dette an1");
    expectClose(eur(debtInterest), 131_477.43, 1, "intérêts dette an1");
    expectClose(eur(ds - debtInterest), 109_641.52, 1, "principal dette an1");

    // ④ Flux actionnaire an1 (FCF after debt service) = 63 832,15 € — exact (inchangé item 8)
    expectClose(eur(at(1).fluxActionnaire), 63_832.15, 1, "④ flux actionnaire an1");

    // ④ TRI investisseur = 19,24 % (mise 270 939 relevée par l'IS de sizing item 8, fort levier).
    // Résiduel démantèlement an25-29 (G7) non modélisé (identique au résiduel Sigoulès, cf CALIBRATION.md).
    expectClose(metrics.investorIrr, 19.24, 0.05, "④ TRI investisseur");
  });
});

describe("calibration Digoin — DIAGNOSTIC des gaps génériques restants (candidats Phase 2)", () => {
  it("gap A : base foncière €/Wc (Fix 2) & gap B : TRI projet brut/net + VAN", () => {
    // --- Gap A : route €/Wc (Fix 2) vs override pré-sommé ---
    const inputWc = digoinInput("wc");
    const capexWc = calculateCapexDetails(inputWc);
    const taxesWc = calculateTaxesFoncieres(inputWc, capexWc.capexTotalKeuro, 1);
    const tfWc = taxesWc.tfAnnuelleKeuro * 1000;
    const cfeWc = taxesWc.cfeAnnuelleKeuro * 1000;
    console.log("\n=== GAP A — base foncière €/Wc (Fix 2) vs cible BP ===");
    console.log(`  TF  an1 (€/Wc)  = ${tfWc.toFixed(2)} €   cible 1 598,86   Δ ${(tfWc - 1598.86).toFixed(2)} (${((tfWc / 1598.86 - 1) * 100).toFixed(2)}%)`);
    console.log(`  CFE an1 (€/Wc)  = ${cfeWc.toFixed(2)} €   cible 1 243,61   Δ ${(cfeWc - 1243.61).toFixed(2)} (${((cfeWc / 1243.61 - 1) * 100).toFixed(2)}%)`);
    console.log(`  Cause : MOD retraité au prorata immoSoumises/immobilisations (dénominateur`);
    console.log(`  moteur = modules+BoS+contingency+raccord = 2 745 241 €, ratio 3,266%). BP ratio`);
    console.log(`  3,218% ⇒ MOD 14 158,91 & base passible 103 825,58 ; moteur ⇒ base ~104 038 €`);
    console.log(`  (+213 €, +0,2%). Impact CFADS < 0,003% (277 281 vs 277 287). Gap Fix 2 générique.`);
    // Le €/Wc surestime la base de ~+213 € → TF +0,2% : diagnostic, PAS d'assertion à l'euro.
    expect(Math.abs(tfWc - 1598.86)).toBeLessThanOrEqual(5); // documenté, gap Phase 2

    // --- Gap B : TRI projet brut/net + VAN (réintégrations D/E/F + démantèlement G7) ---
    const input = digoinInput("override");
    const metrics = calculateScenarioMetrics(input);
    console.log("\n=== GAP B — TRI projet & VAN (réintégrations D/E/F + démantèlement) ===");
    console.log(`  TRI investisseur  MF ${metrics.investorIrr}%   cible 19,24%   (item 8 : CFADS sizing net d'IS P90)`);
    console.log(`  TRI projet (irr)  MF ${metrics.irr}%   cible brut 8,24% / net 6,77%`);
    console.log(`  doubleIRR.irrInvest MF ${metrics.doubleIRR?.irrInvest}%   (projet EBITDA−IS)`);
    console.log(`  npv MF ${metrics.npv} k€ · investorNpv ${metrics.investorNpv} k€ · cible VAN 876,1 / 436,1 k€`);
    console.log(`  Cause : (1) démantèlement 40 000 €/an an25-29 (G7) non modélisé → flux tardifs`);
    console.log(`  surestimés (TRI projet ↑) ; (2) VAN brute/nette BP = flux projet + réintégrations`);
    console.log(`  additives D/E/F (marge MOD, coût dev) non implémentées (SPEC §2.8). Gaps GÉNÉRIQUES.`);
  });
});
