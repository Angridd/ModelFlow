import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";

const headers = [
  "Projet",
  "Scénario",
  "CAPEX",
  "OPEX",
  "Productible",
  "Tarif",
  "Dette",
  "DSCR",
  "VAN",
  "TRI",
  "LCOE",
];

function csvCell(value: string | number) {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function slugifyFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  const rows = project.scenarios.map((scenario) => [
    project.name,
    scenario.name,
    scenario.capex,
    scenario.opex,
    scenario.yieldMwh,
    scenario.tariff,
    scenario.debtRate,
    scenario.dscr,
    scenario.npv,
    scenario.irr,
    scenario.lcoe,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const filenameProject = slugifyFilename(project.name) || "projet";
  const filename = `modelflow-${filenameProject}-scenarios.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
