import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { buildBpModel, type BpLine, type BpUnit } from "@/app/lib/bpModel";
import { pickReferenceScenario } from "@/app/lib/scenarioMetrics";
import { prisma } from "@/app/lib/prisma";

function formatBpValue(value: number, unite: BpUnit): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const nf = (min: number, max: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });

  switch (unite) {
    case "kEUR":
    case "kEUR/MW":
      return nf(0, 1);
    case "%":
    case "ratio":
      return nf(2, 2);
    case "MWh":
      return nf(0, 0);
    case "EUR/MWh":
    case "MW":
      return nf(0, 2);
    case "annees":
      return nf(0, 0);
    default:
      return nf(0, 2);
  }
}

function unitLabel(unite: BpUnit): string {
  switch (unite) {
    case "kEUR":
      return "k€";
    case "kEUR/MW":
      return "k€/MW";
    case "%":
      return "%";
    case "ratio":
      return "x";
    case "MWh":
      return "MWh";
    case "EUR/MWh":
      return "€/MWh";
    case "MW":
      return "MW";
    case "annees":
      return "ans";
    default:
      return "";
  }
}

function labelWithUnit(line: BpLine): string {
  const u = unitLabel(line.unite);
  return u ? `${line.label} (${u})` : line.label;
}

// Cellule libellé collante (1re colonne) : reste visible au scroll horizontal.
const stickyLabelStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  minWidth: "16rem",
  maxWidth: "16rem",
};

export default async function ProjectBpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { scenarios: { orderBy: { name: "asc" } } },
  });

  if (!project) {
    notFound();
  }

  const scenario = pickReferenceScenario(project.scenarios);

  if (!scenario) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Projets", href: "/projects" },
            { label: project.name, href: `/projects/${project.id}` },
            { label: "Modèle BP" },
          ]}
        />
        <section className="card">
          <p style={{ color: "#6b7280" }}>
            Aucun scénario disponible pour ce projet — impossible de construire le modèle BP.
          </p>
        </section>
      </main>
    );
  }

  const model = buildBpModel(project, scenario);
  const nbYears = model.years.length;

  return (
    <main className="mx-auto flex w-full max-w-[95rem] flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Projets", href: "/projects" },
            { label: project.name, href: `/projects/${project.id}` },
            { label: "Modèle BP" },
          ]}
        />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 className="section-title" style={{ fontSize: "1.6rem" }}>
              Modèle BP complet — {model.projectName}
            </h1>
            <p className="section-subtitle">
              Toutes les lignes du modèle, année par année · scénario {model.scenarioName} ·{" "}
              {nbYears} années
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link href={`/api/projects/${project.id}/export`} className="btn-secondary">
              Exporter Excel (BP)
            </Link>
            <Link href={`/projects/${project.id}`} className="btn-secondary">
              ← Retour à la fiche
            </Link>
          </div>
        </div>
      </div>

      <div
        className="overflow-x-auto"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}
      >
        <table className="ps-table" style={{ minWidth: `${16 + nbYears * 5}rem` }}>
          <thead>
            <tr>
              <th className="col-left" style={stickyLabelStyle}>
                Ligne
              </th>
              {model.years.map((year) => (
                <th key={year}>{year <= 0 ? `an${year}` : `an${year}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.sections.map((section) => (
              <SectionBlock
                key={section.title}
                title={section.title}
                lines={section.lines}
                nbYears={nbYears}
              />
            ))}
          </tbody>
        </table>
      </div>

      {model.gaps.length > 0 ? (
        <section className="card">
          <h2 className="section-title" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            Notes — champs BP non exposés au grain annuel par le moteur
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#6b7280", fontSize: "0.82rem", lineHeight: 1.6 }}>
            {model.gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function SectionBlock({
  title,
  lines,
  nbYears,
}: {
  title: string;
  lines: BpLine[];
  nbYears: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={nbYears + 1}
          className="col-left"
          style={{
            position: "sticky",
            left: 0,
            zIndex: 2,
            background: "var(--ps-blue-light)",
            color: "var(--ps-blue-dark)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontSize: "0.7rem",
          }}
        >
          {title}
        </td>
      </tr>
      {lines.map((line) => (
        <tr key={line.label}>
          <td className="col-left" style={{ ...stickyLabelStyle, fontWeight: line.emphasis ? 700 : 600 }}>
            {labelWithUnit(line)}
          </td>
          {line.scalar ? (
            <>
              <td style={{ fontWeight: line.emphasis ? 700 : undefined, color: "var(--ps-blue-dark)" }}>
                {formatBpValue(line.valeurs[0] ?? NaN, line.unite)}
              </td>
              {Array.from({ length: nbYears - 1 }, (_, i) => (
                <td key={i} style={{ color: "#d1d5db" }}>
                  ·
                </td>
              ))}
            </>
          ) : (
            line.valeurs.map((value, i) => (
              <td key={i} style={{ fontWeight: line.emphasis ? 700 : undefined }}>
                {formatBpValue(value, line.unite)}
              </td>
            ))
          )}
        </tr>
      ))}
    </>
  );
}
