import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createScenario } from "@/app/actions";
import { DEFAULT_FINANCIAL_ASSUMPTIONS } from "@/app/lib/finance/types";
import { prisma } from "@/app/lib/prisma";

const numericFields = ["capex", "opex", "yieldMwh", "tariff", "debtRate"] as const;

const assumptionFields = [
  {
    name: "projectLifeYears",
    label: "Duree projet",
    step: "1",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.projectLifeYears,
  },
  {
    name: "degradationRate",
    label: "Degradation",
    step: "0.01",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.degradationRate,
  },
  {
    name: "discountRate",
    label: "Taux actualisation",
    step: "0.01",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.discountRate,
  },
  {
    name: "debtInterestRate",
    label: "Taux dette",
    step: "0.01",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.debtInterestRate,
  },
  {
    name: "debtMaturityYears",
    label: "Maturite dette",
    step: "1",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.debtMaturityYears,
  },
  {
    name: "tariffInflationRate",
    label: "Inflation tarif",
    step: "0.01",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.tariffInflationRate,
  },
  {
    name: "opexInflationRate",
    label: "Inflation OPEX",
    step: "0.01",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.opexInflationRate,
  },
] as const;

export default async function NewScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!project) {
    notFound();
  }

  const createScenarioForProject = createScenario.bind(null, project.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          {project.name}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          Nouveau scénario
        </h1>
      </div>

      <form
        action={createScenarioForProject}
        className="grid gap-5 rounded-md border border-zinc-200 bg-white p-6"
      >
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Nom
          <input
            name="name"
            required
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          {numericFields.map((field) => (
            <label key={field} className="grid gap-2 text-sm font-medium text-zinc-700">
              {field}
              <input
                name={field}
                required
                type="number"
                step="0.01"
                className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {assumptionFields.map((field) => (
            <label
              key={field.name}
              className="grid gap-2 text-sm font-medium text-zinc-700"
            >
              {field.label}
              <input
                name={field.name}
                required
                type="number"
                min="0"
                step={field.step}
                defaultValue={field.defaultValue}
                className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Creer
          </button>
        </div>
      </form>
    </main>
  );
}
