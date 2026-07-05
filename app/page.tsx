import Link from "next/link";
import { connection } from "next/server";
import { PortfolioDashboard, type DashboardRow } from "@/app/components/PortfolioDashboard";
import { evaluateCalibration, loadCibles } from "@/app/lib/calibration";
import { computeProjectFinance, pickReferenceScenario } from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

export default async function Home() {
  await connection();

  // Portefeuille calibré = projets « bp_reel » (mêmes 25 projets que calibrate_all, chacun doté d'une
  // cible BP data/cibles/<slug>.json). Les projets draft/pipe restent visibles sur /projects.
  const [projects, cibles] = await Promise.all([
    prisma.project.findMany({ where: { status: "bp_reel" }, include: { scenarios: true } }),
    Promise.resolve(loadCibles()),
  ]);

  // Chemin de calcul UNIFIÉ : chaque projet recalculé via computeProjectFinance (== page détail ==
  // liste). Le TRI affiché est le TRI INVESTISSEUR (equity BP). Statut calibration = logique
  // calibrate_all réappliquée sur la cible BP data/cibles/<slug>.json.
  const rows: DashboardRow[] = projects
    .map((project): DashboardRow | null => {
      const scenario = pickReferenceScenario(project.scenarios);
      if (!scenario) return null;
      const finance = computeProjectFinance(project, scenario);
      const calibration = evaluateCalibration(
        project.name,
        project.capacityMw,
        finance.capexCalibKeuro,
        finance.debtRetenuKeuro,
        finance.metrics.investorIrr,
        cibles,
      );
      return {
        id: project.id,
        name: project.name,
        technology: project.technology,
        capacityMw: project.capacityMw,
        commissioningYear: project.commissioningYear,
        investorIrr: finance.metrics.investorIrr,
        vanBruteKeuro: finance.vanBruteKeuro,
        vanNetteKeuro: finance.vanNetteKeuro,
        debtKeuro: finance.debtRetenuKeuro,
        equityCcaKeuro: finance.ccaKeuro,
        capexEffectifKeuro: finance.capexEffectifKeuro,
        gearingPct: finance.gearingPct,
        dscr: finance.metrics.dscr,
        lcoe: finance.metrics.lcoe,
        calibration: calibration.status,
        calibrationDetail: calibration.detail,
      };
    })
    .filter((r): r is DashboardRow => r !== null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="page-header">
        <div>
          <p className="page-breadcrumb">Cockpit portefeuille</p>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Analyse consolidée du portefeuille calibré : {rows.length} projet{rows.length !== 1 ? "s" : ""} BP réel ·
            TRI investisseur (equity BP) recalculé en direct.{" "}
            <Link href="/projects" style={{ color: "var(--ps-blue-mid)", fontWeight: 600 }}>
              Accès fiche par fiche →
            </Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/projects" className="btn-secondary">Liste des projets</Link>
          <Link href="/projects/new" className="btn-primary">+ Nouveau projet</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "#6b7280" }}>
          Aucun projet pour le moment.
        </div>
      ) : (
        <PortfolioDashboard rows={rows} />
      )}
    </main>
  );
}
