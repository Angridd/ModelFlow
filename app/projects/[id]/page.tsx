import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cloneScenario, importScenarios } from "@/app/actions";
import { DeleteScenarioButton } from "@/app/projects/[id]/delete-scenario-button";
import { prisma } from "@/app/lib/prisma";

function maxValue(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function minValue(values: number[]) {
  return values.length > 0 ? Math.min(...values) : null;
}

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scenarios: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const scenarios = project.scenarios;
  const bestNpv = maxValue(scenarios.map((scenario) => scenario.npv));
  const bestIrr = maxValue(scenarios.map((scenario) => scenario.irr));
  const minDscr = minValue(scenarios.map((scenario) => scenario.dscr));
  const minLcoe = minValue(scenarios.map((scenario) => scenario.lcoe));
  const importScenariosForProject = importScenarios.bind(null, project.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/projects" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            Projets
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={importScenariosForProject} className="flex gap-2">
            <input
              name="csv"
              type="file"
              accept=".csv,text/csv"
              required
              className="h-10 max-w-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Importer CSV
            </button>
          </form>
          <Link
            href="/api/scenarios/template"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Télécharger template CSV
          </Link>
          <Link
            href={`/api/projects/${project.id}/scenarios/export`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Exporter CSV
          </Link>
          <Link
            href={`/projects/${project.id}/scenarios/new`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nouveau scénario
          </Link>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-zinc-500">Technologie</p>
          <p className="mt-1 text-zinc-950">{project.technology}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Pays</p>
          <p className="mt-1 text-zinc-950">{project.country}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Capacite</p>
          <p className="mt-1 text-zinc-950">{project.capacityMw} MW</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Statut</p>
          <p className="mt-1 text-zinc-950">{project.status}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Meilleure VAN</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatMillionEuros(bestNpv)}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Meilleur TRI</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(bestIrr, " %")}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">DSCR minimum</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(minDscr)}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">LCOE minimum</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(minLcoe, " €/MWh")}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">
          Comparaison des scénarios
        </h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">CAPEX</th>
                <th className="px-4 py-3 font-medium">OPEX</th>
                <th className="px-4 py-3 font-medium">Yield MWh</th>
                <th className="px-4 py-3 font-medium">Tarif</th>
                <th className="px-4 py-3 font-medium">Dette</th>
                <th className="px-4 py-3 font-medium">DSCR</th>
                <th className="px-4 py-3 font-medium">VAN</th>
                <th className="px-4 py-3 font-medium">TRI</th>
                <th className="px-4 py-3 font-medium">LCOE</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {scenarios.map((scenario) => (
                <tr key={scenario.id}>
                  <td className="px-4 py-3 font-medium text-zinc-950">{scenario.name}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.capex, " k€/MW")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.opex, " k€/MW")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.yieldMwh)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.tariff, " €/MWh")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.debtRate, " %")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.dscr)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatMillionEuros(scenario.npv)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.irr, " %")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(scenario.lcoe, " €/MWh")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <div className="flex gap-2">
                      <Link
                        href={`/projects/${project.id}/scenarios/${scenario.id}/edit`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                      >
                        Modifier
                      </Link>
                      <form action={cloneScenario.bind(null, project.id, scenario.id)}>
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          Dupliquer
                        </button>
                      </form>
                    <DeleteScenarioButton
                      projectId={project.id}
                      scenarioId={scenario.id}
                      scenarioName={scenario.name}
                    />
                    </div>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={11}>
                    -
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
