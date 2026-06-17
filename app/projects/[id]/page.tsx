import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  cloneScenario,
  importScenarios,
  setReferenceScenario,
} from "@/app/actions";
import { DeleteScenarioButton } from "@/app/projects/[id]/delete-scenario-button";
import {
  calculateAnnualCashFlows,
  calculateScenarioMetrics,
} from "@/app/lib/finance/engine";
import { generateSensitivityRows } from "@/app/lib/sensitivity";
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

function formatYear(value: number) {
  return value > 0 ? String(value) : "-";
}

function formatMillionEuros(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${(value / 1_000).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} M€`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${(value * 100).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} %`;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenarioId?: string | string[] | undefined }>;
}) {
  await connection();

  const { id } = await params;
  const { scenarioId } = await searchParams;
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
  const projectReferenceScenario = scenarios.find((scenario) => scenario.isReference);
  const selectedScenarioId =
    typeof scenarioId === "string"
      ? scenarioId
      : (projectReferenceScenario?.id ?? scenarios[0]?.id);
  const analysisScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    projectReferenceScenario ??
    scenarios[0];
  const tariffSensitivityRows = analysisScenario
    ? generateSensitivityRows(analysisScenario, "tariff")
    : [];
  const capexSensitivityRows = analysisScenario
    ? generateSensitivityRows(analysisScenario, "capex")
    : [];
  const referenceMetrics = projectReferenceScenario
    ? calculateScenarioMetrics({
        capacityMw: project.capacityMw,
        capex: projectReferenceScenario.capex,
        opex: projectReferenceScenario.opex,
        yieldMwh: projectReferenceScenario.yieldMwh,
        tariff: projectReferenceScenario.tariff,
        debtRate: projectReferenceScenario.debtRate,
      })
    : null;
  const kpiNpv =
    projectReferenceScenario?.npv ?? maxValue(scenarios.map((scenario) => scenario.npv));
  const kpiIrr =
    projectReferenceScenario?.irr ?? maxValue(scenarios.map((scenario) => scenario.irr));
  const kpiDscr =
    referenceMetrics?.dscr ?? minValue(scenarios.map((scenario) => scenario.dscr));
  const kpiLcoe =
    projectReferenceScenario?.lcoe ?? minValue(scenarios.map((scenario) => scenario.lcoe));
  const importScenariosForProject = importScenarios.bind(null, project.id);
  const cashFlowScenario = projectReferenceScenario ?? analysisScenario;
  const annualCashFlows = cashFlowScenario
    ? calculateAnnualCashFlows({
        capacityMw: project.capacityMw,
        capex: cashFlowScenario.capex,
        opex: cashFlowScenario.opex,
        yieldMwh: cashFlowScenario.yieldMwh,
        tariff: cashFlowScenario.tariff,
        debtRate: cashFlowScenario.debtRate,
      })
    : [];

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

      <section className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div>
          <p className="text-sm font-medium text-zinc-500">AO</p>
          <p className="mt-1 text-zinc-950">{project.ao}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Priorite</p>
          <p className="mt-1 text-zinc-950">{project.priority}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Cas</p>
          <p className="mt-1 text-zinc-950">{project.caseType}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Region</p>
          <p className="mt-1 text-zinc-950">{project.region}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Tarif projet</p>
          <p className="mt-1 text-zinc-950">
            {formatNumber(project.tariff, " €/MWh")}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Mise en service</p>
          <p className="mt-1 text-zinc-950">
            {formatYear(project.commissioningYear)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">
            {projectReferenceScenario ? "VAN référence" : "Meilleure VAN"}
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatMillionEuros(kpiNpv)}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">
            {projectReferenceScenario ? "TRI référence" : "Meilleur TRI"}
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(kpiIrr, " %")}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">
            {projectReferenceScenario ? "DSCR référence" : "DSCR minimum"}
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(kpiDscr)}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">
            {projectReferenceScenario ? "LCOE référence" : "LCOE minimum"}
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatNumber(kpiLcoe, " €/MWh")}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">
            Resultats calcules
          </h2>
          <p className="text-sm font-medium text-zinc-500">
            {analysisScenario?.name ?? "-"}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">VAN</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {formatMillionEuros(analysisScenario?.npv ?? null)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">TRI</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {formatNumber(analysisScenario?.irr ?? null, " %")}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">LCOE</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {formatNumber(analysisScenario?.lcoe ?? null, " €/MWh")}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">
            Cash-flows annuels
          </h2>
          <p className="text-sm font-medium text-zinc-500">
            {cashFlowScenario?.name ?? "-"}
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Annee</th>
                <th className="px-4 py-3 font-medium">Production MWh</th>
                <th className="px-4 py-3 font-medium">CA kEUR</th>
                <th className="px-4 py-3 font-medium">OPEX kEUR</th>
                <th className="px-4 py-3 font-medium">Cash-flow kEUR</th>
                <th className="px-4 py-3 font-medium">Service dette kEUR</th>
                <th className="px-4 py-3 font-medium">DSCR</th>
                <th className="px-4 py-3 font-medium">CF actualise kEUR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {annualCashFlows.map((row) => (
                <tr key={row.year}>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {row.year}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.productionMwh)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.revenueKeuro)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.opexKeuro)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.cashFlowKeuro)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.debtServiceKeuro)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.dscr)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatNumber(row.discountedCashFlowKeuro)}
                  </td>
                </tr>
              ))}
              {annualCashFlows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={8}>
                    -
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Analyses</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sensibilités sur scénario de référence
            </p>
          </div>
          <form className="flex gap-2">
            <select
              name="scenarioId"
              defaultValue={analysisScenario?.id}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-900"
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Analyser
            </button>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SensitivityTable
            title="Sensibilité Tarif"
            valueLabel="Tarif"
            valueSuffix=" €/MWh"
            rows={tariffSensitivityRows}
          />
          <SensitivityTable
            title="Sensibilité CAPEX"
            valueLabel="CAPEX"
            valueSuffix=" k€/MW"
            rows={capexSensitivityRows}
          />
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
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    <div className="flex items-center gap-2">
                      <span>{scenario.name}</span>
                      {scenario.isReference ? (
                        <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                          Référence
                        </span>
                      ) : null}
                    </div>
                  </td>
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
                      {!scenario.isReference ? (
                        <form
                          action={setReferenceScenario.bind(
                            null,
                            project.id,
                            scenario.id,
                          )}
                        >
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                          >
                            Définir comme référence
                          </button>
                        </form>
                      ) : null}
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

function SensitivityTable({
  title,
  valueLabel,
  valueSuffix,
  rows,
}: {
  title: string;
  valueLabel: string;
  valueSuffix: string;
  rows: ReturnType<typeof generateSensitivityRows>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-zinc-100 text-zinc-600">
          <tr>
            <th className="px-4 py-3 font-medium">{title}</th>
            <th className="px-4 py-3 font-medium">Variation</th>
            <th className="px-4 py-3 font-medium">{valueLabel}</th>
            <th className="px-4 py-3 font-medium">VAN</th>
            <th className="px-4 py-3 font-medium">TRI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-3 font-medium text-zinc-950">{row.label}</td>
              <td className="px-4 py-3 text-zinc-700">
                {formatPercent(row.variation)}
              </td>
              <td className="px-4 py-3 text-zinc-700">
                {formatNumber(row.value, valueSuffix)}
              </td>
              <td className="px-4 py-3 text-zinc-700">
                {formatMillionEuros(row.npv)}
              </td>
              <td className="px-4 py-3 text-zinc-700">
                {formatNumber(row.irr, " %")}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-zinc-500" colSpan={5}>
                -
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
