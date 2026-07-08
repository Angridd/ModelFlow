/**
 * Chemin de calcul UNIFIÉ « scénario → FinanceEngineInput → métriques ».
 *
 * Ce module est l'UNIQUE source de vérité pour reconstruire le FinanceEngineInput d'un scénario
 * persisté (avec réinjection des inputs moteur de calibration : opexEngagementsKeuroByYear +
 * margeFactFigeeKeuro + courbes merchant par techno). Il est consommé par la page détail, la liste
 * des projets et le dashboard portefeuille : liste = détail = dashboard PAR CONSTRUCTION (plus de
 * dépendance aux valeurs persistées scenario.irr/npv potentiellement périmées).
 *
 * Copie fidèle de l'ancien buildFinanceInput de app/projects/[id]/page.tsx (et de
 * scripts/calibrate_all.ts) : les 25 projets recalculés côté serveur == calibrate_all à l'euro.
 */
import type { Project, Scenario } from "@/app/generated/prisma/client";
import {
  calculateCapexDetails,
  calculateScenarioMetrics,
  type FinanceEngineInput,
  type FinanceEngineResult,
} from "@/app/lib/finance/engine";
import {
  CAPACITY_PRICE_CURVE,
  merchantCurveForTechnology,
} from "@/app/lib/finance/merchantCurves";
import type { DscrTranche } from "@/app/lib/finance/types";

/** Sous-ensemble des champs Project requis par le moteur (compatible avec le modèle Prisma). */
export type ProjectFinanceFields = Pick<
  Project,
  | "technology"
  | "capacityMw"
  | "commissioningYear"
  | "debtSizingCentralW"
  | "debtSizingLowW"
  | "investorCurveW"
>;

/** Profil DSCR persisté en JSON (comme dscrSchedule). Vide/invalide → null (moteur inchangé). */
export function parseDscrSchedule(json: string | null): DscrTranche[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as DscrTranche[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Engagements OPEX an-par-an (k€) persistés en JSON (migration persist_engagements_marge).
 * Vide/invalide → undefined (rétrocompat stricte : comportement moteur inchangé, comme calibrate_all).
 */
export function parseEngagements(json: string | null): number[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      return parsed as number[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * scénario → FinanceEngineInput. Courbe merchant résolue PAR TECHNO (Fixed → FIXED_CURVE_2026Q2,
 * Tracker → TRACKER_CURVE_2026Q2), engagements + marge figée réinjectés depuis les colonnes
 * persistées → « détail = liste = dashboard ». null → comportement moteur inchangé (legacy).
 */
export function buildFinanceInput(
  project: ProjectFinanceFields,
  scenario: Scenario,
): FinanceEngineInput {
  return {
    opexEngagementsKeuroByYear: parseEngagements(scenario.opexEngagementsKeuroByYear),
    // TF/CFE appliquées (item 4) : mêmes JSON k€ an-par-an que les engagements. null → base calculée.
    tfKeuroByYear: parseEngagements(scenario.tfKeuroByYear),
    cfeKeuroByYear: parseEngagements(scenario.cfeKeuroByYear),
    // Démantèlement appliqué (item 2) : JSON k€ an-par-an (an25-29 uniquement). null → 0.
    demantelementKeuroByYear: parseEngagements(scenario.demantelementKeuroByYear),
    // MRA appliquée (item 6) : JSON k€ an-par-an (paliers onduleurs). null → scalaire mraEuroKwc.
    mraKeuroByYear: parseEngagements(scenario.mraKeuroByYear),
    // Méthodes Phase 3 (fallback projets neufs — la série routée garde la priorité) :
    // démantèlement €/MWc + timing, profil MRA. null → défauts moteur (10 000 €/MWc,
    // « fin_de_vie », « paliers »).
    demantelementEuroMWc: scenario.demantelementEuroMWc,
    demantelementTiming: scenario.demantelementTiming,
    mraProfil: scenario.mraProfil,
    // Méthode engagements (tranche 2) : an1 k€ × 1,02^(y−1) quand la série routée est absente.
    // null → comportement actuel inchangé (0) — pas de défaut imposé (an1/MWc trop variable).
    engagementsKeuroAn1: scenario.engagementsKeuroAn1,
    margeFactFigeeKeuro: scenario.margeFactFigeeKeuro,
    // Marge facturable amortissable (item 7) : base D&A Type 2 uniquement. null → inchangé.
    margeFactAmortissableKeuro: scenario.margeFactAmortissableKeuro,
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves: merchantCurveForTechnology(project.technology),
    debtSizingCentralW: project.debtSizingCentralW,
    debtSizingLowW: project.debtSizingLowW,
    investorCurveW: project.investorCurveW,
    capex: scenario.capex,
    surfaceHa: scenario.surfaceHa,
    prixModuleUSDWc: scenario.prixModuleUSDWc,
    tauxEURUSD: scenario.tauxEURUSD,
    boSCtWc: scenario.boSCtWc,
    raccordementOuvrageKEuro: scenario.raccordementOuvrageKEuro,
    tarifQPKEuroPerMW: scenario.tarifQPKEuroPerMW,
    apportAffaireMode: scenario.apportAffaireMode,
    apportAffaireValeur: scenario.apportAffaireValeur,
    opex: scenario.opex,
    omFixedEuroKwc: scenario.omFixedEuroKwc,
    mraEuroKwc: scenario.mraEuroKwc,
    backOfficeKeuro: scenario.backOfficeKeuro,
    diversOpexKeuro: scenario.diversOpexKeuro,
    loyerMode: scenario.loyerMode,
    loyerValeur: scenario.loyerValeur,
    loyerInflation: scenario.loyerInflation,
    inflationOM: scenario.inflationOM,
    inflationMRA: scenario.inflationMRA,
    inflationBackOffice: scenario.inflationBackOffice,
    inflationDivers: scenario.inflationDivers,
    methodeTaxes: scenario.methodeTaxes,
    // Méthode TF/CFE Phase 3 (tranche 4) : sélecteur d'assiette AUTO (prix d'achat terrain) +
    // override + taux département. null partout → branche taxes legacy inchangée ; la série
    // routée tfKeuroByYear/cfeKeuroByYear garde de toute façon la priorité absolue.
    prixAchatTerrainEuro: scenario.prixAchatTerrainEuro,
    methodeAssiette: scenario.methodeAssiette,
    tauxTFDepartement: scenario.tauxTFDepartement,
    tauxTFCommune: scenario.tauxTFCommune,
    tauxTFEPCI: scenario.tauxTFEPCI,
    tauxTSE: scenario.tauxTSE,
    tauxGEMAPI: scenario.tauxGEMAPI,
    tauxTEOM: scenario.tauxTEOM,
    tauxCFECommune: scenario.tauxCFECommune,
    tauxCFEEPCI: scenario.tauxCFEEPCI,
    tauxCCI: scenario.tauxCCI,
    prixTerrainHa: scenario.prixTerrainHa,
    abattTerrain: scenario.abattTerrain,
    inflationTaxes: scenario.inflationTaxes,
    iferRate1: scenario.iferRate1,
    iferRate2: scenario.iferRate2,
    iferRpn: scenario.iferRpn,
    inflationAurora: scenario.inflationAurora,
    yieldMwh: scenario.yieldMwh,
    yieldP90Mwh: scenario.yieldP90Mwh,
    tariff: scenario.tariff,
    debtRate: scenario.debtRate,
    projectLifeYears: scenario.projectLifeYears,
    degradationRate: scenario.degradationRate,
    discountRate: scenario.discountRate,
    debtInterestRate: scenario.debtInterestRate,
    debtMaturityYears: scenario.debtMaturityYears,
    tariffInflationRate: scenario.tariffInflationRate,
    opexInflationRate: scenario.opexInflationRate,
    contractDuration: scenario.contractDuration,
    constructionYears: scenario.constructionYears,
    assuranceRate: scenario.assuranceRate,
    inflationAssurance: scenario.inflationAssurance,
    balancingCost: scenario.balancingCost,
    dscrTarget: scenario.dscrTarget,
    debtTenorYears: scenario.debtTenorYears,
    dscrSchedule: parseDscrSchedule(scenario.dscrSchedule),
    gearingMaxPct: scenario.gearingMaxPct,
    tauxIS: scenario.tauxIS,
    amortDuree: scenario.amortDuree,
    dsraMonths: scenario.dsraMonths,
    devFeesKEuroPerMW: scenario.devFeesKEuroPerMW,
    tauxISEntreprise: scenario.tauxISEntreprise,
    contingencyRate: scenario.contingencyRate,
    longueurModule: scenario.longueurModule,
    largeurModule: scenario.largeurModule,
    txAmenagementRate: scenario.txAmenagementRate,
    coefArcheo: scenario.coefArcheo,
    legalFeesKEuro: scenario.legalFeesKEuro,
    technicalDDKEuro: scenario.technicalDDKEuro,
    arrangerFeesRate: scenario.arrangerFeesRate,
    participantFeesRate: scenario.participantFeesRate,
    bankFeesPLTKEuroPerMW: scenario.bankFeesPLTKEuroPerMW,
    interimFinancingRate: scenario.interimFinancingRate,
    commitmentFeesRate: scenario.commitmentFeesRate,
    ccaRemunRate: scenario.ccaRemunRate,
    unavailability: scenario.unavailability,
    indemnitesImmoKeuro: scenario.indemnitesImmoKeuro,
    // Financing fees appliqués (item 11, Inp_Assumption r548 k€) : portés dans le CAPEX total et
    // NEUTRALISENT le recalcul par taux 7 composants. null → recalcul par taux inchangé.
    financingFeesKeuro: scenario.financingFeesKeuro,
    aleasOpexRate: scenario.aleasOpexRate,
    tauxTSECfe: scenario.tauxTSECfe,
    tauxGEMAPICfe: scenario.tauxGEMAPICfe,
    coefDegressif: scenario.coefDegressif,
    taxeFinaleSizingKeuro: scenario.taxeFinaleSizingKeuro,
    agentFeeAnnuelKeuro: scenario.agentFeeAnnuelKeuro,
    dsrfFeeRate: scenario.dsrfFeeRate,
    capacityCertificateMw: scenario.capacityCertificateMw ?? undefined,
    goStartYear: scenario.goStartYear ?? undefined,
    goPriceBase: scenario.goPriceBase ?? undefined,
    curveIndexAn1: scenario.curveIndexAn1,
    fonciereBienEuroWc: scenario.fonciereBienEuroWc,
    batimentsFonciersKeuro: scenario.batimentsFonciersKeuro,
    modRetraitementKeuro: scenario.modRetraitementKeuro,
    valeurTerrainKeuro: scenario.valeurTerrainKeuro,
    capacityPriceCurve: CAPACITY_PRICE_CURVE,
  };
}

/**
 * VAN BRUTE / NETTE du BP — l'indicateur VAN PRINCIPAL de l'appli (la brute), calé sur les cibles
 * BP (data/cibles/*.json, vérifié sur les 25 projets). Composition = pure composition de sorties
 * moteur DÉJÀ exposées (aucune modif d'engine.ts) :
 *
 *   VAN brute = VAN des flux EQUITY actualisés à discountRate (= metrics.investorNpv)
 *             + D  (réintégration de la marge MOD = modRetraitement × (1 − IS)).
 *   VAN nette = VAN brute − E  (retrait du coût de dev / dev fees = modRetraitement × (1 − IS)).
 *
 * D et E dérivent tous deux du même montant MOD (modRetraitementKeuro, à défaut devFees =
 * devFeesKEuroPerMW × MW) : c'est ce que reproduit `E = vanBrute − vanNette` sur les 25 cibles
 * (preuve : Aérodrome, devFees=0 mais E=629,5 = modRetr 839,3 × 0,75). Numériquement VAN nette =
 * metrics.investorNpv. Les deux réintégrations sont posées à la date d'investissement (non
 * actualisées : elles réduisent/majorent la mise en an0).
 *
 * Responsivité : investorNpv réagit aux flux equity (stress test, leviers) ; modRetraitement/IS
 * réagissent aux leviers de coût. Résiduel vs cible BP = écart de calibration des flux equity
 * (démantèlement an25-30 non modélisé, timing-IS) — documenté par projet (flags des cibles).
 */
export function computeVanBruteNetteKeuro(
  metrics: FinanceEngineResult,
  input: FinanceEngineInput,
): { vanBruteKeuro: number; vanNetteKeuro: number } {
  const isFactor = 1 - Math.max(0, input.tauxIS ?? 0) / 100;
  const modKeuro =
    input.modRetraitementKeuro ?? (input.devFeesKEuroPerMW ?? 0) * input.capacityMw;
  const margeMODKeuro = modKeuro * isFactor; // D — marge MOD réintégrée (brute)
  const devFeesKeuro = modKeuro * isFactor; // E — coût de dev retiré (nette)
  const vanBruteKeuro = Math.round((metrics.investorNpv + margeMODKeuro) * 100) / 100;
  const vanNetteKeuro = Math.round((vanBruteKeuro - devFeesKeuro) * 100) / 100;
  return { vanBruteKeuro, vanNetteKeuro };
}

/** Métriques + structure de financement dérivée (dette / CCA / gearing / CAPEX), en k€. */
export type ProjectFinance = {
  metrics: FinanceEngineResult;
  /** CAPEX calibration = CAPEX détaillé + frais de financement (== cible BP « capexTotalKeuro »). */
  capexCalibKeuro: number;
  /** CAPEX effectif financé = CAPEX calibration + marge facturable (== dette + CCA). */
  capexEffectifKeuro: number;
  debtRetenuKeuro: number;
  ccaKeuro: number;
  gearingPct: number | null;
  /** VAN BRUTE (indicateur VAN principal, cible BP `vanBruteKeuro`). Cf computeVanBruteNetteKeuro. */
  vanBruteKeuro: number;
  /** VAN NETTE (secondaire, cible BP `vanNetteKeuro`) = VAN brute − dev fees. */
  vanNetteKeuro: number;
  /**
   * VAN brute rapportée à la puissance installée (k€/MWc) = vanBruteKeuro / capacityMw.
   * Indicateur de densité économique comparable entre projets. null si capacité ≤ 0.
   */
  vanBruteParMWcKeuro: number | null;
  /**
   * TRI projet BRUT (non-levier / unlevered), calé sur le BP (cible `trIProjetBrutPct`,
   * C_P50 r383 → Inp_Assumption r53). Repris tel quel de metrics.projectIrr. En %.
   */
  projectIrr: number;
};

/**
 * Point d'entrée unique : reconstruit l'input, calcule les métriques moteur et la structure de
 * financement dérivée (comme la page détail et calibrate_all). Lecture seule, aucune écriture DB.
 */
export function computeProjectFinance(
  project: ProjectFinanceFields,
  scenario: Scenario,
): ProjectFinance {
  return computeFinanceFromInput(buildFinanceInput(project, scenario));
}

/**
 * Variante « input direct » : calcule les métriques + structure de financement à partir d'un
 * FinanceEngineInput DÉJÀ construit (utilisée par le stress test portefeuille, qui perturbe l'input
 * avant recalcul). Logique STRICTEMENT identique à computeProjectFinance (source unique).
 */
export function computeFinanceFromInput(input: FinanceEngineInput): ProjectFinance {
  const metrics = calculateScenarioMetrics(input);
  const capexTotalKeuro = calculateCapexDetails(input).capexTotalKeuro;
  const capexCalibKeuro = capexTotalKeuro + metrics.financingFeesKeuro;
  const margeFactKeuro = metrics.sizing?.margeFactKeuro ?? 0;
  const capexEffectifKeuro = capexCalibKeuro + margeFactKeuro;
  const debtRetenuKeuro = metrics.sizing?.debtRetenuKeuro ?? 0;
  const ccaKeuro = Math.max(0, capexEffectifKeuro - debtRetenuKeuro);
  const gearingPct =
    metrics.sizing?.gearingActuel != null ? metrics.sizing.gearingActuel * 100 : null;
  const { vanBruteKeuro, vanNetteKeuro } = computeVanBruteNetteKeuro(metrics, input);
  const vanBruteParMWcKeuro =
    input.capacityMw > 0 ? Math.round((vanBruteKeuro / input.capacityMw) * 100) / 100 : null;
  return {
    metrics,
    capexCalibKeuro,
    capexEffectifKeuro,
    debtRetenuKeuro,
    ccaKeuro,
    gearingPct,
    vanBruteKeuro,
    vanNetteKeuro,
    vanBruteParMWcKeuro,
    projectIrr: metrics.projectIrr,
  };
}

/** Scénario de référence (isReference) ou, à défaut, le premier. */
export function pickReferenceScenario(scenarios: Scenario[]): Scenario | undefined {
  return scenarios.find((s) => s.isReference) ?? scenarios[0];
}
