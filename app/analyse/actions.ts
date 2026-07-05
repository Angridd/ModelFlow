"use server";

/**
 * Sensibilité À LA DEMANDE (tornado) pour un projet donné — évite ~250 recalculs au chargement.
 * Chaque variable est perturbée de ±10 % sur le FinanceEngineInput reconstruit, puis le moteur
 * (non modifié) est ré-exécuté pour lire TRI investisseur + VAN nette.
 */
import type { TornadoRow, TornadoVariable } from "@/app/lib/analysis";
import {
  calculateScenarioMetrics,
  type FinanceEngineInput,
} from "@/app/lib/finance/engine";
import { buildFinanceInput } from "@/app/lib/scenarioMetrics";
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

  const variables: TornadoVariable[] = ["tariff", "capex", "yield", "debtRate", "merchant"];
  const rows = variables.map((variable): TornadoRow => {
    const low = calculateScenarioMetrics(perturb(base, variable, 1 - DELTA));
    const high = calculateScenarioMetrics(perturb(base, variable, 1 + DELTA));
    return {
      variable,
      label: LABELS[variable],
      baseIrr: baseM.investorIrr,
      lowIrr: low.investorIrr,
      highIrr: high.investorIrr,
      baseNpv: baseM.npv,
      lowNpv: low.npv,
      highNpv: high.npv,
    };
  });

  // Tri par amplitude d'impact TRI décroissante (tornado).
  rows.sort(
    (a, b) =>
      Math.abs(b.highIrr - b.lowIrr) - Math.abs(a.highIrr - a.lowIrr),
  );
  return rows;
}
