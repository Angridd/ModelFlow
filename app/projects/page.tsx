import Link from "next/link";
import { connection } from "next/server";
import { AuroraImport } from "@/app/components/AuroraImport";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { DeleteProjectButton } from "@/app/projects/delete-project-button";
import { computeProjectFinance } from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

function formatAuroraQuarter(value: Date) {
  return `Q${Math.floor(value.getMonth() / 3) + 1} ${value.getFullYear()}`;
}

function formatAuroraTechnology(value: string | null | undefined) {
  return value === "tracking" ? "Tracking" : "Fixed";
}

function getStatusStripe(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "rtb") return "stripe-green";
  if (s === "in review" || s === "permitted") return "stripe-blue";
  return "stripe-yellow";
}

function getStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "rtb") return "badge badge-green";
  if (s === "in review" || s === "permitted") return "badge badge-blue";
  return "badge badge-yellow";
}

function fmtIrr(v: number | null | undefined) {
  if (v == null || v <= 0) return "-";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function fmtNpv(v: number | null | undefined) {
  if (v == null) return "-";
  return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
}

function fmtLcoe(v: number | null | undefined) {
  if (v == null || v <= 0) return "-";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/MWh`;
}

export default async function ProjectsPage() {
  await connection();

  const [projects, latestAuroraCurve] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        scenarios: {
          where: { isReference: true },
          take: 1,
        },
      },
    }),
    prisma.auroraCurve.findFirst({
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="page-header">
        <div>
          <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Projets" }]} />
          <h1 className="page-title">Projets</h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Accès rapide fiche par fiche : {projects.length} projet{projects.length !== 1 ? "s" : ""} (tous statuts).{" "}
            <Link href="/" style={{ color: "var(--ps-blue-mid)", fontWeight: 600 }}>
              Analyse portefeuille →
            </Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/projects/new" className="btn-primary">
            + Nouveau projet
          </Link>
        </div>
      </div>

      {/* Aurora section */}
      <div className="aurora-section">
        <div>
          <p className="section-title" style={{ fontSize: "0.95rem" }}>Courbes Aurora</p>
          <div style={{ marginTop: "0.5rem" }}>
            {latestAuroraCurve ? (
              <span className="badge badge-green">
                {formatAuroraQuarter(latestAuroraCurve.updatedAt)} ·{" "}
                {formatAuroraTechnology(latestAuroraCurve.technology)}
              </span>
            ) : (
              <span className="badge badge-yellow">Aucune courbe Aurora</span>
            )}
          </div>
        </div>
        <AuroraImport
          auroraUpdatedAt={latestAuroraCurve?.updatedAt.toISOString() ?? null}
          auroraTechnology={latestAuroraCurve?.technology ?? null}
          debtSizingCentralW={null}
          debtSizingLowW={null}
          investorCurveW={null}
        />
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: "center", padding: "3rem 2rem", color: "#6b7280" }}
        >
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "#374151" }}>
            Aucun projet pour le moment.
          </p>
          <p style={{ fontSize: "0.875rem", marginTop: "0.375rem" }}>
            Créez votre premier projet pour commencer.
          </p>
          <Link
            href="/projects/new"
            className="btn-primary"
            style={{ marginTop: "1.25rem", display: "inline-flex" }}
          >
            + Nouveau projet
          </Link>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project, i) => {
            const refScenario = project.scenarios[0];
            // Chemin unifié : TRI investisseur / VAN nette / LCOE recalculés (== détail == dashboard).
            const finance = refScenario ? computeProjectFinance(project, refScenario) : null;
            const delayClass = `delay-${Math.min(i + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}`;
            return (
              <div key={project.id} className={`project-card fade-up ${delayClass}`}>
                <div className={`project-card-stripe ${getStatusStripe(project.status)}`} />
                <div className="project-card-body">
                  <Link
                    href={`/projects/${project.id}`}
                    className="project-card-name"
                    style={{ display: "inline-block" }}
                  >
                    {project.name}
                  </Link>
                  <div className="project-card-mw">
                    {project.capacityMw}{" "}
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#6b7280",
                        fontFamily: "inherit",
                      }}
                    >
                      MW
                    </span>
                  </div>
                  <div className="project-card-badges">
                    <span className={getStatusBadgeClass(project.status)}>
                      {project.status}
                    </span>
                    <span className="badge badge-blue">{project.technology}</span>
                    {project.region ? (
                      <span className="badge badge-gray">{project.region}</span>
                    ) : null}
                    {project.ao ? (
                      <span className="badge badge-gray">{project.ao}</span>
                    ) : null}
                  </div>
                  {refScenario && finance ? (
                    <div className="project-card-kpis">
                      <div className="project-card-kpi">
                        <span className="project-card-kpi-label">TRI inv.</span>
                        <span className="project-card-kpi-value">
                          {fmtIrr(finance.metrics.investorIrr)}
                        </span>
                      </div>
                      <div className="project-card-kpi">
                        <span className="project-card-kpi-label">VAN nette</span>
                        <span className="project-card-kpi-value">
                          {fmtNpv(finance.metrics.npv)}
                        </span>
                      </div>
                      <div className="project-card-kpi">
                        <span className="project-card-kpi-label">LCOE</span>
                        <span className="project-card-kpi-value">
                          {fmtLcoe(finance.metrics.lcoe)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: "0.5rem" }} />
                  )}
                  <div className="project-card-cta">
                    <Link
                      href={`/projects/${project.id}/edit`}
                      className="btn-secondary btn-sm"
                    >
                      Modifier
                    </Link>
                    <DeleteProjectButton
                      projectId={project.id}
                      projectName={project.name}
                    />
                    <Link
                      href={`/projects/${project.id}`}
                      className="btn-primary btn-sm"
                    >
                      Voir →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
