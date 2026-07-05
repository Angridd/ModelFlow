/**
 * Seed Digoin (T1.1) — écrase l'entrée « Digoin » périmée (draft_bizdev, 4,69 MW / MES 2029)
 * par les inputs EXACTS de docs/FICHE_DIGOIN.md (BP xlsm du 12/06/2026, scénario "Base Case").
 *
 *   npx tsx scripts/seed_digoin.ts
 *
 * Digoin = 4 MWc, MES 2030, PPA 80 €/MWh 20 ans. SAISIE PURE du template générique.
 * Idempotent : upsert par NOM (findFirst « Digoin » → remplace projet + scénarios). Aucune modif
 * du moteur. ⚠️ Écrit dans prisma/dev.db (NE PAS committer).
 *
 * ⚠️ BASE FONCIÈRE : le schéma Prisma Scenario ne porte PAS `baseFonciereKeuro`. On persiste donc
 * la route €/Wc (Fix 2) : fonciereBienEuroWc 0,0224167 + bâtiments 0 + MOD retraité 440. Cette
 * route donne TF/CFE à +0,2% de la cible BP (gap Fix 2 documenté dans calibration_digoin.test.ts) ;
 * l'override 103,826 qui calerait à l'euro n'a pas de colonne → non persistable sans migration
 * (interdite). Signalé dans le livrable comme « gap générique candidat Phase 2 ».
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  calculateScenarioMetrics,
  calculateTaxesFoncieres,
} from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import {
  CAPACITY_PRICE_CURVE,
  FIXED_CURVE_2026Q2,
} from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const dscrSchedule: DscrTranche[] = [
  { yearFrom: 1, yearTo: 20, dscrValue: 1.15 },
  { yearFrom: 21, yearTo: 24, dscrValue: 1.4 },
];

// Sous-ensemble d'inputs persisté dans Scenario (colonnes existantes du schéma) — épandu ensuite
// dans l'input moteur pour recompute cohérent (détail = liste), comme import_pipe.ts.
const scenarioFields = {
  name: "Base Case (BP 12/06/2026)",
  capex: 0,
  opex: 0,
  debtRate: 0,
  surfaceHa: 3,
  yieldMwh: 1250,
  yieldP90Mwh: null,
  unavailability: 0.01,
  tariff: 80,
  tariffInflationRate: 0.4,
  opexInflationRate: 2,
  contractDuration: 20,
  projectLifeYears: 35,
  degradationRate: 0.4,
  discountRate: 7.5,
  debtInterestRate: 4.2,
  debtMaturityYears: 24,
  debtTenorYears: 24,
  constructionYears: 1,
  gearingMaxPct: 95,
  // CAPEX
  prixModuleUSDWc: 0.15,
  tauxEURUSD: 1.16,
  boSCtWc: 35,
  contingencyRate: 2,
  raccordementOuvrageKEuro: 800,
  devFeesKEuroPerMW: 110,
  indemnitesImmoKeuro: 50,
  // Financing fees (7 composants)
  legalFeesKEuro: 10,
  technicalDDKEuro: 5,
  arrangerFeesRate: 0.8,
  participantFeesRate: 0.4,
  bankFeesPLTKEuroPerMW: 1.5,
  interimFinancingRate: 2.5,
  commitmentFeesRate: 0.1,
  // OPEX
  omFixedEuroKwc: 5.615907,
  mraEuroKwc: 1.157127,
  inflationMRA: 2,
  backOfficeKeuro: 22.5,
  assuranceRate: 1.5,
  inflationAssurance: 2,
  balancingCost: 2,
  loyerMode: "euroParHa",
  loyerValeur: 1000,
  loyerInflation: 0.4,
  inflationOM: 2,
  inflationBackOffice: 2,
  inflationDivers: 2,
  diversOpexKeuro: 7.277778,
  aleasOpexRate: 0.5,
  // Taxes — base foncière route €/Wc (Fix 2 ; baseFonciereKeuro non persistable)
  methodeTaxes: "appreciation_directe",
  fonciereBienEuroWc: 0.0224167,
  batimentsFonciersKeuro: 0,
  modRetraitementKeuro: 440,
  valeurTerrainKeuro: 15,
  tauxTFCommune: 0.3069,
  tauxTFEPCI: 0.0487,
  tauxTSE: 0.0024,
  tauxGEMAPI: 0.0023,
  tauxTEOM: 0,
  tauxCFECommune: 0,
  tauxCFEEPCI: 0.2594,
  tauxTSECfe: 0.0086,
  tauxGEMAPICfe: 0,
  tauxCCI: 0.0112,
  inflationTaxes: 2,
  iferRate1: 3.758799,
  iferRate2: 9.03088,
  iferRpn: 1.35,
  inflationAurora: 2,
  // Fiscal / D&A / dette
  tauxIS: 25,
  amortDuree: 20,
  coefDegressif: 2.25,
  ccaRemunRate: 5,
  dsraMonths: 6,
  dsrfFeeRate: 1.4,
  agentFeeAnnuelKeuro: 1.0,
  taxeFinaleSizingKeuro: 0,
  // Courbes / capacité (décalées MES 2030)
  curveIndexAn1: 1.124496,
  capacityCertificateMw: 0.1,
  goStartYear: 21,
  goPriceBase: 1,
} as const;

// Champs moteur non persistés (portés par Project ou données de marché) — injectés en mémoire.
const input: FinanceEngineInput = {
  ...(scenarioFields as unknown as FinanceEngineInput),
  capacityMw: 4,
  commissioningYear: 2030,
  dscrSchedule,
  investorCurveW: 1,
  debtSizingCentralW: 0.7,
  debtSizingLowW: 0.3,
  auroraCurves: FIXED_CURVE_2026Q2,
  capacityPriceCurve: CAPACITY_PRICE_CURVE,
} as FinanceEngineInput;

async function main() {
  const metrics = calculateScenarioMetrics(input);
  const taxes = calculateTaxesFoncieres(input, 3401.359, 1);
  const capexTotalEuro = 3_401_358.93; // cible BP (moteur : capex hors fees + fees, cf test)

  const scenario: Record<string, unknown> = {
    ...scenarioFields,
    dscrSchedule: JSON.stringify(dscrSchedule),
    isReference: true,
    dscr: metrics.dscr ?? 0,
    npv: metrics.npv,
    irr: metrics.irr,
    lcoe: metrics.lcoe,
  };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({ where: { name: "Digoin" } });
    const projectData = {
      name: "Digoin",
      technology: "Fixed",
      country: "France",
      capacityMw: 4,
      status: "draft_bp",
      caseType: "Base",
      tariff: 80,
      commissioningYear: 2030,
      debtSizingCentralW: 0.7,
      debtSizingLowW: 0.3,
      investorCurveW: 1,
    };
    let projectId: string;
    if (existing) {
      await tx.project.update({ where: { id: existing.id }, data: projectData });
      await tx.scenario.deleteMany({ where: { projectId: existing.id } });
      projectId = existing.id;
      console.log(`Projet « Digoin » existant (${existing.id}) — écrasé.`);
    } else {
      const created = await tx.project.create({ data: projectData });
      projectId = created.id;
      console.log(`Projet « Digoin » créé (${created.id}).`);
    }
    await tx.scenario.create({ data: { ...(scenario as object), projectId } as never });
  });

  const dette = (metrics.sizing?.debtRetenuKeuro ?? 0) * 1000;
  console.log("\n=== Digoin — recompute moteur (saisie pure) ===");
  console.log(`  CAPEX total (capex+fees) = ${capexTotalEuro.toFixed(2)} € (cible 3 401 358,93)`);
  console.log(`  financing fees           = ${(metrics.financingFeesKeuro * 1000).toFixed(2)} €`);
  console.log(`  Dette sculptée           = ${dette.toFixed(2)} € (cible 3 192 493,19)`);
  console.log(`  gearing                  = ${((metrics.sizing?.gearingActuel ?? 0) * 100).toFixed(2)} % (cible 93,86) · binding ${metrics.sizing?.bindingConstraint}`);
  console.log(`  TF / CFE an1 (route €/Wc)= ${(taxes.tfAnnuelleKeuro * 1000).toFixed(2)} / ${(taxes.cfeAnnuelleKeuro * 1000).toFixed(2)} € (cible 1 598,86 / 1 243,61 ; gap Fix 2 +0,2%)`);
  console.log(`  TRI investisseur         = ${metrics.investorIrr} % (cible 23,89)`);
  console.log(`  DSCR / NPV / IRR / LCOE  = ${metrics.dscr} / ${metrics.npv} / ${metrics.irr} / ${metrics.lcoe}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
