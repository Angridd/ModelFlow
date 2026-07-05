import { notFound } from "next/navigation";
import { buildBpWorkbookBuffer } from "@/app/lib/bpExcel";
import { pickReferenceScenario } from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function slugifyFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Export Excel du modèle BP (Option A : mise en page BP + valeurs figées), un projet à la fois.
 * Réutilise le scénario de référence (comme la page /bp et la fiche projet).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scenarios: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const scenario = pickReferenceScenario(project.scenarios);

  if (!scenario) {
    return new Response("Aucun scénario disponible pour ce projet — export impossible.", {
      status: 404,
    });
  }

  const buffer = buildBpWorkbookBuffer(project, scenario);
  const filename = `${slugifyFilename(project.name) || "projet"}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
