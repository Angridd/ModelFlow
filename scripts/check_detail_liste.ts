/**
 * Vérification « détail = liste » APRÈS persistance des inputs de calibration en base
 * (migration persist_engagements_marge). Pour chaque projet ciblé, reconstruit le
 * FinanceEngineInput de DEUX façons et confirme que dette + TRI investisseur coïncident :
 *   (A) DEPUIS LA DB — mêmes colonnes que app/projects/[id]/page.tsx buildFinanceInput, y compris
 *       les nouvelles colonnes Scenario.opexEngagementsKeuroByYear (JSON) et margeFactFigeeKeuro ;
 *   (B) DEPUIS LES CIBLES — data/cibles/<slug>.json → engineOnly, comme le fait calibrate_all.
 * Si (A) == (B), la page projet reproduit exactement les chiffres de calibrate_all. Lecture seule.
 *
 *   npx tsx scripts/check_detail_liste.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { calculateScenarioMetrics } from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import { CAPACITY_PRICE_CURVE, merchantCurveForTechnology } from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";
import { slugify } from "./read_bp_matrix";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });
const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");
const TARGETS = ["Ychoux", "Sigoulès", "Marcillé-Robert"];

function parseDscrSchedule(json: string | null): DscrTranche[] | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as DscrTranche[];
    return Array.isArray(p) && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

// Copie fidèle de app/projects/[id]/page.tsx : parseEngagements.
function parseEngagements(json: string | null): number[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      return parsed as number[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>;
type Scenario = Project["scenarios"][number];

// Mapping Project + Scenario → moteur, identique à page.tsx buildFinanceInput. `engagements`/`marge`
// sont fournis par l'appelant : (A) lus dans la DB, (B) lus dans les cibles.
function buildFinanceInput(
  project: Project,
  scenario: Scenario,
  engagements: number[] | undefined,
  marge: number | null,
): FinanceEngineInput {
  return {
    opexEngagementsKeuroByYear: engagements,
    margeFactFigeeKeuro: marge,
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves: merchantCurveForTechnology(project.technology),
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
    where: { name: { contains: name }, status: "bp_reel" },
    include: { scenarios: true },
  });
}

type CiblesEngineOnly = {
  opexEngagementsKeuroByYear?: number[] | null;
  margeFactFigeeKeuro?: number | null;
};

function loadEngineOnly(name: string): CiblesEngineOnly | undefined {
  try {
    const c = JSON.parse(
      readFileSync(path.join(CIBLES_DIR, `${slugify(name)}.json`), "utf8"),
    ) as { engineOnly?: CiblesEngineOnly };
    return c.engineOnly;
  } catch {
    return undefined;
  }
}

function near(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
}

async function main() {
  console.log("\n=== CHECK « détail = liste » — DB (page.tsx) vs cibles (calibrate_all) ===\n");
  const header = `${"Projet".padEnd(18)}| ${"dette DB".padStart(11)} | ${"dette cibles".padStart(12)} | ${"TRI DB".padStart(8)} | ${"TRI cibles".padStart(10)} | Match`;
  console.log(header);
  console.log("-".repeat(header.length));
  let allOk = true;

  for (const name of TARGETS) {
    const project = await loadProject(name);
    if (!project) {
      console.log(`${name.padEnd(18)}| INTROUVABLE`);
      allOk = false;
      continue;
    }
    const scenario = project.scenarios.find((s) => s.isReference) ?? project.scenarios[0];
    const eng = loadEngineOnly(project.name);

    // (A) DB : engagements/marge lus dans les colonnes Scenario (comme page.tsx).
    const inputDb = buildFinanceInput(
      project,
      scenario,
      parseEngagements(scenario.opexEngagementsKeuroByYear),
      scenario.margeFactFigeeKeuro,
    );
    // (B) Cibles : engagements/marge lus dans data/cibles (comme calibrate_all).
    const inputCibles = buildFinanceInput(
      project,
      scenario,
      eng?.opexEngagementsKeuroByYear ?? undefined,
      eng?.margeFactFigeeKeuro ?? null,
    );

    const mDb = calculateScenarioMetrics(inputDb);
    const mCibles = calculateScenarioMetrics(inputCibles);
    const detteDb = mDb.sizing?.debtRetenuKeuro ?? null;
    const detteCibles = mCibles.sizing?.debtRetenuKeuro ?? null;
    const triDb = mDb.investorIrr;
    const triCibles = mCibles.investorIrr;
    const ok = near(detteDb, detteCibles) && near(triDb, triCibles);
    allOk = allOk && ok;

    const f = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));
    console.log(
      `${project.name.slice(0, 17).padEnd(18)}| ${f(detteDb).padStart(11)} | ${f(detteCibles).padStart(12)} | ${f(triDb).padStart(8)} | ${f(triCibles).padStart(10)} | ${ok ? "✓" : "✗ MISMATCH"}`,
    );
  }

  console.log("-".repeat(header.length));
  console.log(
    allOk
      ? "\n✓ DB reproduit calibrate_all à l'euro/pp sur les 3 projets (Ychoux à engagements+marge, Sigoulès, Marcillé)."
      : "\n✗ Divergence détectée — la persistance ne reproduit PAS calibrate_all.",
  );

  await prisma.$disconnect();
  if (!allOk) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
