/**
 * Orchestration SERVEUR de l'analyse : c'est ici (et seulement ici) qu'on appelle le moteur
 * (app/lib/finance/engine.ts, NON modifié). On :
 *   1. décompose CAPEX (calculateCapexDetails) + OPEX an-1 (calculateOpexDetails) par projet,
 *   2. reconstruit les métriques consolidées (computeProjectFinance),
 *   3. chiffre les leviers en ré-exécutant le moteur avec l'override retourné par analysis.ts.
 *
 * Aucune écriture DB. Aucune modification de la logique de calcul.
 */
import type { Project, Scenario } from "@/app/generated/prisma/client";
import {
  ANOMALY_RATIO,
  buildLeverPlan,
  computePosteStats,
  detectAnomalies,
  type Anomaly,
  type LeverResult,
  type ProjectAnalysis,
} from "@/app/lib/analysis";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateOpexDetails,
  calculateScenarioMetrics,
  type FinanceEngineInput,
} from "@/app/lib/finance/engine";
import {
  buildFinanceInput,
  computeProjectFinance,
  computeVanBruteNetteKeuro,
} from "@/app/lib/scenarioMetrics";

type ProjectWithScenarios = Project & { scenarios: Scenario[] };

/** Base + input moteur d'un projet, gardés côté serveur pour recalculer les leviers. */
type ProjectBundle = {
  analysis: ProjectAnalysis;
  input: FinanceEngineInput;
  /** VAN BRUTE de base (référence des ΔVAN leviers). */
  baseVanBruteKeuro: number;
  baseInvestorIrr: number;
};

/** OPEX an-1 : revenu/production de la 1re année d'exploitation (year === 1). */
function opexAn1Keuro(input: FinanceEngineInput): number {
  const rows = calculateAnnualCashFlows(input);
  const y1 = rows.find((r) => r.year === 1) ?? rows[0];
  if (!y1) return 0;
  return calculateOpexDetails(input, 1, y1.revenueP50Keuro, y1.productionP50Mwh).opexTotalKeuro;
}

/** Construit le bundle d'analyse d'un projet (décomposition postes + métriques + input moteur). */
export function buildProjectBundle(
  project: ProjectWithScenarios,
  scenario: Scenario,
): ProjectBundle {
  const input = buildFinanceInput(project, scenario);
  const finance = computeProjectFinance(project, scenario);
  const capex = calculateCapexDetails(input);
  const opexTotal = opexAn1Keuro(input);
  const opex1 = (() => {
    const rows = calculateAnnualCashFlows(input);
    const y1 = rows.find((r) => r.year === 1) ?? rows[0];
    return y1
      ? calculateOpexDetails(input, 1, y1.revenueP50Keuro, y1.productionP50Mwh)
      : null;
  })();

  const analysis: ProjectAnalysis = {
    metrics: {
      id: project.id,
      name: project.name,
      technology: project.technology,
      region: project.region,
      country: project.country,
      capacityMw: project.capacityMw,
      commissioningYear: project.commissioningYear,
      investorIrr: finance.metrics.investorIrr,
      projectIrr: finance.projectIrr,
      vanBruteKeuro: finance.vanBruteKeuro,
      vanNetteKeuro: finance.vanNetteKeuro,
      vanBruteParMWcKeuro: finance.vanBruteParMWcKeuro,
      debtKeuro: finance.debtRetenuKeuro,
      ccaKeuro: finance.ccaKeuro,
      capexEffectifKeuro: finance.capexEffectifKeuro,
      opexAn1Keuro: opexTotal,
      gearingPct: finance.gearingPct,
      dscr: finance.metrics.dscr,
    },
    postes: {
      capex: {
        modules: capex.modulesKeuro,
        bos: capex.boSKeuro,
        raccordement: capex.raccordementKeuro,
        mod: capex.devFeesKeuro,
        foncier: capex.taxesFoncieresKeuro + capex.indemnitesImmoKeuro,
        contingency: capex.contingencyKeuro,
        apport: capex.apportAffaireKeuro,
        // Frais de financement RÉELS : override « valeur appliquée BP » (item 11, porté par
        // capexDetails) OU recalcul par taux (metrics) — exactement UN des deux est non nul.
        financing: capex.financingFeesKeuro + finance.metrics.financingFeesKeuro,
      },
      opex: {
        om: opex1?.omKeuro ?? 0,
        mra: opex1?.mraKeuro ?? 0,
        loyer: opex1?.loyerKeuro ?? 0,
        assurance: opex1?.assuranceKeuro ?? 0,
        ifer: opex1?.iferKeuro ?? 0,
        balancing: opex1?.balancingKeuro ?? 0,
        taxes: (opex1?.tfKeuro ?? 0) + (opex1?.cfeKeuro ?? 0),
        backoffice: opex1?.backOfficeKeuro ?? 0,
        divers: opex1?.diversKeuro ?? 0,
        aleas: opex1?.aleasKeuro ?? 0,
      },
    },
  };

  return {
    analysis,
    input,
    baseVanBruteKeuro: finance.vanBruteKeuro,
    baseInvestorIrr: finance.metrics.investorIrr,
  };
}

export type PortfolioAnalysis = {
  projects: ProjectAnalysis[];
  anomalies: Anomaly[];
  levers: LeverResult[];
};

/**
 * Point d'entrée serveur : décompose les projets, détecte les anomalies et chiffre les leviers
 * (recalcul moteur UNIQUEMENT pour les postes signalés — pas des centaines de recalculs).
 */
export function buildPortfolioAnalysis(
  projects: ProjectWithScenarios[],
): PortfolioAnalysis {
  const bundles = new Map<string, ProjectBundle>();
  for (const project of projects) {
    const scenario = project.scenarios.find((s) => s.isReference) ?? project.scenarios[0];
    if (!scenario) continue;
    bundles.set(project.id, buildProjectBundle(project, scenario));
  }

  const analyses = Array.from(bundles.values()).map((b) => b.analysis);
  const stats = computePosteStats(analyses);
  const anomalies = detectAnomalies(analyses);

  // Leviers : seulement pour les anomalies détectées (perf). Recalcul moteur ciblé.
  const levers: LeverResult[] = anomalies.map((a) => {
    const bundle = bundles.get(a.projectId);
    const st = stats.get(a.poste.key);
    const targetKeuro = st ? st.median * a.capacityMw : a.keuro;
    const savingKeuro = Math.max(0, a.keuro - targetKeuro);

    if (!bundle) {
      return {
        projectId: a.projectId,
        projectName: a.projectName,
        poste: a.poste,
        savingKeuro,
        deviationPct: a.deviationPct,
        deltaVanKeuro: null,
        deltaIrrPp: null,
        approximate: false,
        indicative: true,
      };
    }

    const plan = buildLeverPlan(a.poste.key, bundle.input, a.keuro, targetKeuro);
    if (plan.kind === "indicative") {
      return {
        projectId: a.projectId,
        projectName: a.projectName,
        poste: a.poste,
        savingKeuro,
        deviationPct: a.deviationPct,
        deltaVanKeuro: null,
        deltaIrrPp: null,
        approximate: false,
        indicative: true,
      };
    }

    const perturbed: FinanceEngineInput = { ...bundle.input, ...plan.override };
    const m = calculateScenarioMetrics(perturbed);
    const vanBrutePerturbed = computeVanBruteNetteKeuro(m, perturbed).vanBruteKeuro;
    return {
      projectId: a.projectId,
      projectName: a.projectName,
      poste: a.poste,
      savingKeuro,
      deviationPct: a.deviationPct,
      deltaVanKeuro: vanBrutePerturbed - bundle.baseVanBruteKeuro,
      deltaIrrPp: m.investorIrr - bundle.baseInvestorIrr,
      approximate: plan.approximate,
      indicative: false,
    };
  });

  // Tri par gain VAN décroissant (indicatifs — sans VAN — rejetés en fin, triés par Δcoût).
  levers.sort((a, b) => {
    const av = a.deltaVanKeuro;
    const bv = b.deltaVanKeuro;
    if (av !== null && bv !== null) return bv - av;
    if (av !== null) return -1;
    if (bv !== null) return 1;
    return b.savingKeuro - a.savingKeuro;
  });

  return { projects: analyses, anomalies, levers };
}

export { ANOMALY_RATIO };
