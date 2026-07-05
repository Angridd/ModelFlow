import type { Scenario } from "@/app/generated/prisma/client";
import { buildPortfolioWorkbookBuffer } from "@/app/lib/bpExcel";
import { pickReferenceScenario } from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Export Excel du PORTEFEUILLE entier (mêmes projets « bp_reel » que le Dashboard/Analyse) :
 * un classeur unique = 1 onglet « Synthèse portefeuille » + 1 onglet modèle complet par projet.
 */
export async function GET() {
  const projects = await prisma.project.findMany({
    where: { status: "bp_reel" },
    include: {
      scenarios: true,
    },
    orderBy: { name: "asc" },
  });

  const entries = projects
    .map((project) => {
      const scenario = pickReferenceScenario(project.scenarios);
      return scenario ? { project, scenario } : null;
    })
    .filter((entry): entry is { project: (typeof projects)[number]; scenario: Scenario } => entry !== null);

  const buffer = buildPortfolioWorkbookBuffer(entries);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="modelflow-portefeuille.xlsx"`,
    },
  });
}
