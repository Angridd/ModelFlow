import Link from "next/link";
import { connection } from "next/server";
import { bestIrr, bestNpv, scenarioCount } from "@/app/lib/portfolio";
import { prisma } from "@/app/lib/prisma";

function formatNumber(value: number | null, suffix = "") {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function formatMillionEuros(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${(value / 1_000_000).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} M€`;
}

function formatMw(value: number) {
  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} MW`;
}

function formatYear(value: number) {
  return value > 0 ? String(value) : "-";
}

export default async function Home() {
  await connection();

  const projects = await prisma.project.findMany({
    include: {
      scenarios: {
        select: {
          npv: true,
          irr: true,
        },
      },
    },
  });

  const rows = projects
    .map((project) => ({
      ...project,
      scenarioCount: scenarioCount(project),
      bestNpv: bestNpv(project),
      bestIrr: bestIrr(project),
    }))
    .sort((a, b) => (b.bestNpv ?? -Infinity) - (a.bestNpv ?? -Infinity));

  const projectCount = projects.length;
  const totalScenarioCount = projects.reduce(
    (total, project) => total + scenarioCount(project),
    0,
  );
  const totalCapacityMw = projects.reduce(
    (total, project) => total + project.capacityMw,
    0,
  );
  const totalBestNpv = projects.reduce(
    (total, project) => total + (bestNpv(project) ?? 0),
    0,
  );
  const bestIrrValues = projects
    .map((project) => bestIrr(project))
    .filter((value): value is number => value !== null);
  const averageBestIrr =
    bestIrrValues.length > 0
      ? bestIrrValues.reduce((total, value) => total + value, 0) /
        bestIrrValues.length
      : null;
  const averagePortfolioTariff =
    projects.length > 0
      ? projects.reduce((total, project) => total + project.tariff, 0) /
        projects.length
      : null;

  const mwByTechnology = Array.from(
    projects
      .reduce((totals, project) => {
        totals.set(
          project.technology,
          (totals.get(project.technology) ?? 0) + project.capacityMw,
        );
        return totals;
      }, new Map<string, number>())
      .entries(),
  ).sort((a, b) => b[1] - a[1]);
  const maxTechnologyMw = Math.max(0, ...mwByTechnology.map(([, mw]) => mw));

  const mwByAo = Array.from(
    projects
      .reduce((totals, project) => {
        totals.set(project.ao, (totals.get(project.ao) ?? 0) + project.capacityMw);
        return totals;
      }, new Map<string, number>())
      .entries(),
  ).sort((a, b) => b[1] - a[1]);
  const maxAoMw = Math.max(0, ...mwByAo.map(([, mw]) => mw));

  const mwByPriority = Array.from(
    projects
      .reduce((totals, project) => {
        totals.set(
          project.priority,
          (totals.get(project.priority) ?? 0) + project.capacityMw,
        );
        return totals;
      }, new Map<string, number>())
      .entries(),
  ).sort((a, b) => b[1] - a[1]);
  const maxPriorityMw = Math.max(0, ...mwByPriority.map(([, mw]) => mw));

  const projectsByStatus = Array.from(
    projects
      .reduce((totals, project) => {
        totals.set(project.status, (totals.get(project.status) ?? 0) + 1);
        return totals;
      }, new Map<string, number>())
      .entries(),
  ).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = Math.max(0, ...projectsByStatus.map(([, count]) => count));

  const projectsByCaseType = Array.from(
    projects
      .reduce((totals, project) => {
        totals.set(project.caseType, (totals.get(project.caseType) ?? 0) + 1);
        return totals;
      }, new Map<string, number>())
      .entries(),
  ).sort((a, b) => b[1] - a[1]);
  const maxCaseTypeCount = Math.max(
    0,
    ...projectsByCaseType.map(([, count]) => count),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Cockpit portefeuille</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal text-zinc-950">
            ModelFlow
          </h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/projects"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Projets
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nouveau projet
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Projets</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {projectCount}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Scenarios</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {totalScenarioCount}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Capacite totale</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {formatNumber(totalCapacityMw, " MW")}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">VAN totale</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {formatMillionEuros(totalBestNpv)}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">TRI moyen</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {formatNumber(averageBestIrr, " %")}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Tarif moyen</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {formatNumber(averagePortfolioTariff, " €/MWh")}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PortfolioBars
          title="MW par technologie"
          rows={mwByTechnology}
          maxValue={maxTechnologyMw}
          formatValue={formatMw}
          barClassName="bg-zinc-900"
        />
        <PortfolioBars
          title="MW par AO"
          rows={mwByAo}
          maxValue={maxAoMw}
          formatValue={formatMw}
          barClassName="bg-zinc-900"
        />
        <PortfolioBars
          title="MW par priorite"
          rows={mwByPriority}
          maxValue={maxPriorityMw}
          formatValue={formatMw}
          barClassName="bg-zinc-700"
        />
        <PortfolioBars
          title="Projets par statut"
          rows={projectsByStatus}
          maxValue={maxStatusCount}
          formatValue={(value) => String(value)}
          barClassName="bg-zinc-500"
        />
        <PortfolioBars
          title="Projets par cas"
          rows={projectsByCaseType}
          maxValue={maxCaseTypeCount}
          formatValue={(value) => String(value)}
          barClassName="bg-zinc-500"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">Portefeuille</h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Projet</th>
                <th className="px-4 py-3 font-medium">Technologie</th>
                <th className="px-4 py-3 font-medium">AO</th>
                <th className="px-4 py-3 font-medium">Priorite</th>
                <th className="px-4 py-3 font-medium">Cas</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">MW</th>
                <th className="px-4 py-3 font-medium">Tarif</th>
                <th className="px-4 py-3 font-medium">MES</th>
                <th className="px-4 py-3 font-medium">Scenarios</th>
                <th className="px-4 py-3 font-medium">Meilleure VAN</th>
                <th className="px-4 py-3 font-medium">Meilleur TRI</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-zinc-950 hover:text-zinc-600"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{project.technology}</td>
                  <td className="px-4 py-3 text-zinc-700">{project.ao}</td>
                  <td className="px-4 py-3 text-zinc-700">{project.priority}</td>
                  <td className="px-4 py-3 text-zinc-700">{project.caseType}</td>
                  <td className="px-4 py-3 text-zinc-700">{project.region}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(project.capacityMw)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(project.tariff, " €/MWh")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatYear(project.commissioningYear)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {project.scenarioCount}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatMillionEuros(project.bestNpv)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(project.bestIrr, " %")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{project.status}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={13}>
                    Aucun projet pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function PortfolioBars({
  title,
  rows,
  maxValue,
  formatValue,
  barClassName,
}: {
  title: string;
  rows: [string, number][];
  maxValue: number;
  formatValue: (value: number) => string;
  barClassName: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-5 flex flex-col gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-700">{label}</span>
              <span className="text-zinc-500">{formatValue(value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${barClassName}`}
                style={{
                  width:
                    maxValue === 0 ? "0%" : `${(value / maxValue) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-zinc-500">-</p> : null}
      </div>
    </div>
  );
}
