import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateProject } from "@/app/actions";
import { prisma } from "@/app/lib/prisma";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    notFound();
  }

  const updateProjectById = updateProject.bind(null, project.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/projects" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          Projets
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          Modifier le projet
        </h1>
      </div>

      <form action={updateProjectById} className="grid gap-5 rounded-md border border-zinc-200 bg-white p-6">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Nom
          <input
            name="name"
            required
            defaultValue={project.name}
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Technologie
          <input
            name="technology"
            required
            defaultValue={project.technology}
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Pays
          <input
            name="country"
            required
            defaultValue={project.country}
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Capacite MW
          <input
            name="capacityMw"
            required
            type="number"
            min="0"
            step="0.01"
            defaultValue={project.capacityMw}
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Statut
          <select
            name="status"
            required
            defaultValue={project.status}
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="Draft">Draft</option>
            <option value="In review">In review</option>
            <option value="Approved">Approved</option>
          </select>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/projects"
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
