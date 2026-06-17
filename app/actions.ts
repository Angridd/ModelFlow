"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateScenarioMetrics } from "@/app/lib/finance/engine";
import { DEFAULT_FINANCIAL_ASSUMPTIONS } from "@/app/lib/finance/types";
import { prisma } from "@/app/lib/prisma";

const scenarioImportColumns = {
  name: "scenario",
  capex: "capex",
  opex: "opex",
  yieldMwh: "productible",
  tariff: "tarif",
  debtRate: "dette",
  projectLifeYears: "duree projet",
  degradationRate: "degradation",
  discountRate: "taux actualisation",
  debtInterestRate: "taux dette",
  debtMaturityYears: "maturite dette",
  tariffInflationRate: "inflation tarif",
  opexInflationRate: "inflation opex",
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

function readInteger(formData: FormData, key: string) {
  const value = readNumber(formData, key);

  if (!Number.isInteger(value)) {
    throw new Error(`Le champ ${key} doit etre un entier.`);
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

function parseImportedInteger(value: string, key: string) {
  const number = parseImportedNumber(value, key);

  if (!Number.isInteger(number)) {
    throw new Error(`La colonne ${key} doit etre un entier.`);
  }

  return number;
}

function readScenarioAssumptions(formData: FormData) {
  return {
    capex: readNumber(formData, "capex"),
    opex: readNumber(formData, "opex"),
    yieldMwh: readNumber(formData, "yieldMwh"),
    tariff: readNumber(formData, "tariff"),
    debtRate: readNumber(formData, "debtRate"),
    projectLifeYears: readInteger(formData, "projectLifeYears"),
    degradationRate: readNumber(formData, "degradationRate"),
    discountRate: readNumber(formData, "discountRate"),
    debtInterestRate: readNumber(formData, "debtInterestRate"),
    debtMaturityYears: readInteger(formData, "debtMaturityYears"),
    tariffInflationRate: readNumber(formData, "tariffInflationRate"),
    opexInflationRate: readNumber(formData, "opexInflationRate"),
  };
}

export async function createProject(formData: FormData) {
  await prisma.project.create({
    data: {
      name: readText(formData, "name"),
      technology: readText(formData, "technology"),
      country: readText(formData, "country"),
      capacityMw: readNumber(formData, "capacityMw"),
      status: readText(formData, "status"),
      ao: readText(formData, "ao"),
      priority: readText(formData, "priority"),
      caseType: readText(formData, "caseType"),
      region: readText(formData, "region"),
      tariff: readNumber(formData, "tariff"),
      commissioningYear: readInteger(formData, "commissioningYear"),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProject(projectId: string, formData: FormData) {
  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name: readText(formData, "name"),
      technology: readText(formData, "technology"),
      country: readText(formData, "country"),
      capacityMw: readNumber(formData, "capacityMw"),
      status: readText(formData, "status"),
      ao: readText(formData, "ao"),
      priority: readText(formData, "priority"),
      caseType: readText(formData, "caseType"),
      region: readText(formData, "region"),
      tariff: readNumber(formData, "tariff"),
      commissioningYear: readInteger(formData, "commissioningYear"),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect("/projects");
}

export async function deleteProject(projectId: string) {
  await prisma.$transaction([
    prisma.scenario.deleteMany({
      where: {
        projectId,
      },
    }),
    prisma.project.deleteMany({
      where: {
        id: projectId,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createScenario(projectId: string, formData: FormData) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      capacityMw: true,
    },
  });

  if (!project) {
    redirect("/projects");
  }

  const assumptions = readScenarioAssumptions(formData);
  const calculatedMetrics = calculateScenarioMetrics({
    capacityMw: project.capacityMw,
    ...assumptions,
  });

  await prisma.scenario.create({
    data: {
      name: readText(formData, "name"),
      ...assumptions,
      dscr: calculatedMetrics.dscr,
      npv: calculatedMetrics.npv,
      irr: calculatedMetrics.irr,
      lcoe: calculatedMetrics.lcoe,
      projectId,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateScenario(
  projectId: string,
  scenarioId: string,
  formData: FormData,
) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      capacityMw: true,
    },
  });

  if (!project) {
    redirect("/projects");
  }

  const assumptions = readScenarioAssumptions(formData);
  const calculatedMetrics = calculateScenarioMetrics({
    capacityMw: project.capacityMw,
    ...assumptions,
  });

  await prisma.scenario.updateMany({
    where: {
      id: scenarioId,
      projectId,
    },
    data: {
      name: readText(formData, "name"),
      ...assumptions,
      dscr: calculatedMetrics.dscr,
      npv: calculatedMetrics.npv,
      irr: calculatedMetrics.irr,
      lcoe: calculatedMetrics.lcoe,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function cloneScenario(projectId: string, scenarioId: string) {
  const scenario = await prisma.scenario.findFirst({
    where: {
      id: scenarioId,
      projectId,
    },
  });

  if (!scenario) {
    redirect(`/projects/${projectId}`);
  }

  await prisma.scenario.create({
    data: {
      name: `${scenario.name} - Copy`,
      capex: scenario.capex,
      opex: scenario.opex,
      yieldMwh: scenario.yieldMwh,
      tariff: scenario.tariff,
      debtRate: scenario.debtRate,
      projectLifeYears: scenario.projectLifeYears,
      degradationRate: scenario.degradationRate,
      discountRate: scenario.discountRate,
      debtInterestRate: scenario.debtInterestRate,
      debtMaturityYears: scenario.debtMaturityYears,
      tariffInflationRate: scenario.tariffInflationRate,
      opexInflationRate: scenario.opexInflationRate,
      dscr: scenario.dscr,
      npv: scenario.npv,
      irr: scenario.irr,
      lcoe: scenario.lcoe,
      projectId,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function setReferenceScenario(projectId: string, scenarioId: string) {
  await prisma.$transaction([
    prisma.scenario.updateMany({
      where: {
        projectId,
      },
      data: {
        isReference: false,
      },
    }),
    prisma.scenario.updateMany({
      where: {
        id: scenarioId,
        projectId,
      },
      data: {
        isReference: true,
      },
    }),
  ]);

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
    const readOptionalNumber = (column: string, fallback: number, label: string) => {
      const index = headerIndexes.get(column);

      if (index === undefined) {
        return fallback;
      }

      const value = row[index]?.trim() ?? "";
      return value === "" ? fallback : parseImportedNumber(value, label);
    };
    const readOptionalInteger = (column: string, fallback: number, label: string) => {
      const index = headerIndexes.get(column);

      if (index === undefined) {
        return fallback;
      }

      const value = row[index]?.trim() ?? "";
      return value === "" ? fallback : parseImportedInteger(value, label);
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
      projectLifeYears: readOptionalInteger(
        scenarioImportColumns.projectLifeYears,
        DEFAULT_FINANCIAL_ASSUMPTIONS.projectLifeYears,
        "Duree projet",
      ),
      degradationRate: readOptionalNumber(
        scenarioImportColumns.degradationRate,
        DEFAULT_FINANCIAL_ASSUMPTIONS.degradationRate,
        "Degradation",
      ),
      discountRate: readOptionalNumber(
        scenarioImportColumns.discountRate,
        DEFAULT_FINANCIAL_ASSUMPTIONS.discountRate,
        "Taux actualisation",
      ),
      debtInterestRate: readOptionalNumber(
        scenarioImportColumns.debtInterestRate,
        DEFAULT_FINANCIAL_ASSUMPTIONS.debtInterestRate,
        "Taux dette",
      ),
      debtMaturityYears: readOptionalInteger(
        scenarioImportColumns.debtMaturityYears,
        DEFAULT_FINANCIAL_ASSUMPTIONS.debtMaturityYears,
        "Maturite dette",
      ),
      tariffInflationRate: readOptionalNumber(
        scenarioImportColumns.tariffInflationRate,
        DEFAULT_FINANCIAL_ASSUMPTIONS.tariffInflationRate,
        "Inflation tarif",
      ),
      opexInflationRate: readOptionalNumber(
        scenarioImportColumns.opexInflationRate,
        DEFAULT_FINANCIAL_ASSUMPTIONS.opexInflationRate,
        "Inflation OPEX",
      ),
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
