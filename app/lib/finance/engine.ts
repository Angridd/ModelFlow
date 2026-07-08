import type {
  DebtScheduleItem,
  DoubleIRR,
  DscrTranche,
  FinancialAssumptions,
  SizingResult,
  T0Flows,
} from "@/app/lib/finance/types";

const IRR_MIN_RATE = -0.9999;
const IRR_MAX_RATE = 10;
const DSCR_FALLBACK = 1.3;
const CCA_REMUN_RATE = 0;
const CONTRACT_DURATION_FALLBACK = 20;
const CONSTRUCTION_YEARS_FALLBACK = 1;
const ASSURANCE_RATE_FALLBACK = 2.5;
const INFLATION_ASSURANCE_FALLBACK = 2;
const BALANCING_COST_FALLBACK = 2;
const TAUX_EUR_USD_FALLBACK = 1.16;
const OM_FIXED_EURO_KWC_FALLBACK = 5.1;
const MRA_EURO_KWC_FALLBACK = 1.1;
const BACK_OFFICE_KEURO_FALLBACK = 22;
const DIVERS_OPEX_KEURO_FALLBACK = 35;
const LOYER_INFLATION_FALLBACK = 0.4;
const INFLATION_OM_FALLBACK = 2;
const DSRF_FEE_RATE_FALLBACK = 1.4;
const INFLATION_MRA_FALLBACK = 2;
// ─── Méthodes Phase 3 (fallback projets neufs, cf docs/PHASE3_METHODES.md §4.1/§4.2) ─────────
// Démantèlement : 10 000 €/MWc = la valeur EXACTE des 25 BP (total C_P50 r195 / MWc), étalée
// également sur an25-29 (non indexée) en timing « fin_de_vie ».
const DEMANTELEMENT_EURO_MWC_FALLBACK = 10_000;
const DEMANTELEMENT_YEAR_FROM = 25;
const DEMANTELEMENT_YEAR_TO = 29;
// MRA en paliers (renouvellement onduleurs / garantie constructeur) : ratios EXACTS dérivés des
// séries C_P50 r189 dé-indexées (÷1,02^(y−1)) ÷ moyenne — identiques (à 1e-9 près) sur les 17
// BP « Input » à paliers. Les niveaux des paliers sont proportionnels à 6 / 11 / 16 / 13 ;
// normalisés pour que la moyenne sur 35 ans vaille 1 (poids 4×6 + 11×11 + 3×16 + 17×13 = 414) :
//   an1-4 = 6×35/414 = 210/414 ≈ 50,72 % · an5-8 & an12-18 = 11×35/414 = 385/414 ≈ 93,00 %
//   an9-11 = 16×35/414 = 560/414 ≈ 135,27 % · an19+ = 13×35/414 = 455/414 ≈ 109,90 %
const MRA_PALIER_RATIOS: ReadonlyArray<{ yearTo: number; ratio: number }> = [
  { yearTo: 4, ratio: 210 / 414 },
  { yearTo: 8, ratio: 385 / 414 },
  { yearTo: 11, ratio: 560 / 414 },
  { yearTo: 18, ratio: 385 / 414 },
  { yearTo: Number.POSITIVE_INFINITY, ratio: 455 / 414 },
];

function mraPalierRatio(year: number): number {
  for (const { yearTo, ratio } of MRA_PALIER_RATIOS) {
    if (year <= yearTo) return ratio;
  }
  return 1;
}
// Engagements (tranche 2, §4.3) : indexation fixe de la méthode « base an1 × 1,02^(y−1) »
// (hypothèse utilisateur pour un projet neuf — les BP existants routent leur série r199).
const ENGAGEMENTS_INDEXATION_RATE = 0.02;
const INFLATION_BACK_OFFICE_FALLBACK = 2;
const INFLATION_DIVERS_FALLBACK = 2;
const METHODE_TAXES_FALLBACK = "appreciation_directe";
const IFER_RATE_1_FALLBACK = 3.5;
const IFER_RATE_2_FALLBACK = 8.5;
const IFER_RPN_FALLBACK = 1.35;
const INFLATION_AURORA_FALLBACK = 2;
const TAUX_LF_AD = 0.08;
const TAUX_LF_COMPTA = 0.04;
const ABATT_IMMO = 0.30;
const COEF_NEUTRAL = 0.14632;
const FRAIS_TF = [0.03, 0.03, 0.09, 0.03, 0.08] as const;
const FRAIS_CFE = [0.03, 0.03, 0.09, 0.00, 0.09] as const;
// Appréciation Directe (Règle 6)
const ABATT_AD = 0.50;
const COEF_NEUTRAL_AD = 0.256066; // coef de neutralisation TFPB exact (grille tarifaire, BP §3.01)
const RATIO_PART_FONC_AD = 0.0293;
const VALEUR_VENALE_HA_AD = 5000;
// Frais de gestion (Appréciation Directe), calculés par composante : 3% sur les taxes
// principales (commune + EPCI + GEMAPI + TEOM), 9% sur TSE et CCI. Règle BP générique —
// remplace les ex-forfaits FRAIS_TF_EURO=78 / FRAIS_CFE_EURO=72 (qui étaient les frais de
// gestion CALCULÉS de Baugé, gelés en dur → violation du principe générique).
const FRAIS_GESTION_PRINCIPALES = 0.03;
const FRAIS_GESTION_TSE_CCI = 0.09;
// ─── MÉTHODE TF/CFE Phase 3 (tranche 4 — docs/PHASE3_METHODES.md §4.4) ───────────────────────
// Frais de gestion TEOM = 8 % : formule template J312/J362 = « 3%×principales + 9%×TSE +
// 8%×TEOM », vérifiée AU CENTIME sur data/4 (Baugé), data/20 (Selles) et data/21 (Sigoulès) —
// la branche legacy (ancres Baugé/Sigoulès, TEOM=0) groupait le TEOM à 3 %, on ne la touche pas.
const FRAIS_GESTION_TEOM = 0.08;
// Frais de gestion CFE « comptable » : le template n'applique AUCUN frais proportionnel en
// comptable — il additionne la valeur EN DUR J331 = 134,8827…€ (artefact template, identique
// dans les 25 data/<N>.xlsm), reproduite pour le centime (Selles), seulement si Σ taux CFE > 0.
const CFE_COMPTABLE_FRAIS_GESTION_EURO = 134.88273159428238;

export type FinanceEngineInput = FinancialAssumptions & {
  capacityMw: number;
  commissioningYear?: number | null;
  capex: number;
  opex: number;
  yieldMwh: number;
  yieldP90Mwh?: number | null;
  // Indisponibilité (fraction, ex. 0.01 = 1%). Défaut 0 → production inchangée (rétrocompatible).
  // Production = yield × MW × dégradation × (1 − unavailability). Permet de fournir un yield BRUT et
  // de le disponibiliser dans le moteur. Baugé garde yieldMwh 1198 (déjà net) + unavailability 0.
  unavailability?: number | null;
  // Courbe de dégradation tabulée (garantie fabricant), normalisée base 1.0, indexée
  // an1..N (degradationCurve[0] = an1). Remplace l'exponentiel (1-degradationRate)^(year-1)
  // quand fournie ; au-delà de sa longueur, l'exponentiel prend le relais depuis le dernier
  // coefficient tabulé. Absente → comportement exponentiel inchangé (Sigoulès).
  degradationCurve?: number[] | null;
  tariff: number;
  debtRate: number;
  dscrTarget?: number | null;
  debtTenorYears?: number | null;
  // "Taxes P&L" BP : IS soustrait du CFADS de sizing SEULEMENT à la dernière année du tenor
  // (an1..tenor-1 sculptent pré-IS). Absent/0 → comportement inchangé (pas de retranchement).
  taxeFinaleSizingKeuro?: number | null;
  dscrSchedule?: DscrTranche[] | null;
  gearingMaxPct?: number | null;
  gearingMax?: number | null;
  structuringFeeRate?: number | null;
  tauxIS?: number | null;
  amortDuree?: number | null;
  capexType1Keuro?: number | null;
  capexType2Keuro?: number | null;
  // Coef d'amortissement dégressif Type 1. Absent → barème fiscal FR par durée
  // (1,25 / 1,75 / 2,25 selon la durée ; 2,25 pour > 6 ans). Template BP Sigoulès/Baugé : 2,25.
  coefDegressif?: number | null;
  margeDevKeuro?: number | null;
  dsraMonths?: number | null;
  // DSRF (réserve service dette) + agent fee : retirés chaque année du flux equity ET de l'EBT
  // ("FCF after debt service = CFADS − principal − intérêts − DSRF − agent fee").
  // DSRF(y) = dsrfFeeRate% × dsraMonths/12 × service dette(y) appliqué, sur la période de dette (§2.1).
  dsrfFeeRate?: number | null;
  // Legacy : DSRF annuel flat (montant). Absent → calculé via dsrfFeeRate (template BP).
  dsrfAnnuelKeuro?: number | null;
  // Agent fee : valeur an1, indexée à l'inflation opex, 0 après la maturité de dette (§2.7).
  agentFeeAnnuelKeuro?: number | null;
  devFeesKEuroPerMW?: number | null;
  tauxISEntreprise?: number | null;
  contingencyRate?: number | null;
  longueurModule?: number | null;
  largeurModule?: number | null;
  txAmenagementRate?: number | null;
  coefArcheo?: number | null;
  legalFeesKEuro?: number | null;
  technicalDDKEuro?: number | null;
  arrangerFeesRate?: number | null;
  participantFeesRate?: number | null;
  bankFeesPLTKEuroPerMW?: number | null;
  interimFinancingRate?: number | null;
  commitmentFeesRate?: number | null;
  contractDuration?: number | null;
  constructionYears?: number | null;
  auroraCurves?: Array<{
    year: number;
    high: number;
    central: number;
    low: number;
  }> | null;
  capacityPriceCurve?: number[];
  capacityCertificateMw?: number | null;
  goStartYear?: number | null;
  goPriceBase?: number | null;
  debtSizingCentralW?: number | null;
  debtSizingLowW?: number | null;
  investorCurveW?: number | null;
  assuranceRate?: number | null;
  inflationAssurance?: number | null;
  balancingCost?: number | null;
  surfaceHa?: number | null;
  indemnitesImmoKeuro?: number | null;
  // Financing fees RÉELLEMENT APPLIQUÉS par le BP (Inp_Assumption r548, k€) — valeur an0 routée
  // par projet (Phase 2, même stratégie « valeur appliquée » que TF/CFE, MRA, engagements). Portés
  // dans le CAPEX total (calculateCapexDetails, poste No D&A, hors base foncière/OPEX) et, quand
  // présents, NEUTRALISENT le recalcul par taux 7 composants (calculateFinancingFees → 0, sinon
  // double comptage : la formule standard ×0,95 diverge des fees édités à la main dans certains
  // BP, ex. Salbris ×0,8 → 610,4 k€ appliqués vs 720,2 k€ recalculés). null → recalcul par taux
  // inchangé (rétrocompat stricte). Persisté : colonne Scenario.financingFeesKeuro (Float?).
  financingFeesKeuro?: number | null;
  prixModuleUSDWc?: number | null;
  tauxEURUSD?: number | null;
  boSCtWc?: number | null;
  raccordementOuvrageKEuro?: number | null;
  tarifQPKEuroPerMW?: number | null;
  apportAffaireMode?: string | null;
  apportAffaireValeur?: number | null;
  omFixedEuroKwc?: number | null;
  mraEuroKwc?: number | null;
  backOfficeKeuro?: number | null;
  diversOpexKeuro?: number | null;
  // OPEX discrétionnaires « engagements » du BP (feuille Inp_Opération, ligne « Total
  // Engagements »), en k€ par ANNÉE PROJET (index 0 = an1). Montants RÉELS déjà datés par le BP :
  // lumpy et front-loadés → routés ADDITIVEMENT dans opexP50 ET opexP90 SANS ré-indexation
  // (contrairement à diversOpexKeuro). Absent/[] → aucun changement (rétrocompat stricte).
  opexEngagementsKeuroByYear?: number[] | null;
  // TF / CFE RÉELLEMENT APPLIQUÉES par le BP (C_P50 r191 / r192), en k€ par ANNÉE PROJET (index
  // 0 = an1), routées par projet (item 4). Priment sur la base calculée par calculateTaxesFoncieres
  // quand présentes : la MÉTHODE d'assiette du BP (comptable si achat terrain, sinon appréciation
  // directe) varie par site et n'est pas reconstituable simplement — la série appliquée est le
  // ground truth exact. Absent/[] → base calculée (rétrocompat stricte). Persistées en base :
  // colonnes Scenario.tfKeuroByYear / cfeKeuroByYear (String? JSON, comme opexEngagementsKeuroByYear).
  tfKeuroByYear?: number[] | null;
  cfeKeuroByYear?: number[] | null;
  // Démantèlement RÉELLEMENT APPLIQUÉ par le BP (C_P50/C_P90 r195), en k€ par ANNÉE PROJET
  // (index 0 = an1) — poste OPEX des années 25-29 UNIQUEMENT (constant, non indexé :
  // Inp_Assumption r294 étalé sur 5 ans, ex. Ychoux 131 700 € → 26,34 k€/an). Additif au
  // Total OPEX P50 ET P90 (item 2) ; les années hors 25-29 sont à 0 dans la série. Absent/[]
  // → 0 (rétrocompat stricte). Persisté : colonne Scenario.demantelementKeuroByYear
  // (String? JSON, comme tfKeuroByYear).
  demantelementKeuroByYear?: number[] | null;
  // MRA RÉELLEMENT APPLIQUÉE par le BP (C_P50 r189), en k€ par ANNÉE PROJET (index 0 = an1) —
  // courbe en PALIERS (profil de renouvellement onduleurs / garantie constructeur), déjà indexée
  // 2 %/an, flag exploitation inclus (item 6). Prime sur la formule scalaire mraEuroKwc × MW ×
  // 1,02^(y−1) (moyenne 35 ans plate) quand présente ; le P90 la reprend via opexDetailsP50.
  // Absent/[] → formule scalaire (rétrocompat stricte). Persistée : colonne
  // Scenario.mraKeuroByYear (String? JSON, comme tfKeuroByYear).
  mraKeuroByYear?: number[] | null;
  // ─── MÉTHODES Phase 3 (fallback pour projets NEUFS, sans data/<N>.xlsm) ───────────────────
  // La série routée (demantelementKeuroByYear / mraKeuroByYear) garde la PRIORITÉ ABSOLUE.
  // Quand elle est absente, la MÉTHODE remplace l'ancien fallback plat/zéro (voulu — c'est le
  // nouveau défaut des scénarios sans série routée, cf docs/PHASE3_METHODES.md §1 et §7.1).
  //
  // Démantèlement — coût total = demantelementEuroMWc × MWc (défaut 10 000 €/MWc, vérifié
  // EXACT sur les 25 BP : total r195 / MWc = 10 000,00 partout). Timing :
  //   • "fin_de_vie" (défaut) : étalé également sur an25-29, NON indexé (= le BP).
  //   • "construction"        : provisionné en année 0 (poste CAPEX No D&A, non amorti).
  demantelementEuroMWc?: number | null;
  demantelementTiming?: string | null;
  // MRA — profil de la méthode quand mraKeuroByYear est absente :
  //   • "paliers" (défaut) : mraEuroKwc (moyenne 35 ans) × kWc × ratio_palier(y) × 1,02^(y−1).
  //     Ratios UNIVERSELS dérivés des BP « Input » (niveaux ∝ 6/11/16/13, normalisés sur 35
  //     ans : an1-4 = 210/414, an5-8 = 385/414, an9-11 = 560/414, an12-18 = 385/414,
  //     an19+ = 455/414) — identiques au ratio près de 1e-9 sur les 17 projets à paliers.
  //   • "plat"             : ancienne formule scalaire plate (rares sites type Mur-de-Sologne).
  mraProfil?: string | null;
  // Engagements — MÉTHODE (tranche 2) quand opexEngagementsKeuroByYear est absente : montant de
  // l'année 1 en k€, indexé 2 %/an → engagements(y) = engagementsKeuroAn1 × 1,02^(y−1).
  // ⚠️ PAS de défaut imposé (contrairement au démantèlement/MRA) : l'an1/MWc des 25 BP varie de
  // 369 à 9 586 €/MWc (médiane ≈ 2 626 — audit scripts/_audit_phase3_engagements.ts) et leurs
  // séries r199 sont des échéanciers contractuels lumpy (0/21 purement indexés) → null →
  // comportement actuel inchangé (0, rétrocompat stricte). La série routée garde la PRIORITÉ.
  engagementsKeuroAn1?: number | null;
  // Marge facturable FIGÉE par le BP (feuille Inp_Opération, ligne « Dont Marge facturable »),
  // en k€. Non-null → désactive la boucle endogène `ajusteMargeFacturable` et impose cette valeur
  // (les k€ correspondants sont déjà inclus dans le CAPEX via `indemnitesImmoKeuro`, d'où 0 pour
  // ne pas les compter deux fois). Le cap gearing reste actif. null → boucle endogène inchangée
  // (rétrocompat stricte). Persisté en base : colonne Scenario.margeFactFigeeKeuro (Float?),
  // saisissable au formulaire (section template) — comme opexEngagementsKeuroByYear (String? JSON).
  margeFactFigeeKeuro?: number | null;
  // Marge facturable AMORTISSABLE (item 7) : part du MOD (« Dont Marge facturable », r32) déjà
  // incluse dans le CAPEX (via indemnitesImmoKeuro) mais que le BP amortit en Type 2 (C_D&A r21 :
  // MOD amorti = Coût du Dev + marge facturable). Ne modifie QUE la base D&A Type 2 — jamais le
  // CAPEX total ni le sizing (margeFactFigeeKeuro reste le champ sizing). null → base inchangée
  // (rétrocompat stricte). Persisté : colonne Scenario.margeFactAmortissableKeuro (Float?).
  margeFactAmortissableKeuro?: number | null;
  loyerMode?: string | null;
  loyerValeur?: number | null;
  loyerInflation?: number | null;
  inflationOM?: number | null;
  inflationMRA?: number | null;
  inflationBackOffice?: number | null;
  inflationDivers?: number | null;
  methodeTaxes?: string | null;
  // ─── MÉTHODE TF/CFE Phase 3 (tranche 4, §4.4 — sélecteur d'assiette AUTO + override §7.2) ──
  // prixAchatTerrainEuro (template J298) : prix d'achat du terrain en €. NON-null → active le
  // sélecteur Phase 3 : > 0 → assiette « comptable » ; sinon « appréciation directe » template
  // (terrain forfaitaire à 4 % — data/<N>.xlsm — là où la branche legacy, calée sur l'ancre
  // Sigoulès d'un millésime antérieur, reste à 8 %). null ET methodeAssiette null → branche
  // legacy STRICTEMENT inchangée (rétrocompat). La série routée tfKeuroByYear/cfeKeuroByYear
  // garde la PRIORITÉ ABSOLUE dans calculateOpexDetails.
  prixAchatTerrainEuro?: number | null;
  // Override manuel du sélecteur : "comptable" | "appreciation_directe" ; null → AUTO (règle
  // métier : achat de terrain → comptable). Rattrape les erreurs de saisie type Digoin
  // (terrain acheté 545 970 € mais BP resté en « Appréciation Directe »).
  methodeAssiette?: string | null;
  // Taux TFPB du département — compté EN PLUS du communal si ≠ 0 (libellé template r252),
  // frais de gestion 3 % comme les autres taxes principales. Décimal (0,05 = 5 %).
  tauxTFDepartement?: number | null;
  tauxTFCommune?: number | null;
  tauxTFEPCI?: number | null;
  tauxTSE?: number | null;
  tauxGEMAPI?: number | null;
  tauxTEOM?: number | null;
  tauxCFECommune?: number | null;
  tauxCFEEPCI?: number | null;
  tauxTSECfe?: number | null;
  tauxGEMAPICfe?: number | null;
  tauxCCI?: number | null;
  baseFonciereKeuro?: number | null;
  // Base foncière CALCULÉE (Fix 2) quand baseFonciereKeuro est absent : immo soumises =
  // fonciereBienEuroWc × puissance(Wc) + batimentsFonciersKeuro, puis + MOD retraité au prorata
  // foncier des immobilisations physiques (modRetraitementKeuro × immo/immobilisations).
  // Tous absents → fallback CAPEX × RATIO_PART_FONC_AD (comportement inchangé). baseFonciereKeuro
  // fourni → override (rétrocompat : Baugé le fournit, donc inchangé).
  fonciereBienEuroWc?: number | null;
  batimentsFonciersKeuro?: number | null;
  modRetraitementKeuro?: number | null;
  valeurTerrainKeuro?: number | null;
  prixTerrainHa?: number | null;
  abattTerrain?: number | null;
  inflationTaxes?: number | null;
  iferRate1?: number | null;
  iferRate2?: number | null;
  iferRpn?: number | null;
  inflationAurora?: number | null;
  // Index d'inflation des COURBES (merchant Aurora + certificat capacité) à l'an1 — série IMF
  // stockée du BP (base calendaire absolue), PAS un 1,02^n pur. Si fourni : index(y) =
  // curveIndexAn1 × (1+inflationAurora)^(year−1). Absent → comportement historique
  // (1+inflationAurora)^(calendarYear−2024). MES 2029 → curveIndexAn1 = 1,10245 (index 2029).
  curveIndexAn1?: number | null;
  aleasOpexRate?: number | null;
  ccaApportKeuro?: number | null;
  ccaRemunRate?: number | null;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  // "TRI projet" BRUT (non-levier / unlevered) calé sur le BP (C_P50 « rng_CF_TRI_Projet_Brut »
  // r383 → Inp_Assumption r53) : IRR des flux CFADS après IS P50 SANS service de dette, mise en
  // an0 = CAPEX projet hors frais de financement − montant MOD. Cf calcul dans
  // calculateScenarioMetrics. Reproduit le XIRR BP au centième.
  projectIrr: number;
  // "Investor IRR" BP : IRR de la mise SHL pure (ccaKeuro, sans devFees ni marge réintégrés
  // au dénominateur) + fluxActionnaire. Cf CALIBRATION.md, "DIAGNOSTIC FINAL TRI/VAN".
  investorIrr: number;
  // VAN de cette même série equity pure, actualisée à input.discountRate (avant réintégrations
  // additives D/E/F, qui restent à ajouter dans un fix ultérieur).
  investorNpv: number;
  lcoe: number;
  dscr: number | null;
  debtAmountKeuro: number | null;
  sizing: SizingResult | null;
  doubleIRR: DoubleIRR | null;
  sizingIterations: number;
  financingFeesKeuro: number;
  estimatedPltKeuro: number;
  financingFeesDetail: FinancingFeesDetail;
  contingencyKeuro: number;
  tfAnnuelleKeuro: number;
  cfeAnnuelleKeuro: number;
  iferKeuroAn1: number;
  iferKeuroAn21: number;
};

export type AnnualCashFlow = {
  year: number;
  annualTariff: number;
  productionP50Mwh: number;
  productionP90Mwh: number;
  revenueP50Keuro: number;
  // Revenu énergie PV PUR (hors certificat capacité / GO) — assiette de l'assurance (item 3).
  // Champ ADDITIF d'exposition : déjà calculé par le moteur (revenueP50), simplement forwardé.
  revenueP50PvKeuro: number;
  revenueP90Keuro: number;
  opexKeuro: number;
  cashFlowKeuro: number;
  discountedCashFlowKeuro: number;
  debtServiceKeuro: number;
  debtServiceSculptedKeuro: number | null;
  debtOutstandingKeuro: number;
  cfadsP90Keuro: number;
  cfadsP90AfterTaxKeuro: number;
  // Cas de dimensionnement (P90) — item 8 Phase 2 : IS du sizing déduit du CFADS de dette
  // (C_P90 r244), intérêts SHL propres au scénario P90 (r233), solde SHL P90 de fin d'année.
  isP90Keuro: number;
  intSHLP90Keuro: number;
  shlP90OutstandingKeuro: number;
  amort: number;
  vncKeuro: number;
  ebit: number;
  interets: number;
  ebt: number;
  is: number;
  resultatNet: number;
  cfadsAfterTax: number;
  dividende: number;
  fluxActionnaire: number;
  ccaRemboursementKeuro: number;
  ccaInteretsKeuro: number;
  ccaOutstandingKeuro: number;
  ccaBoPKeuro: number;
  ccaDrawdownKeuro: number;
  ccaCapitalizedInterestKeuro: number;
  ccaEoPKeuro: number;
  deficitCumuleKeuro: number;
  resultatCumuleKeuro: number;
  dsraSoldeKeuro: number;
  dsraDepotKeuro: number;
  dsraRetraitKeuro: number;
  cashBloqueKeuro: number;
  // Cash pooling (C_P50 r319) : cash equity résiduel après SHL NON distribuable (bénéfices cumulés
  // ≤ 0) — reste en trésorerie de la SPV (ni SHL, ni dividende). Item 10. = cashBloqueKeuro depuis
  // le retrait de la DSRA (le BP ne finance aucune réserve).
  cashPoolingKeuro: number;
  dscr: number | null;
  dscrRealized: number | null;
  dscrTargetAtYear: number | null;
};

export type CapexDetails = {
  hasDetailedCapex: boolean;
  modulesKeuro: number;
  modulesCtWc: number;
  boSKeuro: number;
  boSCtWc: number;
  raccordementKeuro: number;
  apportAffaireKeuro: number;
  devFeesKeuro: number;
  capexBeforeContingencyKeuro: number;
  contingencyKeuro: number;
  nbPanneaux: number;
  m2PV: number;
  taxeAmenagementKeuro: number;
  taxeArcheoKeuro: number;
  taxesFoncieresKeuro: number;
  indemnitesImmoKeuro: number;
  financingFeesKeuro: number;
  // Provision de démantèlement en année 0 (méthode Phase 3, timing « construction » UNIQUEMENT :
  // demantelementEuroMWc × MWc, poste No D&A). 0 en timing « fin_de_vie » (défaut) ou quand la
  // série routée r195 est présente (le BP porte alors le démantèlement en OPEX an25-29).
  demantelementProvisionKeuro: number;
  capexTotalKeuro: number;
  capexPerMwKeuro: number;
};

export type FinancingFeesDetail = {
  legalFees: number;
  technicalDD: number;
  arrangerFees: number;
  participantFees: number;
  bankFeesPLT: number;
  interimFinancing: number;
  commitmentFees: number;
};

export type FinancingFeesResult = {
  financingFeesKeuro: number;
  estimatedPltKeuro: number;
  financingFeesDetail: FinancingFeesDetail;
};

type FinancingFeesInput = Pick<
  FinanceEngineInput,
  | "capacityMw"
  | "gearingMaxPct"
  | "gearingMax"
  | "legalFeesKEuro"
  | "technicalDDKEuro"
  | "arrangerFeesRate"
  | "participantFeesRate"
  | "bankFeesPLTKEuroPerMW"
  | "interimFinancingRate"
  | "commitmentFeesRate"
  | "financingFeesKeuro"
> & { capexTotalKeuro: number };

export type OpexDetails = {
  hasDetailedOpex: boolean;
  omKeuro: number;
  mraKeuro: number;
  backOfficeKeuro: number;
  diversKeuro: number;
  loyerKeuro: number;
  assuranceKeuro: number;
  balancingKeuro: number;
  iferKeuro: number;
  baseTaxesKeuro: number;
  tfKeuro: number;
  cfeKeuro: number;
  aleasKeuro: number;
  demantelementKeuro: number;
  opexTotalKeuro: number;
  opexPerMwKeuro: number;
};

export type TaxesFoncieresOpexResult = {
  baseTaxesKeuro: number;
  tfAnnuelleKeuro: number;
  cfeAnnuelleKeuro: number;
  tfKeuro: number;
  cfeKeuro: number;
};

type PreRow = {
  year: number;
  annualTariff: number;
  productionP50Mwh: number;
  productionP90Mwh: number;
  revenueP50Keuro: number;
  // Revenu énergie PV pur (hors capacité/GO) — assiette assurance, forwardé vers AnnualCashFlow.
  revenueP50PvKeuro: number;
  revenueP90Keuro: number;
  opexKeuro: number;
  cashFlowKeuro: number;
  cfadsP90Keuro: number;
  debtServiceKeuro: number;
  standardDebtInterestKeuro: number;
  standardDebtOutstandingKeuro: number;
  amort: number;
  vncKeuro: number;
};

type AmortizationScheduleItem = {
  amort: number;
  vncKeuro: number;
};

type RetainedDebtScheduleItem = Pick<
  DebtScheduleItem,
  "principal" | "interest" | "outstanding"
>;

type SizingComputation = {
  sizing: SizingResult | null;
  scheduleByYear: Map<number, RetainedDebtScheduleItem>;
  annualCashFlows: AnnualCashFlow[];
  iterations: number;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function discounted(value: number, year: number, rate: number) {
  return value / (1 + rate) ** year;
}

function calculateNpvAtRate(initialInvestment: number, cashFlows: number[], rate: number) {
  return cashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, rate),
    -initialInvestment,
  );
}

function calculateIrr(initialInvestment: number, cashFlows: number[]) {
  if (initialInvestment <= 0 && cashFlows.some((cashFlow) => cashFlow > 0)) {
    return IRR_MAX_RATE;
  }

  let low = IRR_MIN_RATE;
  let high = 1;
  let lowNpv = calculateNpvAtRate(initialInvestment, cashFlows, low);
  let highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);

  while (highNpv > 0 && high < IRR_MAX_RATE) {
    high *= 2;
    highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);
  }

  if (lowNpv * highNpv > 0) {
    return 0;
  }

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const midNpv = calculateNpvAtRate(initialInvestment, cashFlows, mid);

    if (Math.abs(midNpv) < 0.000001) {
      return mid;
    }

    if (lowNpv * midNpv <= 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }

  return (low + high) / 2;
}

export function calculateDoubleIRR(
  t0Flows: T0Flows,
  _projectCashFlows: number[],
  equityCashFlows: number[],
): DoubleIRR {
  const projectInvestment = t0Flows.miseNetteInvest;
  const equityInvestment = t0Flows.miseNetteEntrep;
  const projectIrr = calculateIrr(projectInvestment, equityCashFlows) * 100;
  const equityIrr = calculateIrr(equityInvestment, equityCashFlows) * 100;
  const npvRate = asRate(6);
  const npvSPV = equityCashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, npvRate),
    -projectInvestment,
  );
  const npvEntreprise = equityCashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, npvRate),
    -equityInvestment,
  );

  return {
    irrInvest: round(projectIrr),
    irrEntreprise: round(equityIrr),
    npvSPV: round(npvSPV),
    npvEntreprise: round(npvEntreprise),
    miseNette: round(equityInvestment),
  };
}

function asRate(percent: number) {
  return percent / 100;
}

function calculateAnnualDebtService(
  initialDebt: number,
  debtInterestRate: number,
  debtMaturityYears: number,
) {
  if (initialDebt <= 0 || debtMaturityYears <= 0) {
    return 0;
  }

  // Debt is modeled as a constant annuity: same total debt service every year.
  if (debtInterestRate === 0) {
    return initialDebt / debtMaturityYears;
  }

  return (
    (initialDebt * debtInterestRate) /
    (1 - (1 + debtInterestRate) ** -debtMaturityYears)
  );
}

function buildStandardDebtSchedule(
  initialDebt: number,
  annualDebtService: number,
  debtInterestRate: number,
  debtMaturityYears: number,
) {
  const schedule = new Map<number, RetainedDebtScheduleItem>();
  let outstanding = initialDebt;

  for (let year = 1; year <= debtMaturityYears; year += 1) {
    const interest = outstanding * debtInterestRate;
    const principal = Math.min(Math.max(0, annualDebtService - interest), outstanding);
    outstanding -= principal;
    schedule.set(year, { principal, interest, outstanding });
  }

  return schedule;
}

// Returns the DSCR target for a given year from the schedule.
// Falls back to DSCR_FALLBACK (1.30) for years not covered by any tranche.
function dscrForYear(year: number, schedule: DscrTranche[]): number {
  return (
    schedule.find((t) => year >= t.yearFrom && year <= t.yearTo)?.dscrValue ??
    DSCR_FALLBACK
  );
}

// Resolves a non-empty DscrTranche[] from the input.
// Priority: dscrSchedule (if non-empty) > legacy dscrTarget scalar.
// Returns null when no sculpting is configured.
function resolveSchedule(input: FinanceEngineInput): DscrTranche[] | null {
  if (input.dscrSchedule != null && input.dscrSchedule.length > 0) {
    return input.dscrSchedule;
  }
  if (
    input.dscrTarget != null &&
    input.dscrTarget > 0 &&
    input.debtTenorYears != null &&
    input.debtTenorYears > 0
  ) {
    return [{ yearFrom: 1, yearTo: input.debtTenorYears, dscrValue: input.dscrTarget }];
  }
  return null;
}

function resolveGearingMaxPct(input: FinanceEngineInput) {
  return input.gearingMaxPct ?? input.gearingMax ?? null;
}

// Dégradation an N : courbe tabulée si fournie (garantie fabricant), sinon LINÉAIRE
// max(0, 1 − degradationRate × (year−1)) — conforme au template BP (production = initiale ×
// (1 − r×(y−1)), vérifié à l'euro : Sigoulès an21 = 16 156,8 × 0,92 = 14 864,26). Au-delà d'une
// courbe tabulée, extrapolation exponentielle depuis le dernier coefficient connu (inchangé).
function resolveDegradationFactor(
  degradationCurve: number[] | null | undefined,
  degradationRate: number,
  year: number,
) {
  if (degradationCurve != null && degradationCurve.length > 0) {
    if (year <= degradationCurve.length) {
      return degradationCurve[year - 1];
    }
    const lastCoef = degradationCurve[degradationCurve.length - 1];
    return lastCoef * (1 - degradationRate) ** (year - degradationCurve.length);
  }
  return Math.max(0, 1 - degradationRate * (year - 1));
}

function resolveConstructionYears(input: Pick<FinanceEngineInput, "constructionYears">) {
  return Math.max(0, Math.trunc(input.constructionYears ?? CONSTRUCTION_YEARS_FALLBACK));
}

function buildAuroraCurveByYear(input: FinanceEngineInput) {
  return new Map(
    input.auroraCurves?.map((curve) => [
      curve.year,
      {
        high: curve.high,
        central: curve.central,
        low: curve.low,
      },
    ]) ?? [],
  );
}

function resolveMerchantPrices(
  input: FinanceEngineInput,
  auroraCurveByYear: Map<number, { high: number; central: number; low: number }>,
  projectYear: number,
) {
  const hasCalendarYears = input.commissioningYear != null && input.commissioningYear > 0;
  const calendarYear = hasCalendarYears
    ? input.commissioningYear! + projectYear - 1
    : projectYear;
  const auroraCurve = auroraCurveByYear.get(calendarYear);
  const inflationRate = asRate(input.inflationAurora ?? INFLATION_AURORA_FALLBACK);
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const inflFactor =
    input.curveIndexAn1 != null
      ? input.curveIndexAn1 * (1 + inflationRate) ** (projectYear - 1)
      : hasCalendarYears
        ? (1 + inflationRate) ** (calendarYear - 2024)
        : (1 + inflationRate) ** Math.max(0, projectYear - contractDuration);

  if (!auroraCurve) {
    if (auroraCurveByYear.size === 0) {
      return { investorPrice: 0, debtSizingPrice: 0 };
    }

    const lastYear = Math.max(...auroraCurveByYear.keys());
    const lastCurve = auroraCurveByYear.get(lastYear)!;
    return {
      investorPrice: lastCurve.central * (input.investorCurveW ?? 1) * inflFactor,
      debtSizingPrice:
        (lastCurve.central * (input.debtSizingCentralW ?? 0.7) +
          lastCurve.low * (input.debtSizingLowW ?? 0.3)) *
        inflFactor,
    };
  }

  return {
    investorPrice: auroraCurve.central * (input.investorCurveW ?? 1) * inflFactor,
    debtSizingPrice:
      (auroraCurve.central * (input.debtSizingCentralW ?? 0.7) +
        auroraCurve.low * (input.debtSizingLowW ?? 0.3)) *
      inflFactor,
  };
}

function hasDetailedCapexInput(input: FinanceEngineInput) {
  return (
    input.surfaceHa != null ||
    input.prixModuleUSDWc != null ||
    input.boSCtWc != null ||
    input.raccordementOuvrageKEuro != null ||
    input.tarifQPKEuroPerMW != null ||
    input.apportAffaireMode != null ||
    input.apportAffaireValeur != null ||
    input.contingencyRate != null ||
    input.longueurModule != null ||
    input.largeurModule != null ||
    input.txAmenagementRate != null ||
    input.coefArcheo != null
  );
}

function hasDetailedOpexInput(input: FinanceEngineInput) {
  return (
    input.omFixedEuroKwc != null ||
    input.mraEuroKwc != null ||
    input.mraKeuroByYear != null ||
    input.mraProfil != null ||
    input.backOfficeKeuro != null ||
    input.diversOpexKeuro != null ||
    input.loyerMode != null ||
    input.loyerValeur != null ||
    input.loyerInflation != null ||
    input.inflationOM != null ||
    input.inflationMRA != null ||
    input.inflationBackOffice != null ||
    input.inflationDivers != null ||
    input.methodeTaxes != null ||
    input.prixAchatTerrainEuro != null ||
    input.methodeAssiette != null ||
    input.tauxTFDepartement != null ||
    input.tauxTFCommune != null ||
    input.tauxTFEPCI != null ||
    input.tauxTSE != null ||
    input.tauxGEMAPI != null ||
    input.tauxTEOM != null ||
    input.tauxCFECommune != null ||
    input.tauxCFEEPCI != null ||
    input.tauxCCI != null ||
    input.prixTerrainHa != null ||
    input.abattTerrain != null ||
    input.inflationTaxes != null ||
    input.iferRate1 != null ||
    input.iferRate2 != null ||
    input.iferRpn != null
  );
}

function taxeLocale(baseEuro: number, taux: number[], frais: readonly number[]) {
  const composantes = taux.map((tauxValue) => tauxValue / 100 * baseEuro);
  const fraisGestion = composantes.reduce(
    (total, composante, index) => total + composante * (frais[index] ?? 0),
    0,
  );

  return composantes.reduce((total, composante) => total + composante, 0) + fraisGestion;
}

function calculateIferKeuro(input: FinanceEngineInput, year: number) {
  const rpn = input.iferRpn ?? IFER_RPN_FALLBACK;
  const puissanceInjectee = rpn > 0 ? input.capacityMw / rpn : 0;
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const iferRate =
    year <= contractDuration
      ? input.iferRate1 ?? IFER_RATE_1_FALLBACK
      : input.iferRate2 ?? IFER_RATE_2_FALLBACK;

  return puissanceInjectee * iferRate;
}

// Base foncière passible (€) calculée depuis les données brutes (Fix 2, cf BP §3.02) :
//   immo soumises = fonciereBienEuroWc × puissance(Wc) + batimentsFonciersKeuro
//   MOD retraité  = (immo soumises / immobilisations physiques) × frais MOD
//   base passible = immo soumises + MOD retraité
// "Immobilisations physiques" = construction (modules + BoS + contingency) + raccordement +
// apport affaire (hors dev fees, financing fees, indemnités, taxes) — le dénominateur du prorata
// foncier du BP. Appel à calculateCapexDetails sûr (pas de récursion : capexDetails n'appelle
// pas les taxes foncières).
function computeBaseFonciereEuro(input: FinanceEngineInput): number {
  const immoSoumisesEuro =
    (input.fonciereBienEuroWc ?? 0) * input.capacityMw * 1_000_000 +
    (input.batimentsFonciersKeuro ?? 0) * 1000;
  const capex = calculateCapexDetails(input);
  const immobilisationsEuro =
    (capex.modulesKeuro + capex.boSKeuro + capex.contingencyKeuro +
      capex.raccordementKeuro + capex.apportAffaireKeuro) * 1000;
  const modRetraiteEuro =
    immobilisationsEuro > 0
      ? (immoSoumisesEuro / immobilisationsEuro) * (input.modRetraitementKeuro ?? 0) * 1000
      : 0;
  return immoSoumisesEuro + modRetraiteEuro;
}

/**
 * MÉTHODE TF/CFE Phase 3 (tranche 4 — docs/PHASE3_METHODES.md §4.4). Formules du template BP
 * (feuille Inp_Matrice_O&M_Taxes) vérifiées AU CENTIME sur data/4 (Baugé, directe), data/21
 * (Sigoulès, directe) et data/20 (Selles, comptable) — scripts/_audit_phase3_taxes.ts :
 *   • SÉLECTEUR (§7.2) : override `methodeAssiette` s'il est non-null ; sinon AUTO — règle
 *     métier « achat de terrain → comptable » : prixAchatTerrainEuro > 0 → « comptable »,
 *     sinon « appréciation directe ». (Le BP de Digoin viole cette règle par ERREUR de saisie
 *     → mismatch ATTENDU sur sa validation ; son routing r191/r192 reste prioritaire.)
 *   • Assiette DIRECTE (J354) = biens passibles hors terrain (J342) × 8 % × (1−50 %)
 *     + valeur vénale terrain (ha × 5 000 €, J348) × 4 % × 0,256066 × (1−50 %).
 *     ⚠️ terrain au taux LF SIMPLE 4 % (J349) — la branche legacy (ancre Sigoulès, millésime
 *     de template antérieur) reste à 8 % : c'est pour ça que cette branche est distincte.
 *   • Assiette COMPTABLE : base (J302) = prix d'achat terrain + immos non exonérées + MOD
 *     retraité (les MÊMES composants « biens passibles » que la directe) ;
 *     assiette TF (J304) = base × 4 % × (1−50 %) ; assiette CFE (J323) = base × 4 % × (1−30 %).
 *   • TF = assiette_TF × Σ(taux_i × (1+frais_i)) — frais 3 % principales (commune + département
 *     + EPCI + GEMAPI), 9 % TSE, 8 % TEOM (formule J312/J362).
 *   • CFE directe : s'applique sur la MÊME assiette que la TF (J354), frais 3 % principales /
 *     9 % TSE+CCI (J394). CFE comptable : assiette CFE × Σ taux SANS frais proportionnels
 *     + 134,8827 € EN DUR (J331, artefact template — appliqué seulement si Σ taux CFE > 0).
 *   • Indexation 2 %/an dès l'an 2 (inflationTaxes ?? 2 — le défaut BP, pas le 0,4 legacy).
 * Taux en DÉCIMAL (0,3835 = 38,35 %). Taux null → la composante ne contribue pas (§7.3 :
 * placeholders UI par défaut, PAS de dérivation « nationale » imposée).
 */
function calculateTaxesMethodeAssiette(
  input: FinanceEngineInput,
  capexTotalEuro: number,
  year: number,
): TaxesFoncieresOpexResult {
  const methode =
    input.methodeAssiette ??
    ((input.prixAchatTerrainEuro ?? 0) > 0 ? "comptable" : "appreciation_directe");
  const inflationFactor = (1 + asRate(input.inflationTaxes ?? 2)) ** (year - 1);

  // Biens passibles HORS terrain (€) — même résolution que la branche directe Phase 2 :
  // override baseFonciereKeuro, sinon calcul €/Wc (Fix 2), sinon fallback 2,93 % du CAPEX.
  const baseFonciereEuro =
    input.baseFonciereKeuro != null
      ? input.baseFonciereKeuro * 1000
      : input.fonciereBienEuroWc != null || input.batimentsFonciersKeuro != null
        ? computeBaseFonciereEuro(input)
        : capexTotalEuro * RATIO_PART_FONC_AD;

  let assietteTfEuro: number;
  let assietteCfeEuro: number;
  if (methode === "comptable") {
    const baseComptableEuro = (input.prixAchatTerrainEuro ?? 0) + baseFonciereEuro; // J302
    assietteTfEuro = baseComptableEuro * TAUX_LF_COMPTA * (1 - ABATT_AD); // J304
    assietteCfeEuro = baseComptableEuro * TAUX_LF_COMPTA * (1 - ABATT_IMMO); // J323
  } else {
    const valeurTerrainEuro =
      input.valeurTerrainKeuro != null
        ? input.valeurTerrainKeuro * 1000
        : (input.surfaceHa ?? 0) * (input.prixTerrainHa ?? VALEUR_VENALE_HA_AD); // J348
    assietteTfEuro =
      baseFonciereEuro * TAUX_LF_AD * (1 - ABATT_AD) + // J344
      valeurTerrainEuro * TAUX_LF_COMPTA * COEF_NEUTRAL_AD * (1 - ABATT_AD); // J352 (4 % !)
    // ⚠️ La CFE directe s'applique sur la MÊME assiette que la TF (J354) — le template calcule
    // une assiette CFE dédiée (J386) mais ne l'utilise pas (cf CALIBRATION.md Règle 6, acquis 2).
    assietteCfeEuro = assietteTfEuro;
  }

  const tauxTfPrincipales =
    (input.tauxTFCommune ?? 0) +
    (input.tauxTFDepartement ?? 0) +
    (input.tauxTFEPCI ?? 0) +
    (input.tauxGEMAPI ?? 0);
  const tfEuro =
    assietteTfEuro *
    (tauxTfPrincipales * (1 + FRAIS_GESTION_PRINCIPALES) +
      (input.tauxTSE ?? 0) * (1 + FRAIS_GESTION_TSE_CCI) +
      (input.tauxTEOM ?? 0) * (1 + FRAIS_GESTION_TEOM));

  let cfeEuro: number;
  if (methode === "comptable") {
    const sommeTauxCfe =
      (input.tauxCFECommune ?? 0) +
      (input.tauxCFEEPCI ?? 0) +
      (input.tauxTSECfe ?? 0) +
      (input.tauxGEMAPICfe ?? 0) +
      (input.tauxCCI ?? 0);
    cfeEuro =
      assietteCfeEuro * sommeTauxCfe +
      (sommeTauxCfe > 0 ? CFE_COMPTABLE_FRAIS_GESTION_EURO : 0);
  } else {
    cfeEuro =
      assietteCfeEuro *
      (((input.tauxCFECommune ?? 0) + (input.tauxCFEEPCI ?? 0) + (input.tauxGEMAPICfe ?? 0)) *
        (1 + FRAIS_GESTION_PRINCIPALES) +
        ((input.tauxTSECfe ?? 0) + (input.tauxCCI ?? 0)) * (1 + FRAIS_GESTION_TSE_CCI));
  }

  const tfAnnuelleKeuro = tfEuro / 1000;
  const cfeAnnuelleKeuro = cfeEuro / 1000;
  return {
    baseTaxesKeuro: assietteTfEuro / 1000,
    tfAnnuelleKeuro,
    cfeAnnuelleKeuro,
    tfKeuro: tfAnnuelleKeuro * inflationFactor,
    cfeKeuro: cfeAnnuelleKeuro * inflationFactor,
  };
}

export function calculateTaxesFoncieres(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  year = 1,
): TaxesFoncieresOpexResult {
  const capexTotalEuro = capexTotalKeuro * 1000;

  // MÉTHODE Phase 3 (tranche 4) : dès qu'un des nouveaux champs est renseigné (prix d'achat
  // terrain, même à 0, ou override de méthode), le sélecteur d'assiette AUTO + les formules
  // template prennent le relais. Tous null → branches legacy STRICTEMENT inchangées.
  if (input.methodeAssiette != null || input.prixAchatTerrainEuro != null) {
    return calculateTaxesMethodeAssiette(input, capexTotalEuro, year);
  }

  const methode = input.methodeTaxes ?? METHODE_TAXES_FALLBACK;
  const inflationFactor = (1 + asRate(input.inflationTaxes ?? 0.4)) ** (year - 1);

  if (methode === "appreciation_directe") {
    // Base foncière passible (€) — override direct, sinon calcul depuis €/Wc (Fix 2),
    // sinon fallback 2.93% du CAPEX (comportement historique).
    const baseFonciereEuro =
      input.baseFonciereKeuro != null
        ? input.baseFonciereKeuro * 1000
        : input.fonciereBienEuroWc != null || input.batimentsFonciersKeuro != null
          ? computeBaseFonciereEuro(input)
          : capexTotalEuro * RATIO_PART_FONC_AD;
    // Valeur terrain (€) — input direct ou fallback surface × 5000 €/ha
    const valeurTerrainEuro =
      input.valeurTerrainKeuro != null
        ? input.valeurTerrainKeuro * 1000
        : (input.surfaceHa ?? 0) * VALEUR_VENALE_HA_AD;

    // Base cadastrale commune TF et CFE (Règle 6 — base TFPB confirmée = 7 498 €)
    const revCadCentrale = baseFonciereEuro * TAUX_LF_AD * (1 - ABATT_AD);
    const revCadTerrain  = valeurTerrainEuro * TAUX_LF_AD * COEF_NEUTRAL_AD * (1 - ABATT_AD);
    const baseCadEuro    = revCadCentrale + revCadTerrain;

    // Taux appliqués en décimal (0.3069 = 30.69% — pas de /100). Frais de gestion CALCULÉS
    // par composante : 3% sur les taxes principales, 9% sur TSE/CCI (cf FRAIS_GESTION_*).
    const partPrincipalesTF =
      baseCadEuro *
      ((input.tauxTFCommune ?? 0) + (input.tauxTFEPCI ?? 0) +
        (input.tauxGEMAPI ?? 0) + (input.tauxTEOM ?? 0));
    const partTseTF = baseCadEuro * (input.tauxTSE ?? 0);
    const fraisTF =
      partPrincipalesTF * FRAIS_GESTION_PRINCIPALES + partTseTF * FRAIS_GESTION_TSE_CCI;
    const tfAnnuelleKeuro = (partPrincipalesTF + partTseTF + fraisTF) / 1000;

    const partPrincipalesCFE =
      baseCadEuro *
      ((input.tauxCFECommune ?? 0) + (input.tauxCFEEPCI ?? 0) + (input.tauxGEMAPICfe ?? 0));
    const partTseCciCFE = baseCadEuro * ((input.tauxTSECfe ?? 0) + (input.tauxCCI ?? 0));
    const fraisCFE =
      partPrincipalesCFE * FRAIS_GESTION_PRINCIPALES + partTseCciCFE * FRAIS_GESTION_TSE_CCI;
    const cfeAnnuelleKeuro = (partPrincipalesCFE + partTseCciCFE + fraisCFE) / 1000;

    return {
      baseTaxesKeuro: baseCadEuro / 1000,
      tfAnnuelleKeuro,
      cfeAnnuelleKeuro,
      tfKeuro:  tfAnnuelleKeuro  * inflationFactor,
      cfeKeuro: cfeAnnuelleKeuro * inflationFactor,
    };
  }

  // Chemin "comptable" — inchangé (Sigoulès)
  const baseTaxesEuro =
    methode === "comptable"
      ? capexTotalEuro * TAUX_LF_COMPTA * (1 - ABATT_IMMO)
      : capexTotalEuro * TAUX_LF_AD * (1 - ABATT_IMMO) +
        (input.surfaceHa ?? 0) *
          (input.prixTerrainHa ?? 5000) *
          TAUX_LF_AD *
          COEF_NEUTRAL *
          (1 - (input.abattTerrain ?? 0) / 100);
  const tauxTF = [
    input.tauxTFCommune,
    input.tauxTFEPCI,
    input.tauxTSE,
    input.tauxGEMAPI,
    input.tauxTEOM,
  ].map((taux) => taux ?? 0);
  const tauxCFE = [
    input.tauxCFECommune,
    input.tauxCFEEPCI,
    input.tauxGEMAPI,
    input.tauxCCI,
  ].map((taux) => taux ?? 0);
  const tfAnnuelleKeuro  = taxeLocale(baseTaxesEuro, tauxTF,  FRAIS_TF)  / 1000;
  const cfeAnnuelleKeuro = taxeLocale(baseTaxesEuro, tauxCFE, FRAIS_CFE) / 1000;

  return {
    baseTaxesKeuro: baseTaxesEuro / 1000,
    tfAnnuelleKeuro,
    cfeAnnuelleKeuro,
    tfKeuro:  tfAnnuelleKeuro  * inflationFactor,
    cfeKeuro: cfeAnnuelleKeuro * inflationFactor,
  };
}

export function calculateCapexDetails(input: FinanceEngineInput): CapexDetails {
  const hasDetailedCapex = hasDetailedCapexInput(input);
  const legacyCapexTotal = input.capex * input.capacityMw;
  // Méthode Phase 3, timing « construction » : le démantèlement est provisionné en année 0
  // (poste No D&A du CAPEX, non amorti — comme financingFeesKeuro/indemnitesImmoKeuro) au lieu
  // d'être étalé en OPEX an25-29. Inactif (0) en timing « fin_de_vie » (défaut) ou quand la
  // série routée r195 existe (rétrocompat stricte : aucun scénario existant n'a ce timing).
  const demantelementProvisionKeuro =
    (input.demantelementTiming ?? "fin_de_vie") === "construction" &&
    !input.demantelementKeuroByYear?.length
      ? ((input.demantelementEuroMWc ?? DEMANTELEMENT_EURO_MWC_FALLBACK) * input.capacityMw) /
        1000
      : 0;

  if (!hasDetailedCapex) {
    // L'override « valeur appliquée BP » est porté dans le CAPEX total AUSSI en mode legacy :
    // il neutralise calculateFinancingFees → sans cet ajout, les fees disparaîtraient du CAPEX.
    // null → 0 → total legacy strictement inchangé (rétrocompat).
    const legacyFinancingFeesKeuro = input.financingFeesKeuro ?? 0;
    const legacyTotalKeuro =
      legacyCapexTotal + legacyFinancingFeesKeuro + demantelementProvisionKeuro;
    return {
      hasDetailedCapex,
      modulesKeuro: 0,
      modulesCtWc: 0,
      boSKeuro: 0,
      boSCtWc: 0,
      raccordementKeuro: 0,
      apportAffaireKeuro: 0,
      devFeesKeuro: 0,
      capexBeforeContingencyKeuro: legacyCapexTotal,
      contingencyKeuro: 0,
      nbPanneaux: 0,
      m2PV: 0,
      taxeAmenagementKeuro: 0,
      taxeArcheoKeuro: 0,
      taxesFoncieresKeuro: 0,
      indemnitesImmoKeuro: 0,
      financingFeesKeuro: legacyFinancingFeesKeuro,
      demantelementProvisionKeuro,
      capexTotalKeuro: legacyTotalKeuro,
      capexPerMwKeuro: input.capacityMw > 0 ? legacyTotalKeuro / input.capacityMw : 0,
    };
  }

  const tauxEURUSD = input.tauxEURUSD ?? TAUX_EUR_USD_FALLBACK;
  const modulePriceEurWc =
    input.prixModuleUSDWc != null && tauxEURUSD > 0
      ? input.prixModuleUSDWc / tauxEURUSD
      : 0;
  const modulesKeuro = modulePriceEurWc * input.capacityMw * 1_000_000 / 1000;
  const modulesCtWc =
    input.capacityMw > 0 ? modulesKeuro / (input.capacityMw * 1000) * 100 : 0;
  const boSKeuro = ((input.boSCtWc ?? 0) / 100) * input.capacityMw * 1000;
  const raccordQpKeuro = (input.capacityMw / 1.35) * (input.tarifQPKEuroPerMW ?? 0);
  const raccordementKeuro = (input.raccordementOuvrageKEuro ?? 0) + raccordQpKeuro;
  const apportAffaireValeur = input.apportAffaireValeur ?? 0;
  const apportAffaireKeuro =
    input.apportAffaireMode === "fixe"
      ? apportAffaireValeur
      : input.apportAffaireMode === "euroParMWc"
        ? apportAffaireValeur * input.capacityMw
        : input.apportAffaireMode === "euroParHa"
          ? apportAffaireValeur * (input.surfaceHa ?? 0)
          : 0;
  const devFeesKeuro = (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const capexBeforeContingencyKeuro =
    modulesKeuro + boSKeuro + raccordementKeuro + apportAffaireKeuro + devFeesKeuro;
  const contingencyKeuro = boSKeuro * (input.contingencyRate ?? 2) / 100;
  const nbPanneaux = (input.capacityMw * 1_000_000) / 650;
  const m2PV = nbPanneaux * (input.longueurModule ?? 2.382) * (input.largeurModule ?? 1.134);
  const taxeAmenagementEuro =
    (10 * m2PV + 21 * input.capacityMw * 930) *
    (input.txAmenagementRate ?? 4.5) /
    100;
  const taxeArcheoEuro = (input.coefArcheo ?? 0.71) * m2PV;
  const taxeAmenagementKeuro = taxeAmenagementEuro / 1000;
  const taxeArcheoKeuro = taxeArcheoEuro / 1000;
  const taxesFoncieresKeuro = taxeAmenagementKeuro + taxeArcheoKeuro;
  const indemnitesImmoKeuro = input.indemnitesImmoKeuro ?? 0;
  const financingFeesKeuro = input.financingFeesKeuro ?? 0;
  const capexTotalKeuro =
    capexBeforeContingencyKeuro + contingencyKeuro + taxesFoncieresKeuro
    + indemnitesImmoKeuro + financingFeesKeuro + demantelementProvisionKeuro;

  return {
    hasDetailedCapex,
    modulesKeuro,
    modulesCtWc,
    boSKeuro,
    boSCtWc: input.boSCtWc ?? 0,
    raccordementKeuro,
    apportAffaireKeuro,
    devFeesKeuro,
    capexBeforeContingencyKeuro,
    contingencyKeuro,
    nbPanneaux,
    m2PV,
    taxeAmenagementKeuro,
    taxeArcheoKeuro,
    taxesFoncieresKeuro,
    indemnitesImmoKeuro,
    financingFeesKeuro,
    demantelementProvisionKeuro,
    capexTotalKeuro,
    capexPerMwKeuro: input.capacityMw > 0 ? capexTotalKeuro / input.capacityMw : 0,
  };
}

function resolveBaseCapexKeuro(input: FinanceEngineInput) {
  return input.capex > 0
    ? input.capex * input.capacityMw
    : calculateCapexDetails(input).capexTotalKeuro;
}

function hasFinancingFeesInput(input: FinancingFeesInput) {
  return (
    input.legalFeesKEuro != null ||
    input.technicalDDKEuro != null ||
    input.arrangerFeesRate != null ||
    input.participantFeesRate != null ||
    input.bankFeesPLTKEuroPerMW != null ||
    input.interimFinancingRate != null ||
    input.commitmentFeesRate != null
  );
}

export function calculateFinancingFees(
  input: FinancingFeesInput,
): FinancingFeesResult {
  // Override « valeur appliquée BP » (input.financingFeesKeuro, Inp_Assumption r548) : les fees
  // sont DÉJÀ portés dans le CAPEX total (calculateCapexDetails, poste No D&A) → le recalcul par
  // taux 7 composants est NEUTRALISÉ ici (sinon double comptage dans initialInvestment =
  // capexTotalKeuro + financingFeesKeuro). null → recalcul par taux inchangé (rétrocompat stricte).
  if (input.financingFeesKeuro != null || !hasFinancingFeesInput(input)) {
    return {
      financingFeesKeuro: 0,
      estimatedPltKeuro: 0,
      financingFeesDetail: {
        legalFees: 0,
        technicalDD: 0,
        arrangerFees: 0,
        participantFees: 0,
        bankFeesPLT: 0,
        interimFinancing: 0,
        commitmentFees: 0,
      },
    };
  }

  const gearingMaxPct = input.gearingMaxPct ?? input.gearingMax ?? 95;
  const estimatedPltKeuro = input.capexTotalKeuro * 1.04 * gearingMaxPct / 100;
  const financingFeesDetail = {
    legalFees: input.legalFeesKEuro ?? 10,
    technicalDD: input.technicalDDKEuro ?? 5,
    arrangerFees: estimatedPltKeuro * (input.arrangerFeesRate ?? 0.8) / 100,
    participantFees: estimatedPltKeuro * (input.participantFeesRate ?? 0.4) / 100,
    bankFeesPLT: (input.bankFeesPLTKEuroPerMW ?? 1.5) * input.capacityMw,
    interimFinancing: estimatedPltKeuro * (input.interimFinancingRate ?? 2.5) / 100,
    commitmentFees: estimatedPltKeuro * (input.commitmentFeesRate ?? 0.1) / 100,
  };
  const financingFeesKeuro = Object.values(financingFeesDetail).reduce(
    (total, value) => total + value,
    0,
  );

  return {
    financingFeesKeuro,
    estimatedPltKeuro,
    financingFeesDetail,
  };
}

/**
 * MÉTHODE démantèlement (Phase 3, fallback quand la série routée r195 est absente) : coût total
 * = demantelementEuroMWc (défaut 10 000 €/MWc — valeur exacte des 25 BP) × MWc.
 *   • timing « fin_de_vie » (défaut) : étalé également sur an25-29, NON indexé — reproduit r195
 *     au centime (validé scripts/_audit_phase3_methode.ts sur les 25 projets).
 *   • timing « construction » : provisionné en année 0 (poste CAPEX No D&A, cf
 *     calculateCapexDetails) → 0 en OPEX d'exploitation ici.
 * Le flag exploitation est implicite (la fonction n'est appelée que pour year ∈ [1, vie]).
 */
function resolveDemantelementMethodeKeuro(
  input: Pick<
    FinanceEngineInput,
    "capacityMw" | "demantelementEuroMWc" | "demantelementTiming"
  >,
  year: number,
): number {
  const timing = input.demantelementTiming ?? "fin_de_vie";
  if (timing !== "fin_de_vie") return 0;
  if (year < DEMANTELEMENT_YEAR_FROM || year > DEMANTELEMENT_YEAR_TO) return 0;
  const totalKeuro =
    ((input.demantelementEuroMWc ?? DEMANTELEMENT_EURO_MWC_FALLBACK) * input.capacityMw) / 1000;
  return totalKeuro / (DEMANTELEMENT_YEAR_TO - DEMANTELEMENT_YEAR_FROM + 1);
}

export function calculateOpexDetails(
  input: FinanceEngineInput,
  year: number,
  revenueP50Keuro: number,
  productionP50Mwh: number,
  baseCapexKeuro?: number,
  revenueP50PvKeuro?: number,
  // Base aléas an1 figée (0.5% × revenu total an1), fournie par l'appelant pour year > 1 —
  // cf docs/CALIBRATION.md Règle 2 : aléas P50 = base an1 × 1.02^(year-1), comme le P90,
  // PAS 0.5% du revenu courant. Absente → recalculée sur revenueP50Keuro (cas year=1).
  aleasBaseKeuro?: number,
): OpexDetails {
  const assuranceRate = asRate(input.assuranceRate ?? ASSURANCE_RATE_FALLBACK);
  const inflationAssuranceRate = asRate(
    input.inflationAssurance ?? INFLATION_ASSURANCE_FALLBACK,
  );
  const inflationOMRate = asRate(input.inflationOM ?? INFLATION_OM_FALLBACK);
  const balancingCost = input.balancingCost ?? BALANCING_COST_FALLBACK;
  const assuranceBase = revenueP50PvKeuro ?? revenueP50Keuro;
  // P50 assurance = taux × revenu PV courant × 1.02^(year-1) (fichier C_P50 exact — cf
  // docs/CALIBRATION.md Règle 2 : le facteur d'inflation existe bien, à 2%, pas 3% ni 0%).
  const assuranceKeuro =
    assuranceRate * assuranceBase * (1 + inflationAssuranceRate) ** (year - 1);
  const balancingKeuro = (balancingCost * productionP50Mwh) / 1000 * (1 + inflationOMRate) ** (year - 1);
  // IFER P50 = même formule que P90 (indexation ^(year-1), même saut taux1→taux2 à an21) —
  // ce n'est PAS flat, cf docs/CALIBRATION.md Règle 2 (fichier c_p50.xlsx, valeurs exactes).
  const iferKeuro = calculateIferKeuro(input, year) * (1 + inflationOMRate) ** (year - 1);
  const hasDetailedOpex = hasDetailedOpexInput(input);
  const taxesLocales = calculateTaxesFoncieres(
    input,
    baseCapexKeuro ?? resolveBaseCapexKeuro(input),
    year,
  );
  // Item 4 : TF/CFE RÉELLEMENT APPLIQUÉES par le BP (C_P50 r191/r192), routées par projet quand
  // disponibles. La MÉTHODE d'assiette du BP varie par site (« comptable seule si achat terrain »
  // — ex. Selles/Villognon — sinon « appréciation directe » — ex. Baugé), avec un facteur ~2,5×
  // entre les deux ; la série appliquée est le ground truth exact, insensible à ce choix. Absent
  // (aucun data/N.xlsm) → base calculée par calculateTaxesFoncieres (rétrocompat stricte).
  const tfKeuro = input.tfKeuroByYear?.[year - 1] ?? taxesLocales.tfKeuro;
  const cfeKeuro = input.cfeKeuroByYear?.[year - 1] ?? taxesLocales.cfeKeuro;

  // Aléas P50 = base an1 FIGÉE × 1.02^(year-1) (fichier c_p50.xlsx exact), pas 0.5% du revenu
  // courant — même mécanique que l'aléas P90 (base an1 figée). an1 : les deux formules
  // coïncident puisque ^0=1, d'où aleasBaseKeuro absent au premier appel.
  const aleasKeuro =
    aleasBaseKeuro != null
      ? aleasBaseKeuro * (1 + inflationOMRate) ** (year - 1)
      : asRate(input.aleasOpexRate ?? 0.5) * revenueP50Keuro;

  // Item 2 : démantèlement appliqué par le BP (C_P50/C_P90 r195) — an25-29 uniquement, constant
  // non indexé. Piloté par la série (0 hors an25-29). Série absente → MÉTHODE Phase 3
  // (demantelementEuroMWc × MWc étalé an25-29, cf resolveDemantelementMethodeKeuro).
  const demantelementKeuro = input.demantelementKeuroByYear?.length
    ? input.demantelementKeuroByYear[year - 1] ?? 0
    : resolveDemantelementMethodeKeuro(input, year);

  if (!hasDetailedOpex) {
    const legacyOpexKeuro =
      input.opex * input.capacityMw * (1 + asRate(input.opexInflationRate)) ** year;
    const opexTotalKeuro =
      legacyOpexKeuro +
      assuranceKeuro +
      balancingKeuro +
      iferKeuro +
      tfKeuro +
      cfeKeuro +
      aleasKeuro +
      demantelementKeuro;

    return {
      hasDetailedOpex,
      omKeuro: 0,
      mraKeuro: 0,
      backOfficeKeuro: 0,
      diversKeuro: legacyOpexKeuro,
      loyerKeuro: 0,
      assuranceKeuro,
      balancingKeuro,
      iferKeuro,
      baseTaxesKeuro: taxesLocales.baseTaxesKeuro,
      tfKeuro,
      cfeKeuro,
      aleasKeuro,
      demantelementKeuro,
      opexTotalKeuro,
      opexPerMwKeuro: input.capacityMw > 0 ? opexTotalKeuro / input.capacityMw : 0,
    };
  }

  const omKeuro =
    (input.omFixedEuroKwc ?? OM_FIXED_EURO_KWC_FALLBACK) *
    input.capacityMw *
    (1 + asRate(input.inflationOM ?? INFLATION_OM_FALLBACK)) ** (year - 1);
  // Item 6 : MRA appliquée par le BP (C_P50 r189, paliers onduleurs déjà indexés 2 %/an) quand
  // routée par projet ; sinon MÉTHODE Phase 3 : mraEuroKwc (moyenne 35 ans) × kWc ×
  // ratio_palier(y) × 1,02^(y−1) — profil « paliers » par défaut (forme universelle des BP),
  // « plat » (ratio 1) pour les rares sites type Mur-de-Sologne. Le flag exploitation est
  // implicite (year ∈ [1, vie]).
  const mraKeuro = input.mraKeuroByYear?.length
    ? input.mraKeuroByYear[year - 1] ?? 0
    : (input.mraEuroKwc ?? MRA_EURO_KWC_FALLBACK) *
      input.capacityMw *
      ((input.mraProfil ?? "paliers") === "plat" ? 1 : mraPalierRatio(year)) *
      (1 + asRate(input.inflationMRA ?? INFLATION_MRA_FALLBACK)) ** (year - 1);
  const backOfficeKeuro =
    (input.backOfficeKeuro ?? BACK_OFFICE_KEURO_FALLBACK) *
    (1 + asRate(input.inflationBackOffice ?? INFLATION_BACK_OFFICE_FALLBACK)) ** (year - 1);
  const diversKeuro =
    (input.diversOpexKeuro ?? DIVERS_OPEX_KEURO_FALLBACK) *
    (1 + asRate(input.inflationDivers ?? INFLATION_DIVERS_FALLBACK)) ** (year - 1);
  const loyerValeur = input.loyerValeur ?? 0;
  const loyerBaseKeuro =
    input.loyerMode === "fixe"
      ? loyerValeur
      : input.loyerMode === "euroParHa"
        ? loyerValeur * (input.surfaceHa ?? 0) / 1000
        : input.loyerMode === "euroParMWc"
          ? loyerValeur * input.capacityMw / 1000
          : input.loyerMode === "pctCA"
            ? asRate(loyerValeur) * revenueP50Keuro
            : 0;
  const loyerKeuro =
    loyerBaseKeuro * (1 + asRate(input.loyerInflation ?? LOYER_INFLATION_FALLBACK)) ** (year - 1);
  const opexTotalKeuro =
    omKeuro +
    mraKeuro +
    backOfficeKeuro +
    diversKeuro +
    loyerKeuro +
    assuranceKeuro +
    balancingKeuro +
    iferKeuro +
    tfKeuro +
    cfeKeuro +
    aleasKeuro +
    demantelementKeuro;

  return {
    hasDetailedOpex,
    omKeuro,
    mraKeuro,
    backOfficeKeuro,
    diversKeuro,
    loyerKeuro,
    assuranceKeuro,
    balancingKeuro,
    iferKeuro,
    baseTaxesKeuro: taxesLocales.baseTaxesKeuro,
    tfKeuro,
    cfeKeuro,
    aleasKeuro,
    demantelementKeuro,
    opexTotalKeuro,
    opexPerMwKeuro: input.capacityMw > 0 ? opexTotalKeuro / input.capacityMw : 0,
  };
}

/**
 * Computes the two-constraint sizing result from sculpted debt and a gearing cap.
 *
 *   debtRetenu   = min(debtSculpted, debtGearingMax)
 *   headroom     = debtGearingMax - debtRetenu          (≥ 0)
 *   structuringFee = headroom × structuringFeeRate
 *
 * When gearingMax is null there is no bank gearing cap: debtRetenu = debtSculpted,
 * headroom = 0, structuringFee = 0.
 */
function resolveBindingConstraint(
  debtSculptedKeuro: number,
  debtGearingMaxKeuro: number | null,
): SizingResult["bindingConstraint"] {
  if (debtGearingMaxKeuro === null) {
    return "dscr";
  }

  if (Math.abs(debtSculptedKeuro - debtGearingMaxKeuro) < 0.001) {
    return "equal";
  }

  return debtSculptedKeuro < debtGearingMaxKeuro ? "dscr" : "gearing";
}

/**
 * Sculpts debt: determines the maximum senior debt amount compatible with a
 * per-year DSCR schedule, given a P90 CFADS profile over the debt tenor.
 *
 * Method:
 *   - Bisection on the debt amount between 0 and the effective CAPEX ceiling.
 *   - Debt service for year t targets cfadsP90(t) / dscrForYear(t, schedule).
 *   - For each candidate, interest is charged on the outstanding
 *     balance, and principal = annuity − interest (floored at 0, capped at
 *     remaining outstanding).
 *
 * Returns null when dscrSchedule is empty or tenorYears is not positive.
 * Returns { debtAmountKeuro: 0, schedule: [] } when CFADS yields no capacity.
 */
export function sculptDebt(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90Keuro: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
  debtMaxKeuro?: number,
): { debtAmountKeuro: number; schedule: DebtScheduleItem[] } | null {
  if (dscrSchedule.length === 0 || tenorYears <= 0) {
    return null;
  }

  const debtRate = asRate(debtInterestRatePercent);
  const tenorFlows = cashFlows.filter((r) => r.year <= tenorYears);

  // debtAmount = Σ(t=1..tenor) [cfadsP90(t) / dscrTarget(t)] / (1 + r)^t
  const legacyDebtCapacityKeuro = tenorFlows.reduce((pv, row) => {
    return (
      pv +
      row.cfadsP90Keuro / dscrForYear(row.year, dscrSchedule) / (1 + debtRate) ** row.year
    );
  }, 0);

  if (legacyDebtCapacityKeuro <= 0) {
    return { debtAmountKeuro: 0, schedule: [] };
  }

  const buildSchedule = (debtAmountKeuro: number) => {
    const schedule: DebtScheduleItem[] = [];
    let outstanding = debtAmountKeuro;
    let minDscrDelta = Number.POSITIVE_INFINITY;
    let maxAbsDscrDelta = 0;

    for (const row of tenorFlows) {
      const interest = outstanding * debtRate;
      const targetDscr = dscrForYear(row.year, dscrSchedule);
      const targetDebtService = row.cfadsP90Keuro / targetDscr;
      const principal = Math.min(Math.max(0, targetDebtService - interest), outstanding);
      const debtService = principal + interest;
      outstanding = Math.max(0, outstanding - principal);

      if (debtService > 0) {
        const dscrRealized = row.cfadsP90Keuro / debtService;
        const dscrDelta = dscrRealized - targetDscr;
        minDscrDelta = Math.min(minDscrDelta, dscrDelta);
        maxAbsDscrDelta = Math.max(maxAbsDscrDelta, Math.abs(dscrDelta));
      }

      schedule.push({ year: row.year, principal, interest, outstanding });
    }

    return { schedule, outstanding, minDscrDelta, maxAbsDscrDelta };
  };

  let debtMin = 0;
  let debtMax = Math.max(0, debtMaxKeuro ?? legacyDebtCapacityKeuro);
  let debtAmountKeuro = debtMin;
  let result = buildSchedule(debtAmountKeuro);

  for (let index = 0; index < 100; index += 1) {
    const debtMid = (debtMin + debtMax) / 2;
    const candidate = buildSchedule(debtMid);
    debtAmountKeuro = debtMid;
    result = candidate;

    const hasRemainingDebt = candidate.outstanding > 0.0001;
    const dscrBelowTarget = candidate.minDscrDelta < -0.0001;

    if (!hasRemainingDebt && candidate.maxAbsDscrDelta < 0.0001) {
      break;
    }

    if (hasRemainingDebt || dscrBelowTarget) {
      debtMax = debtMid;
    } else {
      debtMin = debtMid;
    }
  }

  return { debtAmountKeuro, schedule: result.schedule };
}

// CFADS de sizing BP (item 8 Phase 2) = EBITDA_P90 net de l'IS du cas de dimensionnement,
// année par année (C_P90 r260 = r226 EBITDA + r244 IS = C_Financing r80/r84). Vérifié à l'euro
// sur data/<N>.xlsm : r260 == EBITDA + IS pour les 25 projets. L'IS P90 (isP90Keuro) est calculé
// dans applyWaterfall (P&L P90 complet : D&A, intérêts dette sizée, intérêts SHL P90, DSRF, agent
// fee) puis reporté sur chaque ligne. IS = 0 (tauxIS null OU cumEBT P90 < 0) → CFADS pré-IS →
// comportement inchangé (rétrocompat + projets « verts » à SHL couvrant restent identiques).
function resolveCfadsSizingKeuro(row: { cfadsP90Keuro: number; isP90Keuro?: number }) {
  return row.cfadsP90Keuro - (row.isP90Keuro ?? 0);
}

function debtScheduleFromRetainedDebt(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90Keuro: number; isP90Keuro?: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
  debtRetenuKeuro: number,
) {
  const debtRate = asRate(debtInterestRatePercent);
  const schedule = new Map<number, RetainedDebtScheduleItem>();
  let outstanding = Math.max(0, debtRetenuKeuro);

  for (const row of cashFlows.filter((cashFlow) => cashFlow.year <= tenorYears)) {
    if (outstanding <= 0) {
      schedule.set(row.year, { principal: 0, interest: 0, outstanding: 0 });
      continue;
    }

    const interest = outstanding * debtRate;
    const targetDebtService =
      resolveCfadsSizingKeuro(row) / dscrForYear(row.year, dscrSchedule);
    const principal = Math.min(Math.max(0, targetDebtService - interest), outstanding);

    outstanding = Math.max(0, outstanding - principal);
    schedule.set(row.year, { principal, interest, outstanding });
  }

  return schedule;
}

function presentValueDebtCapacity(
  cashFlows: ReadonlyArray<{ year: number; cfadsP90Keuro: number; isP90Keuro?: number }>,
  dscrSchedule: DscrTranche[],
  debtInterestRatePercent: number,
  tenorYears: number,
) {
  const debtRate = asRate(debtInterestRatePercent);

  return Math.max(
    0,
    cashFlows
      .filter((row) => row.year <= tenorYears)
      .reduce((pv, row) => {
        const service = resolveCfadsSizingKeuro(row) / dscrForYear(row.year, dscrSchedule);
        return pv + service / (1 + debtRate) ** row.year;
      }, 0),
  );
}

type MarginSizingResult = {
  sizing: SizingResult;
  scheduleByYear: Map<number, RetainedDebtScheduleItem>;
  iterationsCount: number;
};

function sizingWithFacturableMargin(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  margeFactKeuro: number,
  dscrSchedule: DscrTranche[],
  debtTenorYears: number,
  gearingMaxPct: number | null,
): MarginSizingResult {
  const discountRate = asRate(input.discountRate);
  const capexEffectifKeuro = capexTotalKeuro + margeFactKeuro;
  const debtGearingMaxKeuro =
    gearingMaxPct !== null ? capexEffectifKeuro * gearingMaxPct / 100 : null;
  // Point fixe IS_P90 ↔ dette (item 8) : le CFADS de sizing est net de l'IS P90, lequel dépend
  // des intérêts de la dette sizée ET des intérêts SHL du cas P90. Le SHL P90 = CCA (capex − dette)
  // capitalisé en construction ; on le refeed à chaque itération via debtRetenuKeuro courant. Le BP
  // fige cette circularité par macro copier-coller ; ici la boucle converge en 2-4 itérations.
  const ccaRemunRateVal = asRate(input.ccaRemunRate ?? 0);
  const constructionYears = resolveConstructionYears(input);
  const shlP90Drawdown = (debtKeuro: number) => Math.max(0, capexEffectifKeuro - debtKeuro);
  const shlP90Principal = (debtKeuro: number) =>
    shlP90Drawdown(debtKeuro) * (1 + ccaRemunRateVal) ** constructionYears;
  let debtRetenuKeuro = 0;
  let scheduleByYear = new Map<number, RetainedDebtScheduleItem>();
  let preRows = buildPreRows(input, capexEffectifKeuro);
  let taxRows = applyWaterfall(
    preRows,
    scheduleByYear,
    input,
    discountRate,
    dscrSchedule,
    debtTenorYears,
    0,
    ccaRemunRateVal,
    shlP90Principal(debtRetenuKeuro),
    0,
    shlP90Drawdown(debtRetenuKeuro),
  );
  let debtSculptedKeuro = 0;
  let iterationsCount = 0;

  for (let iteration = 0; iteration < 50; iteration += 1) {
    iterationsCount = iteration + 1;
    scheduleByYear = debtScheduleFromRetainedDebt(
      taxRows,
      dscrSchedule,
      input.debtInterestRate,
      debtTenorYears,
      debtRetenuKeuro,
    );
    preRows = buildPreRows(input, capexEffectifKeuro);
    taxRows = applyWaterfall(
      preRows,
      scheduleByYear,
      input,
      discountRate,
      dscrSchedule,
      debtTenorYears,
      0,
      ccaRemunRateVal,
      shlP90Principal(debtRetenuKeuro),
      0,
      shlP90Drawdown(debtRetenuKeuro),
    );
    debtSculptedKeuro = presentValueDebtCapacity(
      taxRows,
      dscrSchedule,
      input.debtInterestRate,
      debtTenorYears,
    );

    const nextDebtRetenuKeuro =
      debtGearingMaxKeuro !== null
        ? Math.min(debtSculptedKeuro, debtGearingMaxKeuro)
        : debtSculptedKeuro;

    if (Math.abs(nextDebtRetenuKeuro - debtRetenuKeuro) < 0.001) {
      debtRetenuKeuro = nextDebtRetenuKeuro;
      break;
    }

    debtRetenuKeuro = nextDebtRetenuKeuro;
  }

  scheduleByYear = debtScheduleFromRetainedDebt(
    taxRows,
    dscrSchedule,
    input.debtInterestRate,
    debtTenorYears,
    debtRetenuKeuro,
  );
  preRows = buildPreRows(input, capexEffectifKeuro);
  taxRows = applyWaterfall(
    preRows,
    scheduleByYear,
    input,
    discountRate,
    dscrSchedule,
    debtTenorYears,
    0,
    ccaRemunRateVal,
    shlP90Principal(debtRetenuKeuro),
    0,
    shlP90Drawdown(debtRetenuKeuro),
  );
  debtSculptedKeuro = presentValueDebtCapacity(
    taxRows,
    dscrSchedule,
    input.debtInterestRate,
    debtTenorYears,
  );

  const gearingActuel =
    capexEffectifKeuro > 0 ? debtRetenuKeuro / capexEffectifKeuro : 0;

  return {
    sizing: {
      debtSculptedKeuro,
      debtGearingMaxKeuro,
      debtRetenuKeuro,
      margeFactKeuro,
      gearingActuel,
      bindingConstraint: resolveBindingConstraint(debtSculptedKeuro, debtGearingMaxKeuro),
      iterationsCount,
    },
    scheduleByYear,
    iterationsCount,
  };
}

function ajusteMargeFacturable(
  input: FinanceEngineInput,
  capexTotalKeuro: number,
  dscrSchedule: DscrTranche[],
  debtTenorYears: number,
  gearingMaxPct: number,
): MarginSizingResult {
  let iterationsCount = 0;
  let result = sizingWithFacturableMargin(
    input,
    capexTotalKeuro,
    0,
    dscrSchedule,
    debtTenorYears,
    gearingMaxPct,
  );
  iterationsCount += result.iterationsCount;
  const gearingMaxRatio = gearingMaxPct / 100;

  if (result.sizing.gearingActuel < gearingMaxRatio) {
    result.sizing.iterationsCount = iterationsCount;
    return result;
  }

  let marge = 0;
  let margePrecedente = 0;
  let pas = 20_000;
  const maxIter = 500;
  let marginIterations = 0;

  while (result.sizing.gearingActuel > gearingMaxRatio && marginIterations < maxIter) {
    margePrecedente = marge;
    marge += pas;
    result = sizingWithFacturableMargin(
      input,
      capexTotalKeuro,
      marge,
      dscrSchedule,
      debtTenorYears,
      gearingMaxPct,
    );
    iterationsCount += result.iterationsCount;
    pas *= 2;
    marginIterations += 1;
  }

  pas = (marge - margePrecedente) / 2;
  marge = margePrecedente;

  while (pas > 1 && marginIterations < maxIter) {
    marge += pas;
    result = sizingWithFacturableMargin(
      input,
      capexTotalKeuro,
      marge,
      dscrSchedule,
      debtTenorYears,
      gearingMaxPct,
    );
    iterationsCount += result.iterationsCount;

    if (result.sizing.gearingActuel < gearingMaxRatio) {
      marge -= pas;
    }

    pas /= 2;
    marginIterations += 1;
  }

  result = sizingWithFacturableMargin(
    input,
    capexTotalKeuro,
    marge,
    dscrSchedule,
    debtTenorYears,
    gearingMaxPct,
  );
  iterationsCount += result.iterationsCount;
  result.sizing.iterationsCount = iterationsCount;

  return result;
}

function degressiveAmortizationCoefficient(durationYears: number) {
  if (durationYears >= 3 && durationYears <= 4) {
    return 1.25;
  }

  if (durationYears >= 5 && durationYears <= 6) {
    return 1.75;
  }

  if (durationYears > 6) {
    return 2.25;
  }

  return 1;
}

function buildAmortizationSchedule(
  initialInvestmentKeuro: number,
  amortDuree: number,
  projectLifeYears: number,
  capexType1Keuro?: number | null,
  capexType2Keuro?: number | null,
  coefDegressif?: number | null,
): AmortizationScheduleItem[] {
  const schedule: AmortizationScheduleItem[] = [];
  const hasTypedCapex = capexType1Keuro != null || capexType2Keuro != null;
  let type1OutstandingKeuro = hasTypedCapex
    ? Math.max(0, capexType1Keuro ?? 0)
    : Math.max(0, initialInvestmentKeuro);
  let type2OutstandingKeuro = hasTypedCapex
    ? Math.max(0, capexType2Keuro ?? 0)
    : 0;
  let vncKeuro = type1OutstandingKeuro + type2OutstandingKeuro;

  if (projectLifeYears <= 0) {
    return schedule;
  }

  if (amortDuree <= 0) {
    for (let year = 1; year <= projectLifeYears; year += 1) {
      schedule.push({ amort: 0, vncKeuro });
    }

    return schedule;
  }

  const linearRate = 1 / amortDuree;
  const degressiveRate =
    linearRate * (coefDegressif ?? degressiveAmortizationCoefficient(amortDuree));
  const type2AnnualAmortKeuro = type2OutstandingKeuro / amortDuree;

  for (let year = 1; year <= projectLifeYears; year += 1) {
    let type1AmortKeuro = 0;
    let type2AmortKeuro = 0;

    if (year <= amortDuree && type1OutstandingKeuro > 0) {
      const remainingYears = amortDuree - year + 1;
      const degressiveAmort = type1OutstandingKeuro * degressiveRate;
      const linearAmort = remainingYears > 0
        ? type1OutstandingKeuro / remainingYears
        : type1OutstandingKeuro;
      type1AmortKeuro = Math.min(
        type1OutstandingKeuro,
        Math.max(degressiveAmort, linearAmort),
      );
      type1OutstandingKeuro = Math.max(0, type1OutstandingKeuro - type1AmortKeuro);
    }

    if (year <= amortDuree && type2OutstandingKeuro > 0) {
      type2AmortKeuro = Math.min(type2OutstandingKeuro, type2AnnualAmortKeuro);
      type2OutstandingKeuro = Math.max(0, type2OutstandingKeuro - type2AmortKeuro);
    }

    const amort = type1AmortKeuro + type2AmortKeuro;
    vncKeuro = type1OutstandingKeuro + type2OutstandingKeuro;
    schedule.push({ amort, vncKeuro });
  }

  return schedule;
}

function buildPreRows(
  input: FinanceEngineInput,
  investmentOverrideKeuro?: number,
): PreRow[] {
  const capexDetails = calculateCapexDetails(input);
  const initialInvestment =
    investmentOverrideKeuro ?? capexDetails.capexTotalKeuro;
  const initialDebt = initialInvestment * (input.debtRate / 100);
  const degradationRate = asRate(input.degradationRate);
  const debtInterestRate = asRate(input.debtInterestRate);
  const tariffInflationRate = asRate(input.tariffInflationRate);
  const annualDebtService = calculateAnnualDebtService(
    initialDebt,
    debtInterestRate,
    input.debtMaturityYears,
  );
  const standardDebtSchedule = buildStandardDebtSchedule(
    initialDebt,
    annualDebtService,
    debtInterestRate,
    input.debtMaturityYears,
  );
  // D&A — split Type 1 (dégressif) / Type 2 (linéaire) MAPPÉ depuis capexDetails si non saisi
  // (template BP, vérifié à 0 € sur les 25 C_D&A — item 7) : Type 1 = modules + BoS + contingency ;
  // Type 2 = raccordement + dev fees + marge facturable amortissable (= MOD facturé total, C_D&A
  // r21). Non amortis (No D&A) = financing fees + APPORT AFFAIRE + indemnités/other (l'apport,
  // Inp_Assumption r215, est dans « Other expenses » r231 du BP — jamais amorti).
  // capexType1/2 saisis → override (Baugé) ; capex legacy sans détail → bloc unique (inchangé).
  let capexType1Keuro = input.capexType1Keuro;
  let capexType2Keuro = input.capexType2Keuro;
  if (capexType1Keuro == null && capexType2Keuro == null && capexDetails.hasDetailedCapex) {
    capexType1Keuro =
      capexDetails.modulesKeuro + capexDetails.boSKeuro + capexDetails.contingencyKeuro;
    capexType2Keuro =
      capexDetails.raccordementKeuro + capexDetails.devFeesKeuro +
      (input.margeFactAmortissableKeuro ?? 0);
  }
  const amortizationSchedule = buildAmortizationSchedule(
    initialInvestment,
    input.amortDuree ?? input.projectLifeYears,
    input.projectLifeYears,
    capexType1Keuro,
    capexType2Keuro,
    input.coefDegressif,
  );
  const contractDuration = input.contractDuration ?? CONTRACT_DURATION_FALLBACK;
  const auroraCurveByYear = buildAuroraCurveByYear(input);
  const baseCapexKeuro = resolveBaseCapexKeuro(input);
  // P90 yield: use provided value or fall back to P50 * 0.93.
  const effectiveYieldP90 = input.yieldP90Mwh ?? input.yieldMwh * 0.93;
  // Facteur de disponibilité appliqué à la production P50 et P90. Défaut 0 → facteur 1 → inchangé.
  const availabilityFactor = 1 - (input.unavailability ?? 0);

  const preRows: PreRow[] = [];
  // Panier an1 du régime P90 (C_P90) : seul l'aléas y reste figé (base an1 × 1.02^(year-1),
  // sans rupture à an21) ; IFER/assurance/balancing suivent leur propre règle par année.
  let opexP90Basket: OpexDetails | null = null;

  for (let year = 1; year <= input.projectLifeYears; year += 1) {
    const degradationFactor = resolveDegradationFactor(
      input.degradationCurve,
      degradationRate,
      year,
    );

    // P50 production year N = yield P50 MWh/MW/year * MW * annual degradation * availability.
    const productionP50 =
      input.yieldMwh * input.capacityMw * degradationFactor * availabilityFactor;

    // P90 production year N = yield P90 MWh/MW/year * MW * annual degradation * availability.
    const productionP90 =
      effectiveYieldP90 * input.capacityMw * degradationFactor * availabilityFactor;

    const contractedTariff = input.tariff * (1 + tariffInflationRate) ** (year - 1);
    const merchantPrices = resolveMerchantPrices(
      input,
      auroraCurveByYear,
      year,
    );
    // Tariff year N applies during the contract period, then merchant prices take over.
    const annualTariff =
      year <= contractDuration
        ? contractedTariff
        : merchantPrices.investorPrice;

    const annualTariffP90 =
      year <= contractDuration
        ? contractedTariff
        : merchantPrices.debtSizingPrice;

    // Revenue kEUR = production MWh * price EUR/MWh / 1000.
    const revenueP50 = (productionP50 * annualTariff) / 1000;

    // Capacity certificate revenue, inflated from the fixed 2024 BP base year.
    const calendarYear = (input.commissioningYear ?? 0) + year - 1;
    const capacityPriceCurve = input.capacityPriceCurve ?? [];
    const capacityIdx = calendarYear - 2025;
    const capacityPriceBrut =
      capacityIdx >= 0 && capacityIdx < capacityPriceCurve.length
        ? capacityPriceCurve[capacityIdx]
        : (capacityPriceCurve.length > 0
            ? capacityPriceCurve[capacityPriceCurve.length - 1]
            : 0);
    const capacityInflation =
      input.curveIndexAn1 != null
        ? input.curveIndexAn1 * (1 + asRate(input.inflationAurora ?? 2)) ** (year - 1)
        : (1 + asRate(input.inflationAurora ?? 2)) ** (calendarYear - 2024);
    const capacityKw = (input.capacityCertificateMw ?? 0) * 1000;
    const revenueCapacityKeuro =
      (capacityPriceBrut * capacityInflation * capacityKw) / 1000;

    // Guarantees of origin start at the configured project year.
    const hasGoRevenue = input.goStartYear != null || input.goPriceBase != null;
    const goStartYear = input.goStartYear ?? 21;
    const goPriceBase = input.goPriceBase ?? 1;
    const goInflation = (1 + asRate(input.inflationOM ?? 2)) ** (year - 1);
    const revenueGoKeuro =
      hasGoRevenue && year >= goStartYear
        ? (goPriceBase * goInflation * productionP50) / 1000
        : 0;
    const revenueP50Total = revenueP50 + revenueCapacityKeuro + revenueGoKeuro;
    const revenueP90 = (productionP90 * annualTariffP90) / 1000;

    const opexDetailsP50 = calculateOpexDetails(
      input,
      year,
      revenueP50Total,
      productionP50,
      baseCapexKeuro,
      revenueP50,
      opexP90Basket?.aleasKeuro,
    );
    // OPEX « engagements » du BP (Inp_Opération / « Total Engagements ») : montants réels
    // datés à l'année projet, NON ré-indexés (déjà en euros courants du BP). Additifs, en P50
    // ET en P90 (le BP les intègre dans « Total operational expenses PV » C_P90 r196-204).
    // Série routée présente → PRIORITÉ ABSOLUE (années au-delà de la série trimée → 0).
    // Série absente → MÉTHODE Phase 3 (tranche 2) si engagementsKeuroAn1 est saisi :
    // engagements(y) = an1 × 1,02^(y−1). null → 0 → comportement inchangé (rétrocompat stricte).
    const engagementsKeuro = input.opexEngagementsKeuroByYear?.length
      ? input.opexEngagementsKeuroByYear[year - 1] ?? 0
      : input.engagementsKeuroAn1 != null
        ? input.engagementsKeuroAn1 * (1 + ENGAGEMENTS_INDEXATION_RATE) ** (year - 1)
        : 0;
    const annualOpex = opexDetailsP50.opexTotalKeuro + engagementsKeuro;

    // Equity cash-flow (P50) kEUR = revenue P50 - OPEX (project NPV/IRR base).
    const cfadsP50 = revenueP50Total - annualOpex;

    if (opexP90Basket === null) {
      opexP90Basket = opexDetailsP50;
    }

    // OPEX P90 (C_P90, debt sizing) : régime dédié, PAS opexP50 + delta balancing.
    // O&M/MRA/BO/Divers/TF/CFE/loyer sont identiques au P50 (déjà correctement indexés
    // côté P50). IFER/assurance/balancing/aléas suivent chacun leur propre règle P90
    // (queue 21-24 élucidée via screenshots C_P90 années 19-30, cf CALIBRATION.md) :
    //  - IFER   : taux courant (saut taux1→taux2 an21, calculateIferKeuro) × 1.02^(year-1).
    //  - Assurance : taux × revenu PV P50 COURANT (suit la baisse an21 au merchant) × 1.02^(year-1).
    //  - Balancing : 2 €/MWh × prodP90(t) × 1.02^(year-1), aucune règle spéciale en 21+.
    //  - Aléas  : base an1 FIGÉE (panier P50 an1) × 1.02^(year-1), aucune rupture à an21.
    const balancingCostVal = input.balancingCost ?? BALANCING_COST_FALLBACK;
    const opexInflFactor = (1 + asRate(input.inflationOM ?? INFLATION_OM_FALLBACK)) ** (year - 1);
    const assuranceRateP90 = asRate(input.assuranceRate ?? ASSURANCE_RATE_FALLBACK);
    const iferP90Keuro = calculateIferKeuro(input, year) * opexInflFactor;
    const assuranceP90Keuro = assuranceRateP90 * revenueP50 * opexInflFactor;
    const aleasP90Keuro = opexP90Basket.aleasKeuro * opexInflFactor;
    const balancingP90Keuro = (balancingCostVal * productionP90) / 1000 * opexInflFactor;
    const opexP90Keuro =
      opexDetailsP50.omKeuro +
      opexDetailsP50.mraKeuro +
      opexDetailsP50.backOfficeKeuro +
      opexDetailsP50.diversKeuro +
      opexDetailsP50.loyerKeuro +
      assuranceP90Keuro +
      balancingP90Keuro +
      iferP90Keuro +
      opexDetailsP50.tfKeuro +
      opexDetailsP50.cfeKeuro +
      aleasP90Keuro +
      // Démantèlement (item 2) : présent dans C_P90 r195 comme en P50 (série identique, non
      // indexée). Sans effet sur le sizing (an25-29 > ténor) mais aligne l'EBITDA/CFADS P90.
      opexDetailsP50.demantelementKeuro +
      engagementsKeuro;
    // Banking CFADS (P90) kEUR = revenue P90 - OPEX P90 (DSCR sizing base).
    const cfadsP90 = revenueP90 - opexP90Keuro;

    const debtService = year <= input.debtMaturityYears ? annualDebtService : 0;
    const standardDebtInterest =
      standardDebtSchedule.get(year)?.interest ?? 0;
    const standardDebtOutstanding =
      standardDebtSchedule.get(year)?.outstanding ?? 0;
    const amortization = amortizationSchedule[year - 1] ?? {
      amort: 0,
      vncKeuro: initialInvestment,
    };

    preRows.push({
      year,
      annualTariff,
      productionP50Mwh: productionP50,
      productionP90Mwh: productionP90,
      revenueP50Keuro: revenueP50Total,
      revenueP50PvKeuro: revenueP50,
      revenueP90Keuro: revenueP90,
      opexKeuro: annualOpex,
      cashFlowKeuro: cfadsP50,
      cfadsP90Keuro: cfadsP90,
      debtServiceKeuro: debtService,
      standardDebtInterestKeuro: standardDebtInterest,
      standardDebtOutstandingKeuro: standardDebtOutstanding,
      amort: amortization.amort,
      vncKeuro: amortization.vncKeuro,
    });
  }

  return preRows;
}

// IS = tauxIS × MIN(EBT, cumEBT) ; 0 si EBT < 0 OU cumEBT < 0 — report déficitaire intégral
// (template BP §2.6 / C_P50!r245). Le MIN encode le report : la 1re année où le cumul devient
// positif taxe le cumul, ensuite l'EBT courant.
function computeIS(ebt: number, cumEbt: number, tauxIS: number | null | undefined) {
  if (tauxIS == null || ebt <= 0 || cumEbt <= 0) {
    return 0;
  }
  return Math.min(ebt, cumEbt) * asRate(tauxIS);
}

function applyWaterfall(
  preRows: PreRow[],
  scheduleByYear: Map<number, RetainedDebtScheduleItem>,
  input: Pick<
    FinanceEngineInput,
    | "tauxIS"
    | "dsraMonths"
    | "taxeFinaleSizingKeuro"
    | "dsrfFeeRate"
    | "dsrfAnnuelKeuro"
    | "agentFeeAnnuelKeuro"
    | "inflationOM"
  >,
  discountRate: number,
  effectiveSchedule: DscrTranche[] | null,
  effectiveTenor: number,
  ccaPrincipalKeuro: number,
  ccaRemunRate: number = 0,
  // Solde SHL du cas de dimensionnement (P90) au démarrage MES = CCA (capex − dette) capitalisée
  // en construction. Sert au P&L P90 (intérêts SHL r233) qui pilote l'IS de sizing (item 8). Séparé
  // de ccaPrincipalKeuro (cascade P50) : pendant le sizing on passe 0 côté P50 et le vrai CCA ici.
  ccaP90PrincipalKeuro: number = 0,
  // Drawdown SHL P50 (avant capitalisation an0) — sert au SEED du cumEBT (item 9). Séparé du
  // principal capitalisé (ccaPrincipalKeuro = drawdown × (1+r)^construction) : leur différence est
  // l'intérêt SHL capitalisé an0.
  ccaDrawdownKeuro: number = 0,
  // Drawdown SHL du cas P90 (avant capitalisation an0) — SEED du cumEBT P90 (item 9b), qui pilote
  // l'IS de sizing → la DETTE. Séparé du principal P90 (ccaP90PrincipalKeuro).
  ccaP90DrawdownKeuro: number = 0,
): Array<AnnualCashFlow & { cfadsP90AfterTaxKeuro: number }> {
  let ccaOutstanding = Math.max(0, ccaPrincipalKeuro);
  // SEED du report déficitaire (item 9). Le BP cumule le cumEBT DEPUIS l'an0 (construction), où le
  // seul poste est l'intérêt SHL capitalisé : EBT(an0) = −(ccaPrincipal − ccaDrawdown). Vérifié à
  // l'euro sur les 25 fichiers : C_P50 r243(an1) − r242(an1) = r243(an0) = −r289(an0). Le cumEBT
  // démarre donc négatif → l'IS bascule un an plus tard (bascule BP exacte). Pendant le sizing la
  // cascade P50 reçoit ccaPrincipal = ccaDrawdown = 0 → seed nul → dette inchangée. Cf CALIBRATION.md.
  const seedP50 = -Math.max(0, ccaPrincipalKeuro - ccaDrawdownKeuro);
  let cumEbtP50 = seedP50;
  // Seed du cumEBT du cas de dimensionnement P90 (item 9b) : même mécanique (intérêt SHL P90
  // capitalisé an0). Il maintient l'IS de sizing à 0 un an de plus → bascule IS_P90 = BP → dette
  // BP. Pendant le sizing, ccaP90Principal/Drawdown portent le vrai SHL P90 (≠ 0) → seed effectif.
  let cumEbtP90 = -Math.max(0, ccaP90PrincipalKeuro - ccaP90DrawdownKeuro);
  // resultatCumule = résultat net cumulé PUR (C_P50 r247), seedé au net income an0 (= EBT an0).
  let resultatCumule = seedP50;
  // retainedEarnings = bénéfices distribuables (C_P50 r311/r334), NETS des dividendes déjà versés —
  // gate des dividendes (item 10). Séparé de resultatCumule (r247, non réduit par les dividendes).
  let retainedEarnings = seedP50;
  // Cascade SHL du cas P90 (indépendante de la cascade P50) : le SHL est servi par le cash P90
  // résiduel après service dette ; ce qui n'est pas couvert est capitalisé (solde croissant). Chez
  // les projets à fort gearing (peu de CCA) il s'éteint vite → intérêts SHL → 0 → EBT P90 taxable ;
  // chez les projets à faible gearing il grossit → maintient cumEBT P90 négatif → IS de sizing = 0.
  let shlP90Outstanding = Math.max(0, ccaP90PrincipalKeuro);

  return preRows.map((pre) => {
    const scheduleItem = scheduleByYear.get(pre.year) ?? null;
    const sculptedService =
      scheduleItem !== null ? scheduleItem.principal + scheduleItem.interest : null;
    const debtInterest = scheduleItem?.interest ?? pre.standardDebtInterestKeuro;
    const ccaBop = ccaOutstanding;
    const ccaInterets = ccaOutstanding * ccaRemunRate;
    const interets = debtInterest + ccaInterets;
    // DSRF + agent fee : charges déductibles (dans l'EBT, §2.6) ET cash (retirées du flux equity plus bas).
    // DSRF(y) = dsrfFeeRate% × dsraMonths/12 × service dette(y) appliqué, 0 hors dette (§2.1) ;
    // dsrfAnnuelKeuro (legacy) override le calcul. Agent = valeur an1 × (1+inflOpex)^(y−1), an1..tenor (§2.7).
    const debtServiceForFees = sculptedService ?? pre.debtServiceKeuro;
    const dsrfDeduction =
      pre.year > effectiveTenor
        ? 0
        : input.dsrfAnnuelKeuro != null
          ? input.dsrfAnnuelKeuro
          : asRate(input.dsrfFeeRate ?? DSRF_FEE_RATE_FALLBACK) *
            ((input.dsraMonths ?? 0) / 12) *
            Math.max(0, debtServiceForFees);
    const agentFeeDeduction =
      pre.year <= effectiveTenor
        ? (input.agentFeeAnnuelKeuro ?? 0) *
          (1 + asRate(input.inflationOM ?? INFLATION_OM_FALLBACK)) ** (pre.year - 1)
        : 0;
    const ebit = pre.cashFlowKeuro - pre.amort;
    // EBT = EBITDA_P50 − D&A − intérêts (dette + SHL) − DSRF − agent fees (template BP C_P50!r245).
    const ebt = ebit - interets - dsrfDeduction - agentFeeDeduction;
    cumEbtP50 += ebt;
    const is = computeIS(ebt, cumEbtP50, input.tauxIS);
    const resultatNet = ebt - is;
    resultatCumule += resultatNet;
    retainedEarnings += resultatNet;
    const cfadsAfterTax = pre.cashFlowKeuro - is;
    // P&L du cas de dimensionnement (P90, C_P90) : EBT_P90 = EBITDA_P90 − D&A − intérêts dette
    // sizée − intérêts SHL P90 (r233, sur solde SHL P90 courant) − DSRF − agent fee. IS_P90 =
    // 25% × max(0, min(EBT_P90, cumEBT_P90)). Intérêts SHL P90 ≠ ccaInterets P50 (waterfall dédié).
    const intSHLP90 = shlP90Outstanding * ccaRemunRate;
    const ebitP90 = pre.cfadsP90Keuro - pre.amort;
    const ebtP90 = ebitP90 - debtInterest - intSHLP90 - dsrfDeduction - agentFeeDeduction;
    cumEbtP90 += ebtP90;
    const isP90 = computeIS(ebtP90, cumEbtP90, input.tauxIS);
    const debtService = sculptedService ?? pre.debtServiceKeuro;
    // Cascade SHL P90 : cash P90 après IS de sizing et service dette → intérêts SHL (payés en
    // priorité, le reste capitalisé) → remboursement principal (résidu). Met à jour le solde SHL
    // reporté à l'année suivante. Hors ténor (year > effectiveTenor) : plus de dette → pas de sizing.
    const cashForShlP90 = Math.max(0, pre.cfadsP90Keuro - isP90 - debtService);
    const shlP90IntPaid = Math.min(cashForShlP90, intSHLP90);
    const shlP90Repay = Math.min(shlP90Outstanding, cashForShlP90 - shlP90IntPaid);
    shlP90Outstanding = Math.max(0, shlP90Outstanding + (intSHLP90 - shlP90IntPaid) - shlP90Repay);
    // ── Cascade SHL / dividendes P50 (C_P50 r296-r319) — item 10 ────────────────────────────────
    // PAS de DSRA : le BP ne finance aucune réserve de service de la dette (vérifié à l'euro sur les
    // 25 fichiers : r296 « Cash flow available for SHL » == r268 « FCF after debt service »). Le cash
    // equity disponible = CFADS après IS − service dette − DSRF − agent fee (les fees sortent aussi
    // du flux, cf BUG B, mais sans réserve DSRA qui gonflait/lissait l'ancien cash).
    const cashEquity = Math.max(0, cfadsAfterTax - debtService - dsrfDeduction - agentFeeDeduction);
    // Intérêts SHL payés en priorité (r297) ; le NON couvert par le cash est CAPITALISÉ (r289 an1+
    // ≠ 0 → solde SHL croissant chez les projets cash-tight : Orval, Mur-de-Sologne, Panzoult…).
    const ccaInteretsPaid = Math.min(cashEquity, ccaInterets);
    const ccaCapitalise = ccaInterets - ccaInteretsPaid;
    const cashApresInterets = cashEquity - ccaInteretsPaid;
    // Remboursement (r298) = résidu, jusqu'à extinction du principal (intérêts capitalisés inclus).
    const ccaRemboursement = Math.min(ccaOutstanding + ccaCapitalise, cashApresInterets);
    ccaOutstanding = Math.max(0, ccaOutstanding + ccaCapitalise - ccaRemboursement);
    const residualAfterCca = cashApresInterets - ccaRemboursement;
    // Dividendes (r313) plafonnés aux bénéfices distribuables cumulés (retained earnings r311) ;
    // l'excédent part en cash pooling (r319) et reste en trésorerie SPV.
    const distribuable = Math.max(0, retainedEarnings);
    const dividende = Math.min(residualAfterCca, distribuable);
    retainedEarnings -= dividende;
    const cashPooling = residualAfterCca - dividende;
    // Flux actionnaire = FCF after debt service (template BP C_P50!r296, §2.7) :
    //   EBITDA_P50 − IS − principal − intérêts dette − DSRF − agent fee
    //   = cfadsAfterTax (EBITDA−IS) − service dette appliqué − DSRF − agent fee.
    // PRIS AVANT le waterfall SHL/dividendes : la ventilation intérêts SHL / principal SHL /
    // dividendes est une répartition INTERNE qui ne change pas ce flux. Les intérêts SHL entrent
    // dans l'EBT (pour l'IS, §2.6) mais NE sont PAS re-déduits ici (pas de double comptage).
    // Aucun terme DSRA : le BP finance la réserve à l'an0, hors flux equity annuel. C'est CE flux,
    // pas la cascade, qui porte le TRI investisseur. La cascade (dividende/ccaRemboursement/
    // cashBloque) reste calculée ci-dessus pour l'affichage comptable du waterfall SHL.
    const fluxActionnaire =
      cfadsAfterTax - debtService - dsrfDeduction - agentFeeDeduction;

    return {
      year: pre.year,
      annualTariff: pre.annualTariff,
      productionP50Mwh: pre.productionP50Mwh,
      productionP90Mwh: pre.productionP90Mwh,
      revenueP50Keuro: pre.revenueP50Keuro,
      revenueP50PvKeuro: pre.revenueP50PvKeuro,
      revenueP90Keuro: pre.revenueP90Keuro,
      opexKeuro: pre.opexKeuro,
      cashFlowKeuro: pre.cashFlowKeuro,
      discountedCashFlowKeuro: discounted(cfadsAfterTax, pre.year, discountRate),
      debtServiceKeuro: pre.debtServiceKeuro,
      debtServiceSculptedKeuro: sculptedService,
      debtOutstandingKeuro: scheduleItem?.outstanding ?? pre.standardDebtOutstandingKeuro,
      cfadsP90Keuro: pre.cfadsP90Keuro,
      isP90Keuro: isP90,
      intSHLP90Keuro: intSHLP90,
      shlP90OutstandingKeuro: shlP90Outstanding,
      amort: pre.amort,
      vncKeuro: pre.vncKeuro,
      ebit,
      interets,
      ebt,
      is,
      resultatNet,
      cfadsAfterTax,
      dividende,
      fluxActionnaire,
      ccaRemboursementKeuro: ccaRemboursement,
      ccaInteretsKeuro: ccaInterets,
      ccaOutstandingKeuro: ccaOutstanding,
      ccaBoPKeuro: ccaBop,
      ccaDrawdownKeuro: 0,
      ccaCapitalizedInterestKeuro: ccaCapitalise,
      ccaEoPKeuro: ccaOutstanding,
      deficitCumuleKeuro: Math.max(0, -cumEbtP50),
      resultatCumuleKeuro: resultatCumule,
      // DSRA supprimée (item 10) : le BP ne finance aucune réserve → soldes/dépôts/retraits = 0.
      dsraSoldeKeuro: 0,
      dsraDepotKeuro: 0,
      dsraRetraitKeuro: 0,
      cashBloqueKeuro: cashPooling,
      cashPoolingKeuro: cashPooling,
      cfadsP90AfterTaxKeuro: pre.cfadsP90Keuro - isP90,
      // Standard DSCR: CFADS P90 de sizing (net de l'IS P90, item 8) / constant-annuity service.
      dscr:
        pre.debtServiceKeuro > 0
          ? resolveCfadsSizingKeuro({ cfadsP90Keuro: pre.cfadsP90Keuro, isP90Keuro: isP90 }) /
            pre.debtServiceKeuro
          : null,
      // Realized DSCR: CFADS P90 de sizing / service retenu (sculpté).
      dscrRealized:
        debtService > 0
          ? resolveCfadsSizingKeuro({ cfadsP90Keuro: pre.cfadsP90Keuro, isP90Keuro: isP90 }) /
            debtService
          : null,
      // Target DSCR for this year from the schedule (null when no sculpting or beyond tenor).
      dscrTargetAtYear:
        effectiveSchedule !== null && pre.year <= effectiveTenor
          ? dscrForYear(pre.year, effectiveSchedule)
          : null,
    };
  });
}

function zeroAnnualCashFlow(year: number): AnnualCashFlow {
  return {
    year,
    annualTariff: 0,
    productionP50Mwh: 0,
    productionP90Mwh: 0,
    revenueP50Keuro: 0,
    revenueP50PvKeuro: 0,
    revenueP90Keuro: 0,
    opexKeuro: 0,
    cashFlowKeuro: 0,
    discountedCashFlowKeuro: 0,
    debtServiceKeuro: 0,
    debtServiceSculptedKeuro: null,
    debtOutstandingKeuro: 0,
    cfadsP90Keuro: 0,
    cfadsP90AfterTaxKeuro: 0,
    isP90Keuro: 0,
    intSHLP90Keuro: 0,
    shlP90OutstandingKeuro: 0,
    amort: 0,
    vncKeuro: 0,
    ebit: 0,
    interets: 0,
    ebt: 0,
    is: 0,
    resultatNet: 0,
    cfadsAfterTax: 0,
    dividende: 0,
    fluxActionnaire: 0,
    ccaRemboursementKeuro: 0,
    ccaInteretsKeuro: 0,
    ccaOutstandingKeuro: 0,
    ccaBoPKeuro: 0,
    ccaDrawdownKeuro: 0,
    ccaCapitalizedInterestKeuro: 0,
    ccaEoPKeuro: 0,
    deficitCumuleKeuro: 0,
    resultatCumuleKeuro: 0,
    dsraSoldeKeuro: 0,
    dsraDepotKeuro: 0,
    dsraRetraitKeuro: 0,
    cashBloqueKeuro: 0,
    cashPoolingKeuro: 0,
    dscr: null,
    dscrRealized: null,
    dscrTargetAtYear: null,
  };
}

function withConstructionRows(
  rows: AnnualCashFlow[],
  constructionYears: number,
  ccaDrawdownKeuro: number = 0,
  ccaRemunRate: number = 0,
): AnnualCashFlow[] {
  const constructionRows = Array.from(
    { length: constructionYears + 1 },
    (_, index): AnnualCashFlow => {
      const year = -constructionYears + index;
      const isFinancingYear = index === 0;
      // BoP for each year: 0 at financing year, then drawdown × (1+rate)^(i-1)
      const bop = isFinancingYear ? 0 : ccaDrawdownKeuro * (1 + ccaRemunRate) ** (index - 1);
      const drawdown = isFinancingYear ? ccaDrawdownKeuro : 0;
      const capitalizedInt = isFinancingYear ? 0 : bop * ccaRemunRate;
      const eop = isFinancingYear ? ccaDrawdownKeuro : bop + capitalizedInt;
      return {
        ...zeroAnnualCashFlow(year),
        ccaBoPKeuro: bop,
        ccaDrawdownKeuro: drawdown,
        ccaCapitalizedInterestKeuro: capitalizedInt,
        ccaOutstandingKeuro: eop,
        ccaEoPKeuro: eop,
      };
    },
  );

  return [...constructionRows, ...rows];
}

function calculateFinancing(input: FinanceEngineInput): SizingComputation {
  const capexTotalKeuro = calculateCapexDetails(input).capexTotalKeuro;
  const financingFees = calculateFinancingFees({
    ...input,
    capexTotalKeuro,
  });
  const initialInvestment = capexTotalKeuro + financingFees.financingFeesKeuro;
  const discountRate = asRate(input.discountRate);
  const effectiveSchedule = resolveSchedule(input);
  const effectiveTenor = input.debtTenorYears ?? input.debtMaturityYears;

  const hasSculpting = effectiveSchedule !== null && effectiveTenor > 0;

  const ccaRemunRate = asRate(input.ccaRemunRate ?? 0);
  const constructionYears = resolveConstructionYears(input);

  if (!hasSculpting) {
    const retainedDebt = initialInvestment * input.debtRate / 100;
    const ccaDrawdownKeuro = Math.max(0, initialInvestment - retainedDebt);
    const ccaPrincipalKeuro = ccaDrawdownKeuro * (1 + ccaRemunRate) ** constructionYears;
    const annualCashFlows = applyWaterfall(
      buildPreRows(input, initialInvestment),
      new Map(),
      input,
      discountRate,
      effectiveSchedule,
      effectiveTenor,
      ccaPrincipalKeuro,
      ccaRemunRate,
      ccaPrincipalKeuro,
      ccaDrawdownKeuro,
      ccaDrawdownKeuro,
    );

    return {
      sizing: null,
      scheduleByYear: new Map(),
      annualCashFlows: withConstructionRows(
        annualCashFlows,
        constructionYears,
        ccaDrawdownKeuro,
        ccaRemunRate,
      ),
      iterations: 0,
    };
  }

  const gearingMaxPct = resolveGearingMaxPct(input);
  const marginResult =
    input.margeFactFigeeKeuro != null
      ? // Marge facturable figée par le BP : on impose la valeur (cap gearing conservé) et on
        // court-circuite la boucle endogène `ajusteMargeFacturable`.
        sizingWithFacturableMargin(
          input,
          initialInvestment,
          input.margeFactFigeeKeuro,
          effectiveSchedule,
          effectiveTenor,
          gearingMaxPct,
        )
      : gearingMaxPct === null
        ? sizingWithFacturableMargin(
            input,
            initialInvestment,
            0,
            effectiveSchedule,
            effectiveTenor,
            null,
          )
        : ajusteMargeFacturable(
            input,
            initialInvestment,
            effectiveSchedule,
            effectiveTenor,
            gearingMaxPct,
          );
  const capexEffectif = initialInvestment + marginResult.sizing.margeFactKeuro;
  const ccaDrawdownKeuro = Math.max(0, capexEffectif - marginResult.sizing.debtRetenuKeuro);
  const ccaPrincipalKeuro = ccaDrawdownKeuro * (1 + ccaRemunRate) ** constructionYears;
  const annualCashFlows = applyWaterfall(
    buildPreRows(input, capexEffectif),
    marginResult.scheduleByYear,
    input,
    discountRate,
    effectiveSchedule,
    effectiveTenor,
    ccaPrincipalKeuro,
    ccaRemunRate,
    ccaPrincipalKeuro,
    ccaDrawdownKeuro,
    ccaDrawdownKeuro,
  );

  return {
    sizing: marginResult.sizing,
    scheduleByYear: marginResult.scheduleByYear,
    annualCashFlows: withConstructionRows(
      annualCashFlows,
      constructionYears,
      ccaDrawdownKeuro,
      ccaRemunRate,
    ),
    iterations: marginResult.sizing.iterationsCount,
  };
}

export function calculateAnnualCashFlows(input: FinanceEngineInput): AnnualCashFlow[] {
  return calculateFinancing(input).annualCashFlows;
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  // Initial investment kEUR comes from detailed CAPEX when configured, else legacy capex kEUR/MW.
  const capexTotalKeuro = calculateCapexDetails(input).capexTotalKeuro;
  const financingFees = calculateFinancingFees({
    ...input,
    capexTotalKeuro,
  });
  const taxesLocales = calculateTaxesFoncieres(input, resolveBaseCapexKeuro(input));
  const iferKeuroAn1 = calculateIferKeuro(input, 1);
  const iferKeuroAn21 = calculateIferKeuro(input, 21);
  const initialInvestment = capexTotalKeuro + financingFees.financingFeesKeuro;
  const financing = calculateFinancing(input);
  const annualCashFlows = financing.annualCashFlows;
  const operatingCashFlows = annualCashFlows.filter((row) => row.year >= 1);
  const constructionYears = resolveConstructionYears(input);
  const postInvestmentZeroFlows = Array(constructionYears).fill(0) as number[];

  // VAN and TRI use after-tax P50 operating cash-flows.
  const cashFlows = operatingCashFlows.map((row) => row.cfadsAfterTax);
  const irrCashFlows = [...postInvestmentZeroFlows, ...cashFlows];
  const discountedCashFlows = operatingCashFlows.reduce(
    (total, row) => total + row.discountedCashFlowKeuro,
    0,
  );
  const discountedOpex = operatingCashFlows.reduce(
    (total, row) => total + discounted(row.opexKeuro, row.year, asRate(input.discountRate)),
    0,
  );
  // LCOE uses P50 production.
  const discountedProduction = operatingCashFlows.reduce(
    (total, row) =>
      total + discounted(row.productionP50Mwh, row.year, asRate(input.discountRate)),
    0,
  );
  // Minimum DSCR uses realized debt service only on years where principal + interest is paid.
  const dscrValues = annualCashFlows
    .map((row) => {
      const debtService = row.debtServiceSculptedKeuro ?? row.debtServiceKeuro;
      return debtService > 0 && row.dscrRealized !== null && row.dscrRealized < 100
        ? row.dscrRealized
        : null;
    })
    .filter((value): value is number => value !== null);

  const dscr = dscrValues.length > 0 ? Math.min(...dscrValues) : null;

  const sizing = financing.sizing;

  const margeFact = sizing?.margeFactKeuro ?? 0;
  const capexEffectif = initialInvestment + margeFact;

  // NPV kEUR = sum of discounted P50 cash-flows - effective CAPEX.
  const npv = discountedCashFlows - capexEffectif;

  // LCOE EUR/MWh = discounted total cost / discounted P50 production * 1000.
  const lcoe =
    discountedProduction > 0
      ? ((capexEffectif + discountedOpex) / discountedProduction) * 1000
      : 0;
  const retainedDebt = sizing?.debtRetenuKeuro ?? initialInvestment * input.debtRate / 100;
  const ccaKeuro = Math.max(0, capexEffectif - retainedDebt);
  const margeDev = input.margeDevKeuro ?? margeFact;
  const devFeesKeuro = (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const tauxISEntreprise = input.tauxISEntreprise ?? input.tauxIS ?? 0;
  const netEntrepriseFactor = 1 - asRate(tauxISEntreprise);
  const dsraInitialKeuro =
    operatingCashFlows.length > 0
      ? (operatingCashFlows[0].debtServiceSculptedKeuro ??
          operatingCashFlows[0].debtServiceKeuro) *
        (input.dsraMonths ?? 0) / 12
      : 0;
  const miseNetteInvest =
    ccaKeuro + devFeesKeuro + margeDev * (1 - asRate(input.tauxIS ?? 0));
  const miseNetteEntrep =
    miseNetteInvest - margeDev * netEntrepriseFactor - devFeesKeuro * netEntrepriseFactor;
  // Le TRI investisseur conserve la zéro-année de construction (postInvestmentZeroFlows) : le BP
  // tire le SHL en Period Year −1 et démarre l'exploitation en Period Year +1, soit 2 ans d'écart,
  // que cette zéro-année modélise correctement. Vérifié : avec la déduction DSRF/fees (BUG B),
  // cette convention donne investorIrr 12.04% ≈ BP 12.03%. Cf CALIBRATION.md "DEUX BUGS OPPOSÉS".
  const shareholderFlows = [
    ...postInvestmentZeroFlows,
    ...operatingCashFlows.map((row) => row.fluxActionnaire),
  ];
  // Investor IRR/NPV BP : mise SHL pure (ccaKeuro), sans devFees ni marge au dénominateur —
  // par opposition à miseNetteInvest/miseNetteEntrep qui les y ajoutent (cf diagnostic doc).
  const investorIrr = round(calculateIrr(ccaKeuro, shareholderFlows) * 100);
  const investorNpv = round(
    calculateNpvAtRate(ccaKeuro, shareholderFlows, asRate(input.discountRate)),
  );
  const shouldCalculateDoubleIrr =
    retainedDebt > 0 ||
    ccaKeuro > 0 ||
    margeDev > 0 ||
    devFeesKeuro > 0 ||
    input.tauxIS != null;
  const doubleIRR = shouldCalculateDoubleIrr
    ? calculateDoubleIRR(
        {
          projectInvestmentKeuro: capexEffectif,
          equityInvestmentKeuro: miseNetteEntrep,
          dsraInitialKeuro,
          devFeesKeuro,
          miseNetteInvest,
          miseNetteEntrep,
        },
        irrCashFlows,
        shareholderFlows,
      )
    : null;

  // ── TRI PROJET (BRUT, non-levier / unlevered) — calé sur le BP « rng_CF_TRI_Projet_Brut »
  // (C_P50 r383, XIRR r425 → Inp_Assumption r53). Flux = CFADS après IS P50 unlevered (r261 =
  // irrCashFlows, avec la/les zéro-année(s) de construction), SANS service de dette. Mise en an0 =
  // CAPEX projet HORS frais de financement (les fees sont « réintégrés » côté BP : (A) Financial
  // fees) MOINS le montant MOD (« (C) MOD amount in Capex » = frais de dev réintégrés) :
  //   an0_brut = capexTotalDetail − financingFees − MOD   (MOD = modRetraitement ?? devFees).
  // Le « net » BP retient les fees mais pas le MOD (an0_net = capexTotalDetail − financingFees) ;
  // la version exposée ici est la BRUTE demandée. calculateIrr (IRR annuel) reproduit le XIRR
  // BP (actual/365) au centième (Sigoulès 6.74 vs BP 6.7364, Villognon 8.27 vs 8.2656,
  // Baugé 8.26 vs 8.2540). Cf CALIBRATION / diagnostic « IRR & NPV ».
  const modKeuro = input.modRetraitementKeuro ?? (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const projectCapexDetails = calculateCapexDetails(input);
  const projectIrrBaseKeuro =
    projectCapexDetails.capexTotalKeuro - projectCapexDetails.financingFeesKeuro - modKeuro;
  const projectIrr = round(calculateIrr(projectIrrBaseKeuro, irrCashFlows) * 100);
  return {
    npv: round(npv),
    irr: round(calculateIrr(miseNetteInvest, shareholderFlows) * 100),
    projectIrr,
    investorIrr,
    investorNpv,
    lcoe: round(lcoe),
    dscr: dscr !== null ? round(dscr) : null,
    debtAmountKeuro: sizing !== null ? round(sizing.debtRetenuKeuro) : null,
    doubleIRR,
    sizingIterations: financing.iterations,
    financingFeesKeuro: round(financingFees.financingFeesKeuro),
    estimatedPltKeuro: round(financingFees.estimatedPltKeuro),
    financingFeesDetail: {
      legalFees: round(financingFees.financingFeesDetail.legalFees),
      technicalDD: round(financingFees.financingFeesDetail.technicalDD),
      arrangerFees: round(financingFees.financingFeesDetail.arrangerFees),
      participantFees: round(financingFees.financingFeesDetail.participantFees),
      bankFeesPLT: round(financingFees.financingFeesDetail.bankFeesPLT),
      interimFinancing: round(financingFees.financingFeesDetail.interimFinancing),
      commitmentFees: round(financingFees.financingFeesDetail.commitmentFees),
    },
    contingencyKeuro: round(calculateCapexDetails(input).contingencyKeuro),
    tfAnnuelleKeuro: round(taxesLocales.tfAnnuelleKeuro),
    cfeAnnuelleKeuro: round(taxesLocales.cfeAnnuelleKeuro),
    iferKeuroAn1: round(iferKeuroAn1),
    iferKeuroAn21: round(iferKeuroAn21),
    sizing: sizing !== null
      ? {
          ...sizing,
          debtSculptedKeuro: round(sizing.debtSculptedKeuro),
          debtGearingMaxKeuro:
            sizing.debtGearingMaxKeuro !== null ? round(sizing.debtGearingMaxKeuro) : null,
          debtRetenuKeuro: round(sizing.debtRetenuKeuro),
          margeFactKeuro: round(sizing.margeFactKeuro),
          gearingActuel: round(sizing.gearingActuel, 6),
        }
      : null,
  };
}
