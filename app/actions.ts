"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  calculateCapexDetails,
  calculateOpexDetails,
  calculateScenarioMetrics,
} from "@/app/lib/finance/engine";
import { DEFAULT_FINANCIAL_ASSUMPTIONS } from "@/app/lib/finance/types";
import type { DscrTranche } from "@/app/lib/finance/types";
import { prisma } from "@/app/lib/prisma";

const scenarioImportColumns = {
  name: "scenario",
  capex: "capex",
  opex: "opex",
  yieldMwh: "productible",
  yieldP90Mwh: "productible p90",
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

function readOptionalNumber(formData: FormData, key: string): number | null {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const number = Number(value.trim());

  if (!Number.isFinite(number)) {
    throw new Error(`Le champ ${key} doit etre un nombre.`);
  }

  return number;
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

function readOptionalInteger(formData: FormData, key: string): number | null {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const number = Number(value.trim());

  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    throw new Error(`Le champ ${key} doit etre un entier.`);
  }

  return number;
}

function readDscrSchedule(formData: FormData): DscrTranche[] | null {
  const value = formData.get("dscrSchedule");

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Format du profil DSCR invalide.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const tranches: DscrTranche[] = [];

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).yearFrom !== "number" ||
      typeof (item as Record<string, unknown>).yearTo !== "number" ||
      typeof (item as Record<string, unknown>).dscrValue !== "number"
    ) {
      throw new Error("Format du profil DSCR invalide.");
    }

    const t = item as DscrTranche;

    if (t.yearFrom >= t.yearTo) {
      throw new Error(
        `Tranche DSCR invalide : l'année début (${t.yearFrom}) doit être inférieure à l'année fin (${t.yearTo}).`,
      );
    }

    if (t.dscrValue <= 1.0) {
      throw new Error("Le DSCR cible doit être supérieur à 1,0.");
    }

    tranches.push({ yearFrom: t.yearFrom, yearTo: t.yearTo, dscrValue: t.dscrValue });
  }

  // Check for overlapping tranches.
  for (let i = 0; i < tranches.length; i++) {
    for (let j = i + 1; j < tranches.length; j++) {
      const a = tranches[i];
      const b = tranches[j];
      if (a.yearFrom <= b.yearTo && b.yearFrom <= a.yearTo) {
        throw new Error(`Les tranches DSCR ${i + 1} et ${j + 1} se chevauchent.`);
      }
    }
  }

  return tranches;
}

function readScenarioAssumptions(formData: FormData) {
  return {
    capex: readOptionalNumber(formData, "capex") ?? 0,
    surfaceHa: readOptionalNumber(formData, "surfaceHa"),
    prixModuleUSDWc: readOptionalNumber(formData, "prixModuleUSDWc"),
    tauxEURUSD: readOptionalNumber(formData, "tauxEURUSD"),
    boSCtWc: readOptionalNumber(formData, "boSCtWc"),
    raccordementOuvrageKEuro: readOptionalNumber(formData, "raccordementOuvrageK€"),
    tarifQPKEuroPerMW: readOptionalNumber(formData, "tarifQPk€PerMW"),
    apportAffaireMode: readOptionalText(formData, "apportAffaireMode"),
    apportAffaireValeur: readOptionalNumber(formData, "apportAffaireValeur"),
    opex: readNumber(formData, "opex"),
    yieldMwh: readNumber(formData, "yieldMwh"),
    yieldP90Mwh: readOptionalNumber(formData, "yieldP90Mwh"),
    tariff: readNumber(formData, "tariff"),
    debtRate: readNumber(formData, "debtRate"),
    projectLifeYears: readInteger(formData, "projectLifeYears"),
    degradationRate: readNumber(formData, "degradationRate"),
    discountRate: readNumber(formData, "discountRate"),
    debtInterestRate: readNumber(formData, "debtInterestRate"),
    debtMaturityYears: readInteger(formData, "debtMaturityYears"),
    tariffInflationRate: readNumber(formData, "tariffInflationRate"),
    opexInflationRate: readNumber(formData, "opexInflationRate"),
    contractDuration: readOptionalInteger(formData, "contractDuration"),
    assuranceRate: readOptionalNumber(formData, "assuranceRate"),
    inflationAssurance: readOptionalNumber(formData, "inflationAssurance"),
    balancingCost: readOptionalNumber(formData, "balancingCost"),
    omFixedEuroKwc: readOptionalNumber(formData, "omFixedEuroKwc"),
    mraEuroKwc: readOptionalNumber(formData, "mraEuroKwc"),
    backOfficeKeuro: readOptionalNumber(formData, "backOfficeKeuro"),
    diversOpexKeuro: readOptionalNumber(formData, "diversOpexKeuro"),
    loyerMode: readOptionalText(formData, "loyerMode"),
    loyerValeur: readOptionalNumber(formData, "loyerValeur"),
    loyerInflation: readOptionalNumber(formData, "loyerInflation"),
    inflationOM: readOptionalNumber(formData, "inflationOM"),
    inflationMRA: readOptionalNumber(formData, "inflationMRA"),
    inflationBackOffice: readOptionalNumber(formData, "inflationBackOffice"),
    inflationDivers: readOptionalNumber(formData, "inflationDivers"),
    methodeTaxes: readOptionalText(formData, "methodeTaxes"),
    tauxTFCommune: readOptionalNumber(formData, "tauxTFCommune"),
    tauxTFEPCI: readOptionalNumber(formData, "tauxTFEPCI"),
    tauxTSE: readOptionalNumber(formData, "tauxTSE"),
    tauxGEMAPI: readOptionalNumber(formData, "tauxGEMAPI"),
    tauxTEOM: readOptionalNumber(formData, "tauxTEOM"),
    tauxCFECommune: readOptionalNumber(formData, "tauxCFECommune"),
    tauxCFEEPCI: readOptionalNumber(formData, "tauxCFEEPCI"),
    tauxCCI: readOptionalNumber(formData, "tauxCCI"),
    prixTerrainHa: readOptionalNumber(formData, "prixTerrainHa"),
    abattTerrain: readOptionalNumber(formData, "abattTerrain"),
    inflationTaxes: readOptionalNumber(formData, "inflationTaxes"),
    debtTenorYears: readOptionalInteger(formData, "debtTenorYears"),
    dscrSchedule: readDscrSchedule(formData),
    gearingMaxPct:
      readOptionalNumber(formData, "gearingMaxPct") ??
      readOptionalNumber(formData, "gearingMax"),
    tauxIS: readOptionalNumber(formData, "tauxIS"),
    amortDuree: readOptionalInteger(formData, "amortDuree"),
    dsraMonths: readOptionalInteger(formData, "dsraMonths"),
    devFeesKEuroPerMW: readOptionalNumber(formData, "devFeesKEuroPerMW"),
    tauxISEntreprise: readOptionalNumber(formData, "tauxISEntreprise"),
    contingencyRate: readOptionalNumber(formData, "contingencyRate"),
    longueurModule: readOptionalNumber(formData, "longueurModule"),
    largeurModule: readOptionalNumber(formData, "largeurModule"),
    txAmenagementRate: readOptionalNumber(formData, "txAmenagementRate"),
    coefArcheo: readOptionalNumber(formData, "coefArcheo"),
    legalFeesKEuro: readOptionalNumber(formData, "legalFeesK€"),
    technicalDDKEuro: readOptionalNumber(formData, "technicalDDK€"),
    arrangerFeesRate: readOptionalNumber(formData, "arrangerFeesRate"),
    participantFeesRate: readOptionalNumber(formData, "participantFeesRate"),
    bankFeesPLTKEuroPerMW: readOptionalNumber(formData, "bankFeesPLTK€PerMW"),
    interimFinancingRate: readOptionalNumber(formData, "interimFinancingRate"),
    commitmentFeesRate: readOptionalNumber(formData, "commitmentFeesRate"),
  };
}

function readAuroraWeights(formData: FormData) {
  const investorCurveW = readOptionalNumber(formData, "investorCurveW");
  const debtSizingCentralW = readOptionalNumber(formData, "debtSizingCentralW");
  const debtSizingLowW = readOptionalNumber(formData, "debtSizingLowW");

  if (
    debtSizingCentralW !== null &&
    debtSizingLowW !== null &&
    Math.round((debtSizingCentralW + debtSizingLowW) * 100) !== 10000
  ) {
    throw new Error("Les ponderations Debt Sizing Central + Low doivent etre egales a 100 %.");
  }

  return {
    investorCurveW: investorCurveW !== null ? investorCurveW / 100 : null,
    debtSizingCentralW: debtSizingCentralW !== null ? debtSizingCentralW / 100 : null,
    debtSizingLowW: debtSizingLowW !== null ? debtSizingLowW / 100 : null,
  };
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function withCalculatedCapex<T extends ReturnType<typeof readScenarioAssumptions>>(
  assumptions: T,
  capacityMw: number,
) {
  const capexDetails = calculateCapexDetails({
    capacityMw,
    ...assumptions,
  });

  return {
    ...assumptions,
    capex: capexDetails.capexPerMwKeuro,
  };
}

function withCalculatedOpex<T extends ReturnType<typeof readScenarioAssumptions>>(
  assumptions: T,
  capacityMw: number,
) {
  const productionP50Mwh = assumptions.yieldMwh * capacityMw;
  const contractDuration = assumptions.contractDuration ?? 20;
  const tariffInflationRate = assumptions.tariffInflationRate / 100;
  const annualTariff =
    contractDuration >= 1
      ? assumptions.tariff * (1 + tariffInflationRate)
      : 0;
  const revenueP50Keuro = productionP50Mwh * annualTariff / 1000;
  const opexDetails = calculateOpexDetails(
    {
      capacityMw,
      ...assumptions,
    },
    1,
    revenueP50Keuro,
    productionP50Mwh,
  );

  return {
    ...assumptions,
    opex: opexDetails.opexPerMwKeuro,
  };
}

function withCalculatedCapexAndOpex<T extends ReturnType<typeof readScenarioAssumptions>>(
  assumptions: T,
  capacityMw: number,
) {
  return withCalculatedOpex(withCalculatedCapex(assumptions, capacityMw), capacityMw);
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
  const [project, auroraCurves] = await Promise.all([
    prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        capacityMw: true,
        commissioningYear: true,
        debtSizingCentralW: true,
        debtSizingLowW: true,
        investorCurveW: true,
      },
    }),
    prisma.auroraCurve.findMany({
      orderBy: { year: "asc" },
    }),
  ]);

  if (!project) {
    redirect("/projects");
  }

  const assumptions = withCalculatedCapexAndOpex(
    readScenarioAssumptions(formData),
    project.capacityMw,
  );
  const auroraWeights = readAuroraWeights(formData);
  const effectiveInvestorCurveW = auroraWeights.investorCurveW ?? project.investorCurveW;
  const effectiveDebtSizingCentralW =
    auroraWeights.debtSizingCentralW ?? project.debtSizingCentralW;
  const effectiveDebtSizingLowW = auroraWeights.debtSizingLowW ?? project.debtSizingLowW;
  const { dscrSchedule, ...assumptionsWithoutSchedule } = assumptions;
  const calculatedMetrics = calculateScenarioMetrics({
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves,
    debtSizingCentralW: effectiveDebtSizingCentralW,
    debtSizingLowW: effectiveDebtSizingLowW,
    investorCurveW: effectiveInvestorCurveW,
    ...assumptionsWithoutSchedule,
    dscrSchedule,
  });

  if (
    auroraWeights.investorCurveW !== null ||
    auroraWeights.debtSizingCentralW !== null ||
    auroraWeights.debtSizingLowW !== null
  ) {
    await prisma.project.update({
      where: { id: projectId },
      data: auroraWeights,
    });
  }

  await prisma.scenario.create({
    data: {
      name: readText(formData, "name"),
      ...assumptionsWithoutSchedule,
      dscrSchedule: dscrSchedule ? JSON.stringify(dscrSchedule) : null,
      dscr: calculatedMetrics.dscr ?? 0,
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
  const [project, auroraCurves] = await Promise.all([
    prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        capacityMw: true,
        commissioningYear: true,
        debtSizingCentralW: true,
        debtSizingLowW: true,
        investorCurveW: true,
      },
    }),
    prisma.auroraCurve.findMany({
      orderBy: { year: "asc" },
    }),
  ]);

  if (!project) {
    redirect("/projects");
  }

  const assumptions = withCalculatedCapexAndOpex(
    readScenarioAssumptions(formData),
    project.capacityMw,
  );
  const auroraWeights = readAuroraWeights(formData);
  const effectiveInvestorCurveW = auroraWeights.investorCurveW ?? project.investorCurveW;
  const effectiveDebtSizingCentralW =
    auroraWeights.debtSizingCentralW ?? project.debtSizingCentralW;
  const effectiveDebtSizingLowW = auroraWeights.debtSizingLowW ?? project.debtSizingLowW;
  const { dscrSchedule, ...assumptionsWithoutSchedule } = assumptions;
  const calculatedMetrics = calculateScenarioMetrics({
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves,
    debtSizingCentralW: effectiveDebtSizingCentralW,
    debtSizingLowW: effectiveDebtSizingLowW,
    investorCurveW: effectiveInvestorCurveW,
    ...assumptionsWithoutSchedule,
    dscrSchedule,
  });

  if (
    auroraWeights.investorCurveW !== null ||
    auroraWeights.debtSizingCentralW !== null ||
    auroraWeights.debtSizingLowW !== null
  ) {
    await prisma.project.update({
      where: { id: projectId },
      data: auroraWeights,
    });
  }

  await prisma.scenario.updateMany({
    where: {
      id: scenarioId,
      projectId,
    },
    data: {
      name: readText(formData, "name"),
      ...assumptionsWithoutSchedule,
      dscrSchedule: dscrSchedule ? JSON.stringify(dscrSchedule) : null,
      dscr: calculatedMetrics.dscr ?? 0,
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
      surfaceHa: scenario.surfaceHa,
      prixModuleUSDWc: scenario.prixModuleUSDWc,
      tauxEURUSD: scenario.tauxEURUSD,
      boSCtWc: scenario.boSCtWc,
      raccordementOuvrageKEuro: scenario.raccordementOuvrageKEuro,
      tarifQPKEuroPerMW: scenario.tarifQPKEuroPerMW,
      apportAffaireMode: scenario.apportAffaireMode,
      apportAffaireValeur: scenario.apportAffaireValeur,
      opex: scenario.opex,
      yieldMwh: scenario.yieldMwh,
      yieldP90Mwh: scenario.yieldP90Mwh,
      tariff: scenario.tariff,
      debtRate: scenario.debtRate,
      projectLifeYears: scenario.projectLifeYears,
      degradationRate: scenario.degradationRate,
      discountRate: scenario.discountRate,
      debtInterestRate: scenario.debtInterestRate,
      debtMaturityYears: scenario.debtMaturityYears,
      tariffInflationRate: scenario.tariffInflationRate,
      opexInflationRate: scenario.opexInflationRate,
      contractDuration: scenario.contractDuration,
      assuranceRate: scenario.assuranceRate,
      inflationAssurance: scenario.inflationAssurance,
      balancingCost: scenario.balancingCost,
      omFixedEuroKwc: scenario.omFixedEuroKwc,
      mraEuroKwc: scenario.mraEuroKwc,
      backOfficeKeuro: scenario.backOfficeKeuro,
      diversOpexKeuro: scenario.diversOpexKeuro,
      loyerMode: scenario.loyerMode,
      loyerValeur: scenario.loyerValeur,
      loyerInflation: scenario.loyerInflation,
      inflationOM: scenario.inflationOM,
      inflationMRA: scenario.inflationMRA,
      inflationBackOffice: scenario.inflationBackOffice,
      inflationDivers: scenario.inflationDivers,
      methodeTaxes: scenario.methodeTaxes,
      tauxTFCommune: scenario.tauxTFCommune,
      tauxTFEPCI: scenario.tauxTFEPCI,
      tauxTSE: scenario.tauxTSE,
      tauxGEMAPI: scenario.tauxGEMAPI,
      tauxTEOM: scenario.tauxTEOM,
      tauxCFECommune: scenario.tauxCFECommune,
      tauxCFEEPCI: scenario.tauxCFEEPCI,
      tauxCCI: scenario.tauxCCI,
      prixTerrainHa: scenario.prixTerrainHa,
      abattTerrain: scenario.abattTerrain,
      inflationTaxes: scenario.inflationTaxes,
      dscrTarget: scenario.dscrTarget,
      debtTenorYears: scenario.debtTenorYears,
      dscrSchedule: scenario.dscrSchedule,
      gearingMaxPct: scenario.gearingMaxPct,
      tauxIS: scenario.tauxIS,
      amortDuree: scenario.amortDuree,
      dsraMonths: scenario.dsraMonths,
      devFeesKEuroPerMW: scenario.devFeesKEuroPerMW,
      tauxISEntreprise: scenario.tauxISEntreprise,
      contingencyRate: scenario.contingencyRate,
      longueurModule: scenario.longueurModule,
      largeurModule: scenario.largeurModule,
      txAmenagementRate: scenario.txAmenagementRate,
      coefArcheo: scenario.coefArcheo,
      legalFeesKEuro: scenario.legalFeesKEuro,
      technicalDDKEuro: scenario.technicalDDKEuro,
      arrangerFeesRate: scenario.arrangerFeesRate,
      participantFeesRate: scenario.participantFeesRate,
      bankFeesPLTKEuroPerMW: scenario.bankFeesPLTKEuroPerMW,
      interimFinancingRate: scenario.interimFinancingRate,
      commitmentFeesRate: scenario.commitmentFeesRate,
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

    const yieldP90MwhIndex = headerIndexes.get(scenarioImportColumns.yieldP90Mwh);
    const yieldP90MwhRaw = yieldP90MwhIndex !== undefined ? (row[yieldP90MwhIndex]?.trim() ?? "") : "";
    const yieldP90MwhValue = yieldP90MwhRaw !== "" ? parseImportedNumber(yieldP90MwhRaw, "Productible P90") : null;

    return {
      name,
      capex: parseImportedNumber(readColumn(scenarioImportColumns.capex), "CAPEX"),
      opex: parseImportedNumber(readColumn(scenarioImportColumns.opex), "OPEX"),
      yieldMwh: parseImportedNumber(
        readColumn(scenarioImportColumns.yieldMwh),
        "Productible",
      ),
      yieldP90Mwh: yieldP90MwhValue,
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
