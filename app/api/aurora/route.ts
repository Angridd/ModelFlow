import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";

type AuroraTechnology = "fixed" | "tracking";
type ScenarioName = "Central" | "High" | "Low";
type ImportedCurve = Record<number, number>;

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
    row.some((cell) => normalizeCell(cell).includes("uncurtailed capture price")),
  );

  if (sectionRowIndex < 0) {
    throw new Error(
      `Section "Uncurtailed capture price" introuvable dans l'onglet ${sheetName}.`,
    );
  }

  const targetLabel = technology === "fixed" ? "fixed solar pv" : "tracking solar pv";
  const targetRow = rows
    .slice(sectionRowIndex + 1)
    .find((row) => row.some((cell) => normalizeCell(cell).includes(targetLabel)));

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

export async function POST(request: Request) {
  try {
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

    const updatedAt = new Date();

    await prisma.$transaction(
      years.map((year) =>
        prisma.auroraCurve.upsert({
          where: { year },
          create: {
            year,
            central: curves.Central[year],
            high: curves.High[year],
            low: curves.Low[year],
            technology,
            updatedAt,
          },
          update: {
            central: curves.Central[year],
            high: curves.High[year],
            low: curves.Low[year],
            technology,
            updatedAt,
          },
        }),
      ),
    );

    revalidatePath("/projects");
    revalidatePath("/projects/[id]", "page");

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
