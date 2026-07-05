/**
 * Runner de calibration PORTFOLIO : pour chaque vrai projet (statut « bp_reel ») en base,
 * reconstruit le FinanceEngineInput EXACTEMENT comme la page détail (buildFinanceInput,
 * « détail = liste »), calcule les métriques MF, et compare aux CIBLES BP (data/cibles/<slug>.json,
 * produites par read_bp_matrix.ts depuis Inp_Assumption).
 *
 *   npx tsx scripts/calibrate_all.ts
 *   npx tsx scripts/calibrate_all.ts --verbose   (décompose ligne par ligne chaque projet ROUGE)
 *
 * VERT si CAPEX ±1% ET dette ±1% ET TRI Investisseur ±0,5 pp. Sinon ROUGE + 1re ligne divergente.
 * Lecture seule sur le moteur. Aucune écriture DB.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { calculateCapexDetails, calculateScenarioMetrics } from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import { CAPACITY_PRICE_CURVE, merchantCurveForTechnology } from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";
import { slugify } from "./read_bp_matrix";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });
const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");

function parseDscrSchedule(json: string | null): DscrTranche[] | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as DscrTranche[];
    return Array.isArray(p) && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

// Copie fidèle de buildFinanceInput (app/projects/[id]/page.tsx & calibrate_report.ts).
function buildFinanceInput(
  project: NonNullable<Awaited<ReturnType<typeof loadProjects>>>[number],
  scenario: NonNullable<Awaited<ReturnType<typeof loadProjects>>>[number]["scenarios"][number],
  opexEngagementsKeuroByYear?: number[],
): FinanceEngineInput {
  return {
    // OPEX engagements (moteur uniquement, non persisté en Scenario) : porté par les cibles
    // (data/cibles/<slug>.json → engineOnly, produit par read_bp_matrix). Absent → inchangé.
    opexEngagementsKeuroByYear,
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

async function loadProjects() {
  return prisma.project.findMany({
    where: { status: "bp_reel" },
    include: { scenarios: true },
  });
}

type Cibles = {
  name: string;
  slug: string;
  technology: string;
  targets: Record<string, number | null>;
  flags: string[];
  engineOnly?: { opexEngagementsKeuroByYear?: number[] | null };
};

function loadCibles(): Map<string, Cibles> {
  const map = new Map<string, Cibles>();
  for (const f of readdirSync(CIBLES_DIR).filter((x) => x.endsWith(".json"))) {
    const c = JSON.parse(readFileSync(path.join(CIBLES_DIR, f), "utf8")) as Cibles;
    map.set(c.slug, c);
  }
  return map;
}

function fmt(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pctΔ(mf: number, bp: number | null | undefined): number | null {
  if (bp == null || bp === 0) return null;
  return ((mf - bp) / bp) * 100;
}

async function main() {
  const verbose = process.argv.includes("--verbose");
  const projects = await loadProjects();
  const cibles = loadCibles();

  // Ordre : Tracker d'abord (Panzoult CRE 1 en tête — sanity courbe), puis Fixed.
  projects.sort((a, b) => {
    if (a.name.startsWith("Panzoult CRE 1")) return -1;
    if (b.name.startsWith("Panzoult CRE 1")) return 1;
    if (a.technology !== b.technology) return a.technology === "Tracker" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const H =
    `${"Projet".padEnd(30)}|${"Tec".padEnd(4)}|${"MES".padStart(5)}|` +
    `${"CAPEX MF".padStart(9)}|${"BP".padStart(9)}|${"Δ%".padStart(6)}|` +
    `${"dette MF".padStart(9)}|${"BP".padStart(9)}|${"Δ%".padStart(6)}|` +
    `${"gearMF".padStart(7)}|${"gearBP".padStart(7)}|` +
    `${"TRIiMF".padStart(7)}|${"TRIiBP".padStart(7)}|${"Δpp".padStart(6)}|` +
    `${"VANn MF".padStart(8)}|${"VANn BP".padStart(8)}| Statut`;
  console.log("\n" + H);
  console.log("-".repeat(H.length));

  let green = 0;
  let red = 0;
  let invalid = 0;
  const redReasons: string[] = [];

  for (const project of projects) {
    const c = cibles.get(slugify(project.name));
    const scenario = project.scenarios.find((s) => s.isReference) ?? project.scenarios[0];
    if (!scenario || !c) continue;

    const input = buildFinanceInput(
      project,
      scenario,
      c.engineOnly?.opexEngagementsKeuroByYear ?? undefined,
    );
    const m = calculateScenarioMetrics(input);

    // CAPEX MF = investissement total moteur = CAPEX détaillé + financing fees (cf engine
    // initialInvestment = capexTotalKeuro + financingFeesKeuro), ce que r27 « Capex » BP recouvre.
    const detteMF = m.sizing?.debtRetenuKeuro ?? 0;
    const gearMF = m.sizing?.gearingActuel != null ? m.sizing.gearingActuel * 100 : null;
    const capexTotalMF =
      calculateCapexDetails(input).capexTotalKeuro + m.financingFeesKeuro;
    const triInvMF = m.investorIrr;
    const vanNetteMF = m.npv;

    const tt = c.targets;
    const capexBP = tt.capexTotalKeuro;
    const detteBP = tt.detteKeuro;
    const gearBP = tt.gearingPct;
    const triInvBP = tt.investorIrrPct;
    const vanNetteBP = tt.vanNetteKeuro;

    const dCapex = pctΔ(capexTotalMF ?? 0, capexBP);
    const dDette = pctΔ(detteMF, detteBP);
    const dTriPp = triInvBP != null ? triInvMF - triInvBP : null;

    // Statut
    const capexOK = dCapex != null && Math.abs(dCapex) <= 1;
    const detteOK = dDette != null && Math.abs(dDette) <= 1;
    const triOK = dTriPp != null && Math.abs(dTriPp) <= 0.5;
    let statut: string;
    if (capexBP == null || detteBP == null || triInvBP == null) {
      statut = "GRIS (cible BP invalide)";
      invalid += 1;
    } else if (capexOK && detteOK && triOK) {
      statut = "VERT";
      green += 1;
    } else {
      const first = !capexOK
        ? `CAPEX Δ${fmt(dCapex)}%`
        : !detteOK
          ? `dette Δ${fmt(dDette)}%`
          : `TRIinv Δ${fmt(dTriPp, 2)}pp`;
      statut = `ROUGE (${first})`;
      red += 1;
      redReasons.push(`${project.name.padEnd(30)} → ${first}`);
    }

    console.log(
      `${project.name.slice(0, 30).padEnd(30)}|${project.technology.slice(0, 3).padEnd(4)}|` +
        `${String(project.commissioningYear).padStart(5)}|` +
        `${fmt(capexTotalMF, 0).padStart(9)}|${fmt(capexBP, 0).padStart(9)}|${fmt(dCapex).padStart(6)}|` +
        `${fmt(detteMF, 0).padStart(9)}|${fmt(detteBP, 0).padStart(9)}|${fmt(dDette).padStart(6)}|` +
        `${fmt(gearMF).padStart(7)}|${fmt(gearBP).padStart(7)}|` +
        `${fmt(triInvMF, 2).padStart(7)}|${fmt(triInvBP, 2).padStart(7)}|${fmt(dTriPp, 2).padStart(6)}|` +
        `${fmt(vanNetteMF, 0).padStart(8)}|${fmt(vanNetteBP, 0).padStart(8)}| ${statut}`,
    );
  }

  console.log("-".repeat(H.length));
  console.log(
    `\nBILAN : ${green} VERT · ${red} ROUGE · ${invalid} GRIS (cible BP invalide) — sur ${projects.length} projets.`,
  );
  if (redReasons.length) {
    console.log("\nPremière ligne divergente par projet ROUGE :");
    redReasons.forEach((r) => console.log("  " + r));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
