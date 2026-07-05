/**
 * Seed des VRAIS projets (statut « bp_reel ») depuis data/bp_projet_pipe.xlsm / Inp_Assumption.
 * Source unique : buildAll() de scripts/read_bp_matrix.ts.
 *
 *   npx tsx scripts/seed_bp_reel.ts
 *
 * Idempotent (upsert par NOM, name non @unique → findFirst + remplacement des scénarios). Écrase
 * les entrées « draft_bizdev » (import BizDev) ET l'entrée Digoin de test (seed_digoin) par le
 * VRAI Digoin de la matrice. Aucune modif du moteur. ⚠️ Écrit prisma/dev.db (NE PAS committer).
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { calculateScenarioMetrics } from "../app/lib/finance/engine";
import type { FinanceEngineInput } from "../app/lib/finance/engine";
import type { DscrTranche } from "../app/lib/finance/types";
import { buildAll, type BuiltProject } from "./read_bp_matrix";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

function toEngineInput(b: BuiltProject): FinanceEngineInput {
  const { dscrSchedule: _ignored, ...scenarioNoDscr } = b.scenario;
  return {
    ...(scenarioNoDscr as unknown as FinanceEngineInput),
    ...(b.engineOnly as unknown as FinanceEngineInput),
    dscrSchedule: b.dscrSchedule as DscrTranche[],
  } as FinanceEngineInput;
}

async function main() {
  const built = buildAll();
  console.log(`\n=== SEED bp_reel — ${built.length} projets (Inp_Assumption) ===\n`);

  for (const b of built) {
    const input = toEngineInput(b);
    let metrics;
    try {
      metrics = calculateScenarioMetrics(input);
    } catch (err) {
      console.log(`✗ ${b.name} — ERREUR calcul : ${(err as Error).message}`);
      continue;
    }

    // Inputs moteur de calibration persistés (migration persist_engagements_marge) : le tableau
    // engagements est encodé JSON (comme dscrSchedule), la marge figée telle quelle (null/0). Ainsi
    // la page projet (buildFinanceInput lit la DB) reproduit la dette/TRI de calibrate_all.
    const engagements = b.engineOnly.opexEngagementsKeuroByYear as number[] | undefined;
    const margeFactFigeeKeuro = b.engineOnly.margeFactFigeeKeuro as number | null | undefined;
    const scenario: Record<string, unknown> = {
      ...b.scenario,
      opexEngagementsKeuroByYear:
        engagements && engagements.length > 0 ? JSON.stringify(engagements) : null,
      margeFactFigeeKeuro: margeFactFigeeKeuro ?? null,
      dscr: metrics.dscr ?? 0,
      npv: metrics.npv,
      irr: metrics.irr,
      lcoe: metrics.lcoe,
    };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({ where: { name: b.name } });
      const projectData = {
        name: b.name,
        technology: b.technology,
        country: "France",
        capacityMw: b.capacityMw,
        status: "bp_reel",
        caseType: "Base",
        tariff: b.scenario.tariff as number,
        commissioningYear: b.commissioningYear,
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
      await tx.scenario.create({ data: { ...(scenario as object), projectId } as never });
    });

    console.log(
      `✓ ${b.name.padEnd(30)} ${b.technology.padEnd(8)} ${b.capacityMw} MW · ` +
        `TRI Inv ${metrics.investorIrr}% · dette ${((metrics.debtAmountKeuro ?? 0) / 1000).toFixed(2)} M€`,
    );
  }

  await prisma.$disconnect();
  console.log("\nSeed terminé (statut bp_reel).");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
