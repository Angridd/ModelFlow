import Link from "next/link";
import { connection } from "next/server";
import { AnalyseView } from "@/app/components/AnalyseView";
import { buildPortfolioAnalysis } from "@/app/lib/analysisServer";
import { classifyHealth } from "@/app/lib/analysis";
import { prisma } from "@/app/lib/prisma";

export default async function AnalysePage() {
  await connection();

  // Mêmes 25 projets calibrés que le Dashboard (status « bp_reel »).
  const projects = await prisma.project.findMany({
    where: { status: "bp_reel" },
    include: { scenarios: true },
  });

  const { projects: analyses, anomalies, levers } = buildPortfolioAnalysis(projects);

  const critical = analyses.filter((a) => classifyHealth(a.metrics) === "critical").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="page-header">
        <div>
          <p className="page-breadcrumb">Analyse stratégique</p>
          <h1 className="page-title">Analyse</h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            {analyses.length} projet{analyses.length !== 1 ? "s" : ""} BP réel · {anomalies.length} anomalie
            {anomalies.length !== 1 ? "s" : ""} de coût détectée{anomalies.length !== 1 ? "s" : ""} · {critical} projet
            {critical !== 1 ? "s" : ""} critique{critical !== 1 ? "s" : ""}.{" "}
            <Link href="/" style={{ color: "var(--ps-blue-mid)", fontWeight: 600 }}>
              ← Dashboard
            </Link>
          </p>
        </div>
        <Link href="/api/projects/export" className="btn-secondary">
          Exporter tout (Excel)
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "#6b7280" }}>
          Aucun projet calibré à analyser.
        </div>
      ) : (
        <AnalyseView projects={analyses} anomalies={anomalies} levers={levers} />
      )}
    </main>
  );
}
