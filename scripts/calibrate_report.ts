/**
 * Harnais de comparaison réutilisable : lit un projet (+ son scénario de référence) en base,
 * reconstruit le FinanceEngineInput EXACTEMENT comme le fait la page détail
 * (app/projects/[id]/page.tsx > buildFinanceInput — "détail = liste"), appelle
 * calculateScenarioMetrics/calculateAnnualCashFlows/calculateCapexDetails/calculateOpexDetails,
 * et imprime un tableau ligne-par-ligne des grandeurs clés du moteur.
 *
 * Lecture seule sur le moteur (engine.ts / types.ts / merchantCurves.ts non modifiés).
 *
 * Usage :
 *   npx tsx scripts/calibrate_report.ts "<nom projet>"
 *   npx tsx scripts/calibrate_report.ts "<nom projet>" --targets chemin/vers/cibles.json
 *   npx tsx scripts/calibrate_report.ts "<nom projet>" --scenario <scenarioId>
 *
 * Format du JSON de cibles (toutes les clés optionnelles, mêmes noms que la colonne "Ligne") :
 *   { "capexTotalKeuro": 13151.098, "detteKeuro": 10323.840, "investorIrr": 7.42, ... }
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateOpexDetails,
  calculateScenarioMetrics,
} from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import { CAPACITY_PRICE_CURVE, merchantCurveForTechnology } from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";
import { readFileSync } from "node:fs";
import path from "node:path";
import { slugify } from "./read_bp_matrix";

const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");

// Inputs moteur non persistés en Scenario (opexEngagementsKeuroByYear, margeFactFigeeKeuro),
// portés par data/cibles/<slug>.json → engineOnly (produit par read_bp_matrix). Sans cette
// injection, le rapport affiche un faux gearing (95 %) sur les projets à engagements.
type CiblesEngineOnly = {
  opexEngagementsKeuroByYear?: number[] | null;
  margeFactFigeeKeuro?: number | null;
  margeFactAmortissableKeuro?: number | null;
};

function loadEngineOnly(projectName: string): CiblesEngineOnly | undefined {
  try {
    const dest = path.join(CIBLES_DIR, `${slugify(projectName)}.json`);
    const c = JSON.parse(readFileSync(dest, "utf8")) as { engineOnly?: CiblesEngineOnly };
    return c.engineOnly;
  } catch {
    return undefined;
  }
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

function parseDscrSchedule(json: string | null): DscrTranche[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as DscrTranche[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// Reconstruction du FinanceEngineInput — copie fidèle de buildFinanceInput
// (app/projects/[id]/page.tsx) : détail = liste, même mapping Project + Scenario → moteur.
function buildFinanceInput(
  project: NonNullable<Awaited<ReturnType<typeof loadProject>>>,
  scenario: NonNullable<Awaited<ReturnType<typeof loadProject>>>["scenarios"][number],
  engineOnly?: CiblesEngineOnly,
): FinanceEngineInput {
  const merchantCurves = merchantCurveForTechnology(project.technology);
  return {
    // Inputs moteur non persistés (cf calibrate_all.buildFinanceInput) : portés par les cibles.
    opexEngagementsKeuroByYear: engineOnly?.opexEngagementsKeuroByYear ?? undefined,
    margeFactFigeeKeuro: engineOnly?.margeFactFigeeKeuro ?? null,
    margeFactAmortissableKeuro: engineOnly?.margeFactAmortissableKeuro ?? null,
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves: merchantCurves,
    debtSizingCentralW: project.debtSizingCentralW,
    debtSizingLowW: project.debtSizingLowW,
    investorCurveW: project.investorCurveW,
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
    iferRate1: scenario.iferRate1,
    iferRate2: scenario.iferRate2,
    iferRpn: scenario.iferRpn,
    inflationAurora: scenario.inflationAurora,
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
    constructionYears: scenario.constructionYears,
    assuranceRate: scenario.assuranceRate,
    inflationAssurance: scenario.inflationAssurance,
    balancingCost: scenario.balancingCost,
    dscrTarget: scenario.dscrTarget,
    debtTenorYears: scenario.debtTenorYears,
    dscrSchedule: parseDscrSchedule(scenario.dscrSchedule),
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
    ccaRemunRate: scenario.ccaRemunRate,
    unavailability: scenario.unavailability,
    indemnitesImmoKeuro: scenario.indemnitesImmoKeuro,
    aleasOpexRate: scenario.aleasOpexRate,
    tauxTSECfe: scenario.tauxTSECfe,
    tauxGEMAPICfe: scenario.tauxGEMAPICfe,
    coefDegressif: scenario.coefDegressif,
    taxeFinaleSizingKeuro: scenario.taxeFinaleSizingKeuro,
    agentFeeAnnuelKeuro: scenario.agentFeeAnnuelKeuro,
    dsrfFeeRate: scenario.dsrfFeeRate,
    capacityCertificateMw: scenario.capacityCertificateMw ?? undefined,
    goStartYear: scenario.goStartYear ?? undefined,
    goPriceBase: scenario.goPriceBase ?? undefined,
    curveIndexAn1: scenario.curveIndexAn1,
    fonciereBienEuroWc: scenario.fonciereBienEuroWc,
    batimentsFonciersKeuro: scenario.batimentsFonciersKeuro,
    modRetraitementKeuro: scenario.modRetraitementKeuro,
    valeurTerrainKeuro: scenario.valeurTerrainKeuro,
    capacityPriceCurve: CAPACITY_PRICE_CURVE,
  } as FinanceEngineInput;
}

async function loadProject(name: string) {
  return prisma.project.findFirst({
    where: { name: { contains: name } },
    include: { scenarios: true },
  });
}

// ---------------------------------------------------------------------------
// Tableau ligne-par-ligne
// ---------------------------------------------------------------------------
type Row = { key: string; label: string; value: number | string | null; unit?: string };

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function buildReportRows(
  input: FinanceEngineInput,
): { rows: Row[]; numeric: Record<string, number | null> } {
  const capex = calculateCapexDetails(input);
  const metrics = calculateScenarioMetrics(input);
  const cashFlows = calculateAnnualCashFlows(input);
  const an1 = cashFlows.find((r) => r.year === 1);
  const opexAn1 = an1
    ? calculateOpexDetails(input, 1, an1.revenueP50Keuro, an1.productionP50Mwh, capex.capexTotalKeuro)
    : null;

  const dette = metrics.sizing?.debtRetenuKeuro ?? null;
  const equity = dette != null ? capex.capexTotalKeuro - dette : null;
  const gearing = metrics.sizing?.gearingActuel != null ? metrics.sizing.gearingActuel * 100 : null;
  const binding = metrics.sizing?.bindingConstraint ?? null;
  const debtServiceAn1 = an1 ? (an1.debtServiceSculptedKeuro ?? an1.debtServiceKeuro) : null;
  const interetsAn1 = an1 ? an1.interets : null;
  const principalAn1 = debtServiceAn1 != null && interetsAn1 != null ? debtServiceAn1 - interetsAn1 : null;

  const numeric: Record<string, number | null> = {
    productionP50Mwh_an1: an1?.productionP50Mwh ?? null,
    revenuePpaAn1Keuro: an1 ? (an1.productionP50Mwh * an1.annualTariff) / 1000 : null,
    revenueTotalP50An1Keuro: an1?.revenueP50Keuro ?? null,
    opexAn1Keuro: an1?.opexKeuro ?? null,
    ebitdaAn1Keuro: an1?.cashFlowKeuro ?? null,
    cfadsSizingAn1Keuro: an1?.cfadsP90Keuro ?? null,
    capexTotalKeuro: capex.capexTotalKeuro,
    detteKeuro: dette,
    equityCcaKeuro: equity,
    gearingPct: gearing,
    debtServiceAn1Keuro: debtServiceAn1,
    principalAn1Keuro: principalAn1,
    interetsAn1Keuro: interetsAn1,
    tfAn1Keuro: opexAn1?.tfKeuro ?? null,
    cfeAn1Keuro: opexAn1?.cfeKeuro ?? null,
    fluxActionnaireAn1Keuro: an1?.fluxActionnaire ?? null,
    investorIrrPct: metrics.investorIrr,
    trIProjetBrutPct: metrics.doubleIRR?.irrEntreprise ?? null,
    trIProjetNetPct: metrics.doubleIRR?.irrInvest ?? null,
    vanBruteKeuro: metrics.doubleIRR?.npvEntreprise ?? null,
    vanNetteKeuro: metrics.npv,
  };

  const rows: Row[] = [
    { key: "productionP50Mwh_an1", label: "Production P50 an1", value: numeric.productionP50Mwh_an1, unit: "MWh" },
    { key: "revenuePpaAn1Keuro", label: "Revenu PPA pur an1 (prod × tarif)", value: numeric.revenuePpaAn1Keuro, unit: "k€" },
    { key: "revenueTotalP50An1Keuro", label: "Revenu total P50 an1 (PPA+capacity+GO)", value: numeric.revenueTotalP50An1Keuro, unit: "k€" },
    { key: "opexAn1Keuro", label: "OPEX an1", value: numeric.opexAn1Keuro, unit: "k€" },
    { key: "ebitdaAn1Keuro", label: "EBITDA an1", value: numeric.ebitdaAn1Keuro, unit: "k€" },
    { key: "cfadsSizingAn1Keuro", label: "CFADS sizing (P90) an1", value: numeric.cfadsSizingAn1Keuro, unit: "k€" },
    { key: "capexTotalKeuro", label: "CAPEX total", value: numeric.capexTotalKeuro, unit: "k€" },
    { key: "detteKeuro", label: "Dette sculptée", value: numeric.detteKeuro, unit: "k€" },
    { key: "equityCcaKeuro", label: "Equity / CCA (CAPEX − dette)", value: numeric.equityCcaKeuro, unit: "k€" },
    { key: "gearingPct", label: `Gearing % (binding = ${binding ?? "—"})`, value: numeric.gearingPct, unit: "%" },
    { key: "debtServiceAn1Keuro", label: "Service dette an1 (total)", value: numeric.debtServiceAn1Keuro, unit: "k€" },
    { key: "principalAn1Keuro", label: "  dont principal an1", value: numeric.principalAn1Keuro, unit: "k€" },
    { key: "interetsAn1Keuro", label: "  dont intérêts an1", value: numeric.interetsAn1Keuro, unit: "k€" },
    { key: "tfAn1Keuro", label: "Taxe foncière (TF) an1", value: numeric.tfAn1Keuro, unit: "k€" },
    { key: "cfeAn1Keuro", label: "CFE an1", value: numeric.cfeAn1Keuro, unit: "k€" },
    { key: "fluxActionnaireAn1Keuro", label: "Flux actionnaire an1 (FCF after DS)", value: numeric.fluxActionnaireAn1Keuro, unit: "k€" },
    { key: "investorIrrPct", label: "TRI investisseur", value: numeric.investorIrrPct, unit: "%" },
    { key: "trIProjetBrutPct", label: "TRI projet brut", value: numeric.trIProjetBrutPct, unit: "%" },
    { key: "trIProjetNetPct", label: "TRI projet net", value: numeric.trIProjetNetPct, unit: "%" },
    { key: "vanBruteKeuro", label: "VAN brute", value: numeric.vanBruteKeuro, unit: "k€" },
    { key: "vanNetteKeuro", label: "VAN nette", value: numeric.vanNetteKeuro, unit: "k€" },
  ];

  return { rows, numeric };
}

function printReport(
  projectName: string,
  scenarioName: string,
  rows: Row[],
  targets?: Record<string, number>,
) {
  console.log(`\n=== CALIBRATE REPORT — ${projectName} (scénario "${scenarioName}") ===\n`);
  const hasTargets = targets && Object.keys(targets).length > 0;
  const header = hasTargets
    ? `${"Ligne".padEnd(42)} | ${"Valeur".padStart(14)} | ${"Cible".padStart(14)} | ${"Δ".padStart(12)} | ${"Δ%".padStart(8)}`
    : `${"Ligne".padEnd(42)} | ${"Valeur".padStart(14)}`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    const unit = row.unit ? ` ${row.unit}` : "";
    const valueStr =
      typeof row.value === "number" ? `${fmt(row.value)}${unit}` : (row.value ?? "—");
    if (hasTargets) {
      const target = targets?.[row.key];
      let deltaStr = "—".padStart(12);
      let deltaPctStr = "—".padStart(8);
      if (target != null && typeof row.value === "number") {
        const delta = row.value - target;
        const deltaPct = target !== 0 ? (delta / target) * 100 : null;
        deltaStr = `${fmt(delta)}`.padStart(12);
        deltaPctStr = deltaPct != null ? `${fmt(deltaPct)}%`.padStart(8) : "—".padStart(8);
      }
      const targetStr = target != null ? `${fmt(target)}${unit}` : "—";
      console.log(
        `${row.label.padEnd(42)} | ${valueStr.padStart(14)} | ${targetStr.padStart(14)} | ${deltaStr} | ${deltaPctStr}`,
      );
    } else {
      console.log(`${row.label.padEnd(42)} | ${valueStr.padStart(14)}`);
    }
  }
  console.log("-".repeat(header.length));
}

async function main() {
  const args = process.argv.slice(2);
  const projectName = args[0];
  if (!projectName) {
    console.error('Usage: npx tsx scripts/calibrate_report.ts "<nom projet>" [--targets fichier.json] [--scenario <scenarioId>]');
    process.exit(1);
  }
  const targetsIdx = args.indexOf("--targets");
  const targetsPath = targetsIdx >= 0 ? args[targetsIdx + 1] : undefined;
  const scenarioIdx = args.indexOf("--scenario");
  const scenarioIdArg = scenarioIdx >= 0 ? args[scenarioIdx + 1] : undefined;

  const project = await loadProject(projectName);
  if (!project) {
    console.error(`Projet introuvable (recherche "${projectName}")`);
    await prisma.$disconnect();
    process.exit(1);
  }
  if (project.scenarios.length === 0) {
    console.error(`Projet "${project.name}" trouvé, mais aucun scénario.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const scenario =
    (scenarioIdArg ? project.scenarios.find((s) => s.id === scenarioIdArg) : undefined) ??
    project.scenarios.find((s) => s.isReference) ??
    project.scenarios[0];

  let targets: Record<string, number> | undefined;
  if (targetsPath) {
    const fs = await import("node:fs");
    targets = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  }

  const input = buildFinanceInput(project, scenario, loadEngineOnly(project.name));
  const { rows } = buildReportRows(input);
  printReport(project.name, scenario.name, rows, targets);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
