import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";

type AuroraTechnology = "fixed" | "tracking";
type ScenarioName = "Central" | "High" | "Low";
type ImportedCurve = Record<number, number>;

const sheetNames: ScenarioName[] = ["Central", "High", "Low"];

function normalizeCell(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const number = Number(value.trim().replace(/\s|\u00a0/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function readWeight(formData: FormData, key: string, fallback: number) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`La ponderation ${key} doit etre un nombre.`);
  }

  return number / 100;
}

function extractYears(rows: unknown[][], sheetName: string) {
  let best: Array<{ index: number; year: number }> = [];

  rows.forEach((row) => {
    const years = row.flatMap((cell, index) => {
      const number = parseNumber(cell);
      const year = number !== null ? Math.trunc(number) : NaN;

      return year >= 2026 && year <= 2060 ? [{ index, year }] : [];
    });

    if (years.length > best.length) {
      best = years;
    }
  });

  if (best.length === 0) {
    throw new Error(`Aucune colonne annee 2026-2060 trouvee dans l'onglet ${sheetName}.`);
  }

  return best;
}

function extractSheetCurve(
  workbook: XLSX.WorkBook,
  sheetName: ScenarioName,
  technology: AuroraTechnology,
): ImportedCurve {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Onglet Aurora introuvable : ${sheetName}.`);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const yearColumns = extractYears(rows, sheetName);
  const sectionRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeCell(cell) === "uncurtailed capture price"),
  );

  if (sectionRowIndex < 0) {
    throw new Error(
      `Section "Uncurtailed capture price" introuvable dans l'onglet ${sheetName}.`,
    );
  }

  const targetLabel =
    technology === "fixed" ? "fixed solar pv" : "tracking solar pv";
  const targetRow = rows
    .slice(sectionRowIndex + 1)
    .find((row) => row.some((cell) => normalizeCell(cell) === targetLabel));

  if (!targetRow) {
    throw new Error(
      `Ligne "${technology === "fixed" ? "Fixed solar PV" : "Tracking solar PV"}" introuvable dans la section "Uncurtailed capture price" de l'onglet ${sheetName}.`,
    );
  }

  const curve: ImportedCurve = {};

  yearColumns.forEach(({ index, year }) => {
    const value = parseNumber(targetRow[index]);

    if (value !== null) {
      curve[year] = value;
    }
  });

  if (Object.keys(curve).length === 0) {
    throw new Error(`Aucun prix exploitable trouve dans l'onglet ${sheetName}.`);
  }

  return curve;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const technology = formData.get("technology");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Un fichier Excel Aurora .xlsx est requis." },
        { status: 400 },
      );
    }

    if (technology !== "fixed" && technology !== "tracking") {
      return NextResponse.json(
        { success: false, error: "La technologie doit etre fixed ou tracking." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Projet introuvable." },
        { status: 404 },
      );
    }

    const debtSizingCentralW = readWeight(formData, "debtSizingCentralW", 70);
    const debtSizingLowW = readWeight(formData, "debtSizingLowW", 30);
    const investorCurveW = readWeight(formData, "investorCurveW", 100);

    if (Math.round((debtSizingCentralW + debtSizingLowW) * 10000) !== 10000) {
      return NextResponse.json(
        { success: false, error: "Central + Low doit etre egal a 100 %." },
        { status: 400 },
      );
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const curves = {
      Central: extractSheetCurve(workbook, "Central", technology),
      High: extractSheetCurve(workbook, "High", technology),
      Low: extractSheetCurve(workbook, "Low", technology),
    };
    const years = Object.keys(curves.Central)
      .map(Number)
      .filter((year) => curves.High[year] !== undefined && curves.Low[year] !== undefined)
      .sort((a, b) => a - b);

    if (years.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucune annee commune trouvee dans les onglets Central, High et Low.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      ...years.map((year) =>
        prisma.auroraCurve.upsert({
          where: { projectId_year: { projectId: id, year } },
          create: {
            projectId: id,
            year,
            central: curves.Central[year],
            high: curves.High[year],
            low: curves.Low[year],
          },
          update: {
            central: curves.Central[year],
            high: curves.High[year],
            low: curves.Low[year],
          },
        }),
      ),
      prisma.project.update({
        where: { id },
        data: {
          auroraUpdatedAt: new Date(),
          auroraTechnology: technology,
          debtSizingCentralW,
          debtSizingLowW,
          investorCurveW,
        },
      }),
    ]);

    revalidatePath(`/projects/${id}`);

    return NextResponse.json({ success: true, yearsImported: years.length });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import Aurora impossible.",
      },
      { status: 400 },
    );
  }
}
