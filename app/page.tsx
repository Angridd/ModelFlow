import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";

export default async function Home() {
  await connection();

  const [projectCount, scenarioCount] = await Promise.all([
    prisma.project.count(),
    prisma.scenario.count(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Business plans energie</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal text-zinc-950">
            ModelFlow
          </h1>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nouveau projet
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Projets</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {projectCount}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-500">Scenarios</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-950">
            {scenarioCount}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">Acces rapide</h2>
        <div className="flex gap-3">
          <Link
            href="/projects"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Voir les projets
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Creer un projet
          </Link>
        </div>
      </section>
    </main>
  );
}
