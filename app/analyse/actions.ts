"use server";

/**
 * Sensibilité À LA DEMANDE (tornado) pour un projet donné — évite ~250 recalculs au chargement.
 * Chaque variable est perturbée de ±10 % sur le FinanceEngineInput reconstruit, puis le moteur
 * (non modifié) est ré-exécuté pour lire TRI investisseur + VAN nette.
 */
import {
  applyStressDeltas,
  classifyHealth,
  IRR_CRITICAL_PCT,
  median,
  type PortfolioStressProjectRow,
  type PortfolioStressResult,
  type StressDeltas,
  type TornadoRow,
  type TornadoVariable,
} from "@/app/lib/analysis";
import {
  calculateScenarioMetrics,
  type FinanceEngineInput,
} from "@/app/lib/finance/engine";
import {
  buildFinanceInput,
  computeFinanceFromInput,
  computeVanBruteNetteKeuro,
  pickReferenceScenario,
} from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

const DELTA = 0.1;

const LABELS: Record<TornadoVariable, string> = {
  tariff: "Tarif (−10 % / +10 %)",
  capex: "CAPEX (−10 % / +10 %)",
  yield: "Productible (−10 % / +10 %)",
  debtRate: "Taux de dette (−10 % / +10 %)",
  merchant: "Prix merchant (−10 % / +10 %)",
};

function scaleField(
  input: FinanceEngineInput,
  field: keyof FinanceEngineInput,
  factor: number,
): Partial<FinanceEngineInput> {
  const v = input[field];
  if (typeof v === "number" && Number.isFinite(v)) {
    return { [field]: v * factor } as Partial<FinanceEngineInput>;
  }
  return {};
}

/** Applique la perturbation `factor` (0,9 ou 1,1) d'une variable → override moteur. */
function perturb(
  input: FinanceEngineInput,
  variable: TornadoVariable,
  factor: number,
): FinanceEngineInput {
  switch (variable) {
    case "tariff":
      return { ...input, ...scaleField(input, "tariff", factor) };
    case "yield":
      return {
        ...input,
        ...scaleField(input, "yieldMwh", factor),
        ...scaleField(input, "yieldP90Mwh", factor),
      };
    case "debtRate":
      return { ...input, ...scaleField(input, "debtInterestRate", factor) };
    case "capex":
      return {
        ...input,
        ...scaleField(input, "capex", factor),
        ...scaleField(input, "prixModuleUSDWc", factor),
        ...scaleField(input, "boSCtWc", factor),
        ...scaleField(input, "raccordementOuvrageKEuro", factor),
        ...scaleField(input, "tarifQPKEuroPerMW", factor),
        ...scaleField(input, "devFeesKEuroPerMW", factor),
        ...scaleField(input, "apportAffaireValeur", factor),
        ...scaleField(input, "indemnitesImmoKeuro", factor),
      };
    case "merchant":
      return {
        ...input,
        auroraCurves:
          input.auroraCurves?.map((c) => ({
            year: c.year,
            high: c.high * factor,
            central: c.central * factor,
            low: c.low * factor,
          })) ?? input.auroraCurves,
      };
    default: {
      const _never: never = variable;
      return _never;
    }
  }
}

export async function computeTornado(projectId: string): Promise<TornadoRow[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { scenarios: true },
  });
  if (!project) return [];
  const scenario = project.scenarios.find((s) => s.isReference) ?? project.scenarios[0];
  if (!scenario) return [];

  const base = buildFinanceInput(project, scenario);
  const baseM = calculateScenarioMetrics(base);

  // baseNpv/lowNpv/highNpv portent la VAN BRUTE (indicateur principal).
  const baseVanBrute = computeVanBruteNetteKeuro(baseM, base).vanBruteKeuro;
  const variables: TornadoVariable[] = ["tariff", "capex", "yield", "debtRate", "merchant"];
  const rows = variables.map((variable): TornadoRow => {
    const lowInput = perturb(base, variable, 1 - DELTA);
    const highInput = perturb(base, variable, 1 + DELTA);
    const low = calculateScenarioMetrics(lowInput);
    const high = calculateScenarioMetrics(highInput);
    return {
      variable,
      label: LABELS[variable],
      baseIrr: baseM.investorIrr,
      lowIrr: low.investorIrr,
      highIrr: high.investorIrr,
      baseNpv: baseVanBrute,
      lowNpv: computeVanBruteNetteKeuro(low, lowInput).vanBruteKeuro,
      highNpv: computeVanBruteNetteKeuro(high, highInput).vanBruteKeuro,
    };
  });

  // Tri par amplitude d'impact TRI décroissante (tornado).
  rows.sort(
    (a, b) =>
      Math.abs(b.highIrr - b.lowIrr) - Math.abs(a.highIrr - a.lowIrr),
  );
  return rows;
}

/**
 * STRESS TEST PORTEFEUILLE — applique un choc UNIFORME (deltas) sur les 25 projets « bp_reel » à la
 * fois et renvoie l'impact agrégé + par projet. Recompute À LA DEMANDE (~25 recalculs par clic) :
 * pour chaque projet on reconstruit le FinanceEngineInput (même chemin que le reste), on perturbe
 * les inputs (applyStressDeltas — moteur non modifié) puis on relit métriques + financement.
 */
export async function computePortfolioStress(
  deltas: StressDeltas,
): Promise<PortfolioStressResult> {
  const projects = await prisma.project.findMany({
    where: { status: "bp_reel" },
    include: { scenarios: true },
  });

  const rows: PortfolioStressProjectRow[] = [];
  const baseIrrs: number[] = [];
  const stressIrrs: number[] = [];
  let baseNpvTotal = 0;
  let stressNpvTotal = 0;
  let baseDebtTotal = 0;
  let stressDebtTotal = 0;
  let baseEquityTotal = 0;
  let stressEquityTotal = 0;
  let baseAboveThreshold = 0;
  let stressAboveThreshold = 0;

  for (const project of projects) {
    const scenario = pickReferenceScenario(project.scenarios);
    if (!scenario) continue;

    const input = buildFinanceInput(project, scenario);
    const base = computeFinanceFromInput(input);
    const stress = computeFinanceFromInput(applyStressDeltas(input, deltas));

    const baseHealth = classifyHealth({
      vanBruteKeuro: base.vanBruteKeuro,
      investorIrr: base.metrics.investorIrr,
      gearingPct: base.gearingPct,
      dscr: base.metrics.dscr,
    });
    const stressHealth = classifyHealth({
      vanBruteKeuro: stress.vanBruteKeuro,
      investorIrr: stress.metrics.investorIrr,
      gearingPct: stress.gearingPct,
      dscr: stress.metrics.dscr,
    });

    // baseNpv/stressNpv/totaux portent la VAN BRUTE (indicateur principal).
    rows.push({
      id: project.id,
      name: project.name,
      capacityMw: project.capacityMw,
      baseIrr: base.metrics.investorIrr,
      stressIrr: stress.metrics.investorIrr,
      baseNpv: base.vanBruteKeuro,
      stressNpv: stress.vanBruteKeuro,
      baseHealth,
      stressHealth,
    });

    baseIrrs.push(base.metrics.investorIrr);
    stressIrrs.push(stress.metrics.investorIrr);
    baseNpvTotal += base.vanBruteKeuro;
    stressNpvTotal += stress.vanBruteKeuro;
    baseDebtTotal += base.debtRetenuKeuro;
    stressDebtTotal += stress.debtRetenuKeuro;
    baseEquityTotal += base.ccaKeuro;
    stressEquityTotal += stress.ccaKeuro;
    if (base.metrics.investorIrr >= IRR_CRITICAL_PCT) baseAboveThreshold += 1;
    if (stress.metrics.investorIrr >= IRR_CRITICAL_PCT) stressAboveThreshold += 1;
  }

  // Tri par ΔVAN croissante : les plus dégradés (Δ le plus négatif) en tête.
  rows.sort((a, b) => (a.stressNpv - a.baseNpv) - (b.stressNpv - b.baseNpv));

  return {
    deltas,
    rows,
    aggregate: {
      projectCount: rows.length,
      baseNpvTotal,
      stressNpvTotal,
      baseIrrMedian: median(baseIrrs),
      stressIrrMedian: median(stressIrrs),
      baseDebtTotal,
      stressDebtTotal,
      baseEquityTotal,
      stressEquityTotal,
      baseAboveThreshold,
      stressAboveThreshold,
    },
  };
}
