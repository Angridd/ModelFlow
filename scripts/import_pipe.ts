/**
 * Importeur pipe BizDev : data/input_projet_pipe.xlsx (Feuil1, une colonne par projet,
 * ligne 8 = nom, colonnes 11..36) → base Prisma (Project + Scenario de référence).
 *
 * Idempotent : upsert par NOM de projet (le nom n'est pas @unique en base → findFirst +
 * remplacement des scénarios). Statut "draft_bizdev". Aucune modif du moteur.
 *
 *   npx tsx scripts/import_pipe.ts
 *
 * ⚠️ Écrit dans prisma/dev.db (NE PAS committer). Écrit un rapport data/import_pipe_report.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as XLSX from "xlsx";
import { PrismaClient } from "../app/generated/prisma/client";
import { calculateScenarioMetrics, calculateTaxesFoncieres } from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import {
  CAPACITY_PRICE_CURVE,
  FIXED_CURVE_2026Q2,
  MERCHANT_CURVE_VINTAGE,
  merchantCurveForTechnology,
} from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";

const XLSX_PATH = path.resolve(process.cwd(), "data/input_projet_pipe.xlsx");
const REPORT_PATH = path.resolve(process.cwd(), "data/import_pipe_report.json");
const IMPORT_TAG = "draft_bizdev — import BizDev 03/07/2026";

// Déjà calibrés sur BP signés — ne pas écraser. + agrégats / repowering.
const EXCLUDED = new Set(["Golf de Baugé", "Sigoulès", "Panzoult CAS 3"]);
const isExcludedName = (name: string) =>
  EXCLUDED.has(name) || /global/i.test(name) || /\bRP\b/.test(name);

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

function loadSheet() {
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: "buffer" });
  const ws = wb.Sheets["Feuil1"];
  if (!ws) throw new Error("Onglet Feuil1 introuvable");
  // cell(row, col) en coordonnées 1-indexées (comme les numéros du mapping).
  const cell = (row: number, col: number): unknown => {
    const c = ws[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })];
    return c ? c.v : undefined;
  };
  return cell;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(/\s| /g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

type Built = {
  name: string;
  technology: string;
  input: FinanceEngineInput;
  scenario: Record<string, unknown>;
  flags: string[];
  dismantlingEuro: number | null;
};

function buildProject(cell: (r: number, c: number) => unknown, col: number): Built | null {
  const name = str(cell(8, col));
  if (!name || isExcludedName(name)) return null;

  const flags: string[] = [];
  const capacityMw = num(cell(87, col)) ?? 0;
  const mes = Math.trunc(num(cell(32, col)) ?? 0);
  const technoRaw = str(cell(86, col)) ?? "Fixed";
  const technology = /track/i.test(technoRaw) ? "Tracker" : "Fixed";
  const curve = merchantCurveForTechnology(technoRaw);

  // Loyer : router selon le mode (r118), valeur brute (r119), sans conversion.
  const rentType = (str(cell(118, col)) ?? "").toLowerCase();
  let loyerMode: string | null = null;
  if (rentType.includes("/ha") || rentType.includes("€/ha")) loyerMode = "euroParHa";
  else if (rentType.includes("mwc")) loyerMode = "euroParMWc";
  else if (rentType !== "") flags.push(`loyer à vérifier (mode inconnu: "${rentType}")`);
  const loyerValeur = num(cell(119, col));
  if (loyerMode && loyerValeur == null) flags.push("loyer à compléter (valeur vide)");

  // MRA (r218) : unité trompeuse — si > 100 c'est un € TOTAL annuel → /(MW×1000).
  const mraRaw = num(cell(218, col));
  let mraEuroKwc = mraRaw ?? 0;
  if (mraRaw != null && mraRaw > 100 && capacityMw > 0) {
    mraEuroKwc = mraRaw / (capacityMw * 1000);
    flags.push(`MRA converti (${mraRaw} € total → ${mraEuroKwc.toFixed(4)} €/kWc), à vérifier`);
  }

  const devFeesKEuroPerMW = (num(cell(53, col)) ?? 0) / 1000;
  const devFeesKeuroTotal = devFeesKEuroPerMW * capacityMw;
  const surfaceHa = num(cell(97, col)) ?? 0;
  const tenor = Math.trunc(num(cell(468, col)) ?? 24);
  const dscrContracted = num(cell(474, col)) ?? 1.15;
  const dscrMerchant = num(cell(475, col)) ?? 1.4;
  const dscrSchedule: DscrTranche[] = [
    { yearFrom: 1, yearTo: Math.min(20, tenor), dscrValue: dscrContracted },
  ];
  if (tenor > 20) {
    dscrSchedule.push({ yearFrom: 21, yearTo: tenor, dscrValue: dscrMerchant });
  }

  const diversOpexKeuro =
    ((num(cell(220, col)) ?? 0) + (num(cell(221, col)) ?? 0) +
      (num(cell(222, col)) ?? 0) + (num(cell(223, col)) ?? 0)) / 1000;

  const dismantlingEuro = num(cell(256, col));
  if (dismantlingEuro != null && dismantlingEuro > 0) {
    flags.push(
      `G7 démantèlement non modélisé (${Math.round(dismantlingEuro)} € an25-29, flux surestimés)`,
    );
  }

  // Base foncière (ÉTAPE 3) — convention template €/Wc, PAS un flag : le moteur (Fix 2) calcule
  // immo soumise + MOD retraité → base → TF/CFE. Défauts template identiques Fixed & Tracker.
  const curveIndexAn1 = round6(1.10245 * 1.02 ** (mes - 2029));

  // Champs communs (moteur ET base) — on ne stocke en base que les colonnes du schéma Scenario.
  const shared = {
    yieldMwh: num(cell(73, col)) ?? 0,
    tariff: num(cell(419, col)) ?? 0,
    projectLifeYears: Math.trunc(num(cell(38, col)) ?? 35),
    degradationRate: (num(cell(91, col)) ?? 0) * 100, // 0.004 → 0.4
    discountRate: 7.5,
    debtInterestRate: (num(cell(470, col)) ?? 0) * 100, // 0.0435 → 4.35
    debtMaturityYears: tenor,
    tariffInflationRate: 0.4,
    opexInflationRate: 2,
    contractDuration: Math.trunc(num(cell(421, col)) ?? 20),
    constructionYears: Math.trunc(num(cell(34, col)) ?? 1),
    assuranceRate: (num(cell(246, col)) ?? 0) * 100, // 0.025 → 2.5
    inflationAssurance: 2,
    balancingCost: num(cell(207, col)) ?? 2,
    omFixedEuroKwc: num(cell(217, col)) ?? 0,
    mraEuroKwc,
    backOfficeKeuro: (num(cell(247, col)) ?? 0) / 1000,
    diversOpexKeuro,
    loyerMode,
    loyerValeur,
    loyerInflation: 0.4,
    inflationOM: 2,
    inflationMRA: 2,
    inflationBackOffice: 2,
    inflationDivers: 2,
    methodeTaxes: "appreciation_directe",
    tauxTFCommune: num(cell(230, col)),
    tauxTFEPCI: num(cell(231, col)),
    tauxTSE: num(cell(232, col)),
    tauxGEMAPI: num(cell(233, col)),
    tauxTEOM: num(cell(234, col)),
    tauxCFECommune: num(cell(236, col)),
    tauxCFEEPCI: num(cell(237, col)),
    tauxCCI: num(cell(240, col)),
    inflationTaxes: 2,
    iferRate1: num(cell(244, col)),
    iferRate2: num(cell(245, col)),
    iferRpn: 1.35,
    inflationAurora: 2,
    debtTenorYears: tenor,
    gearingMaxPct: 95,
    tauxIS: (num(cell(268, col)) ?? 0) * 100, // 0.25 → 25
    amortDuree: 20,
    ccaRemunRate: (num(cell(483, col)) ?? 0) * 100, // 0.06 → 6
    dsraMonths: Math.trunc(num(cell(491, col)) ?? 6),
    devFeesKEuroPerMW,
    contingencyRate: (num(cell(148, col)) ?? 0) * 100, // 0.02 → 2
    prixModuleUSDWc: num(cell(134, col)),
    tauxEURUSD: 1.16,
    boSCtWc: (num(cell(135, col)) ?? 0) * 100, // 0.393 €/Wp → 39.3 ct
    raccordementOuvrageKEuro: (num(cell(170, col)) ?? 0) / 1000,
    // Financing fees : mode taux 7 composants (template §1.4) → replié dans l'investissement.
    legalFeesKEuro: 10,
    technicalDDKEuro: 5,
    arrangerFeesRate: 0.8,
    participantFeesRate: 0.4,
    bankFeesPLTKEuroPerMW: 1.5,
    interimFinancingRate: 2.5,
    commitmentFeesRate: 0.1,
  };

  // Champs présents dans le moteur mais ABSENTS du schéma Scenario (utilisés au calcul,
  // NON persistés — le recalcul de la page projet est dégradé, cf rapport de session).
  const engineOnly = {
    capacityMw,
    commissioningYear: mes,
    unavailability: num(cell(78, col)) ?? 0,
    indemnitesImmoKeuro: (num(cell(175, col)) ?? 0) / 1000,
    aleasOpexRate: (num(cell(260, col)) ?? 0) * 100, // 0.005 → 0.5
    tauxTSECfe: num(cell(238, col)),
    tauxGEMAPICfe: num(cell(239, col)),
    coefDegressif: 2.25,
    taxeFinaleSizingKeuro: 0,
    agentFeeAnnuelKeuro: (num(cell(490, col)) ?? 0) / 1000,
    dsrfFeeRate: (num(cell(492, col)) ?? 0) * 100, // 0.014 → 1.4
    capacityCertificateMw: num(cell(451, col)),
    goStartYear: Math.trunc(num(cell(452, col)) ?? 21),
    goPriceBase: 1,
    curveIndexAn1,
    investorCurveW: 1,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    auroraCurves: curve,
    capacityPriceCurve: CAPACITY_PRICE_CURVE,
    // Base foncière template €/Wc (ÉTAPE 3) : BOS divers 0,014 + terrassement 0,003 = 0,017.
    fonciereBienEuroWc: 0.017,
    batimentsFonciersKeuro: 0,
    modRetraitementKeuro: devFeesKeuroTotal,
    valeurTerrainKeuro: 5 * surfaceHa, // 5 000 €/ha × ha / 1000
  };

  const input: FinanceEngineInput = {
    capex: 0,
    opex: 0,
    debtRate: 0,
    surfaceHa,
    dscrSchedule,
    ...shared,
    ...engineOnly,
  } as FinanceEngineInput;

  // Le schéma Scenario ne porte PAS surfaceHa ? si — surfaceHa existe. On stocke le sous-ensemble.
  const scenario: Record<string, unknown> = {
    name: "Base Case (BizDev)",
    capex: 0,
    opex: 0,
    debtRate: 0,
    surfaceHa,
    yieldP90Mwh: null,
    ...shared,
    dscrSchedule: JSON.stringify(dscrSchedule),
    isReference: true,
  };

  return { name, technology, input, scenario, flags, dismantlingEuro };
}

async function main() {
  const cell = loadSheet();
  const built: Built[] = [];
  for (let col = 11; col <= 36; col += 1) {
    const b = buildProject(cell, col);
    if (b) built.push(b);
  }

  console.log(`\n=== IMPORT PIPE BizDev — ${built.length} projets (curve vintage ${MERCHANT_CURVE_VINTAGE}) ===\n`);

  const report: unknown[] = [];
  for (const b of built) {
    let metrics;
    try {
      metrics = calculateScenarioMetrics(b.input);
    } catch (err) {
      console.log(`✗ ${b.name} — ERREUR calcul : ${(err as Error).message}`);
      report.push({ name: b.name, error: (err as Error).message, flags: b.flags });
      continue;
    }

    const note =
      `${IMPORT_TAG}` +
      (b.flags.length ? ` — flags: ${b.flags.join(" ; ")}` : " — aucun flag") +
      " — courbe/curveIndexAn1/DSRF/agent/aléas/capacité/GO/base foncière NON persistés (schéma Scenario partiel)";

    b.scenario.dscr = metrics.dscr ?? 0;
    b.scenario.npv = metrics.npv;
    b.scenario.irr = metrics.irr;
    b.scenario.lcoe = metrics.lcoe;

    // Upsert idempotent par nom (name non @unique → findFirst).
    await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({ where: { name: b.name } });
      const projectData = {
        name: b.name,
        technology: b.technology,
        country: "France",
        capacityMw: b.input.capacityMw,
        status: "draft_bizdev",
        caseType: "Base",
        tariff: b.scenario.tariff as number,
        commissioningYear: b.input.commissioningYear ?? 0,
        debtSizingCentralW: 0.7,
        debtSizingLowW: 0.3,
        investorCurveW: 1,
      };
      let projectId: string;
      if (existing) {
        await tx.project.update({ where: { id: existing.id }, data: projectData });
        await tx.scenario.deleteMany({ where: { projectId: existing.id } });
        projectId = existing.id;
      } else {
        const created = await tx.project.create({ data: projectData });
        projectId = created.id;
      }
      await tx.scenario.create({ data: { ...(b.scenario as object), projectId } as never });
    });

    console.log(
      `✓ ${b.name.padEnd(32)} ${b.technology.padEnd(8)} ${b.input.capacityMw} MW · ` +
        `TRI ${metrics.irr}% · VAN ${(metrics.npv / 1000).toFixed(2)} M€ · dette ${((metrics.debtAmountKeuro ?? 0) / 1000).toFixed(2)} M€` +
        (b.flags.length ? `  ⚑ ${b.flags.length}` : ""),
    );
    if (b.flags.length) b.flags.forEach((f) => console.log(`      ⚑ ${f}`));

    report.push({
      name: b.name,
      technology: b.technology,
      capacityMw: b.input.capacityMw,
      commissioningYear: b.input.commissioningYear,
      metrics: { irr: metrics.irr, npv: metrics.npv, dscr: metrics.dscr, lcoe: metrics.lcoe, debtKeuro: metrics.debtAmountKeuro, binding: metrics.sizing?.bindingConstraint },
      flags: b.flags,
      note,
    });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nRapport écrit : ${path.relative(process.cwd(), REPORT_PATH)}`);

  // --- Sanity ÉTAPE 3 : base foncière €/Wc sur Digoin BP (capMw 4) ---
  const digoinSanity = calculateTaxesFoncieres(
    {
      capacityMw: 4,
      methodeTaxes: "appreciation_directe",
      fonciereBienEuroWc: 0.017,
      batimentsFonciersKeuro: 0,
      modRetraitementKeuro: 440,
      valeurTerrainKeuro: 15,
      tauxTFCommune: 0.3069, tauxTFEPCI: 0.0487, tauxTSE: 0.0024, tauxGEMAPI: 0.0023, tauxTEOM: 0,
      tauxCFECommune: 0, tauxCFEEPCI: 0.2594, tauxTSECfe: 0.0086, tauxGEMAPICfe: 0, tauxCCI: 0.0112,
      inflationTaxes: 2,
    } as FinanceEngineInput,
    3401.359,
    1,
  );
  const tfSanity = digoinSanity.tfAnnuelleKeuro * 1000;
  const immoSoumise = 0.017 * 4 * 1e6;
  const dTF = ((tfSanity - 1598.86) / 1598.86) * 100;
  console.log(
    `\n=== SANITY base foncière €/Wc (Digoin BP capMw 4) ===\n` +
      `  immo soumise €/Wc = ${immoSoumise.toFixed(0)} € (cible BP ≈ 89 667) · Δ ${(((immoSoumise - 89666.67) / 89666.67) * 100).toFixed(1)}%\n` +
      `  TF an1 = ${tfSanity.toFixed(2)} € (cible BP ≈ 1 598,86) · Δ ${dTF.toFixed(1)}%` +
      (Math.abs(dTF) > 5 ? "   ⚑ ÉCART > 5% — FLAGUÉ (coeff template 0,017 vs BP-Digoin 0,0224)" : "  ✓"),
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
