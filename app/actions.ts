"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";

const scenarioImportColumns = {
  name: "scenario",
  capex: "capex",
  opex: "opex",
  yieldMwh: "productible",
  tariff: "tarif",
  debtRate: "dette",
  dscr: "dscr",
  npv: "van",
  irr: "tri",
  lcoe: "lcoe",
} as const;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Le champ ${key} est requis.`);
  }

  return value.trim();
}

function readNumber(formData: FormData, key: string) {
  const rawValue = readText(formData, key);
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Le champ ${key} doit etre un nombre.`);
  }

  return value;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function parseImportedNumber(value: string, key: string) {
  const compactValue = value.trim().replace(/\s|\u00a0/g, "");
  const lastComma = compactValue.lastIndexOf(",");
  const lastDot = compactValue.lastIndexOf(".");
  let normalizedValue = compactValue;

  if (lastComma >= 0 && lastDot >= 0) {
    normalizedValue =
      lastComma > lastDot
        ? compactValue.replaceAll(".", "").replace(",", ".")
        : compactValue.replaceAll(",", "");
  } else {
    normalizedValue = compactValue.replace(",", ".");
  }

  const number = Number(normalizedValue);

  if (!Number.isFinite(number)) {
    throw new Error(`La colonne ${key} doit etre un nombre.`);
  }

  return number;
}

export async function createProject(formData: FormData) {
  await prisma.project.create({
    data: {
      name: readText(formData, "name"),
      technology: readText(formData, "technology"),
      country: readText(formData, "country"),
      capacityMw: readNumber(formData, "capacityMw"),
      status: readText(formData, "status"),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createScenario(projectId: string, formData: FormData) {
  await prisma.scenario.create({
    data: {
      name: readText(formData, "name"),
      capex: readNumber(formData, "capex"),
      opex: readNumber(formData, "opex"),
      yieldMwh: readNumber(formData, "yieldMwh"),
      tariff: readNumber(formData, "tariff"),
      debtRate: readNumber(formData, "debtRate"),
      dscr: readNumber(formData, "dscr"),
      npv: readNumber(formData, "npv"),
      irr: readNumber(formData, "irr"),
      lcoe: readNumber(formData, "lcoe"),
      projectId,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteScenario(projectId: string, scenarioId: string) {
  await prisma.scenario.deleteMany({
    where: {
      id: scenarioId,
      projectId,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function importScenarios(projectId: string, formData: FormData) {
  const file = formData.get("csv");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Un fichier CSV est requis.");
  }

  const rows = parseCsv(await file.text()).filter((row) =>
    row.some((cell) => cell.trim() !== ""),
  );

  if (rows.length < 2) {
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}`);
  }

  const headerIndexes = new Map(
    rows[0].map((header, index) => [normalizeHeader(header), index]),
  );

  const importedScenarios = rows.slice(1).map((row) => {
    const readColumn = (column: string) => {
      const index = headerIndexes.get(column);

      if (index === undefined) {
        throw new Error(`La colonne ${column} est requise.`);
      }

      return row[index]?.trim() ?? "";
    };

    const name = readColumn(scenarioImportColumns.name);

    if (name === "") {
      throw new Error("La colonne Scenario est requise.");
    }

    return {
      name,
      capex: parseImportedNumber(readColumn(scenarioImportColumns.capex), "CAPEX"),
      opex: parseImportedNumber(readColumn(scenarioImportColumns.opex), "OPEX"),
      yieldMwh: parseImportedNumber(
        readColumn(scenarioImportColumns.yieldMwh),
        "Productible",
      ),
      tariff: parseImportedNumber(readColumn(scenarioImportColumns.tariff), "Tarif"),
      debtRate: parseImportedNumber(readColumn(scenarioImportColumns.debtRate), "Dette"),
      dscr: parseImportedNumber(readColumn(scenarioImportColumns.dscr), "DSCR"),
      npv: parseImportedNumber(readColumn(scenarioImportColumns.npv), "VAN"),
      irr: parseImportedNumber(readColumn(scenarioImportColumns.irr), "TRI"),
      lcoe: parseImportedNumber(readColumn(scenarioImportColumns.lcoe), "LCOE"),
      projectId,
    };
  });

  if (importedScenarios.length > 0) {
    await prisma.scenario.createMany({
      data: importedScenarios,
    });
  }

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
