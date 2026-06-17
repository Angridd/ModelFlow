import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";

export default async function ProjectsPage() {
  await connection();

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ModelFlow
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Projets
          </h1>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nouveau projet
        </Link>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Technologie</th>
              <th className="px-4 py-3 font-medium">Capacite</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {projects.map((project) => (
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
                <td className="px-4 py-3 text-zinc-700">{project.capacityMw} MW</td>
                <td className="px-4 py-3 text-zinc-700">{project.status}</td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={4}>
                  Aucun projet pour le moment.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
