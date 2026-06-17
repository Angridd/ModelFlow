import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateScenario } from "@/app/actions";
import { prisma } from "@/app/lib/prisma";

const numericFields = [
  "capex",
  "opex",
  "yieldMwh",
  "tariff",
  "debtRate",
] as const;

export default async function EditScenarioPage({
  params,
}: {
  params: Promise<{ id: string; scenarioId: string }>;
}) {
  await connection();

  const { id, scenarioId } = await params;
  const scenario = await prisma.scenario.findFirst({
    where: {
      id: scenarioId,
      projectId: id,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!scenario) {
    notFound();
  }

  const updateScenarioForProject = updateScenario.bind(
    null,
    scenario.project.id,
    scenario.id,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/projects/${scenario.project.id}`}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          {scenario.project.name}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          Modifier le scénario
        </h1>
      </div>

      <form
        action={updateScenarioForProject}
        className="grid gap-5 rounded-md border border-zinc-200 bg-white p-6"
      >
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Nom
          <input
            name="name"
            required
            defaultValue={scenario.name}
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
                defaultValue={scenario[field]}
                className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/projects/${scenario.project.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </main>
  );
}
