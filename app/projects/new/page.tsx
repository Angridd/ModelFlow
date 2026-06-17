import Link from "next/link";
import { createProject } from "@/app/actions";

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/projects" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          Projets
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          Nouveau projet
        </h1>
      </div>

      <form action={createProject} className="grid gap-5 rounded-md border border-zinc-200 bg-white p-6">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Nom
          <input
            name="name"
            required
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Technologie
          <input
            name="technology"
            required
            placeholder="PV, Batterie, Hybride, PPA..."
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Pays
          <input
            name="country"
            required
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
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Statut
          <select
            name="status"
            required
            defaultValue="Draft"
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="Draft">Draft</option>
            <option value="In review">In review</option>
            <option value="Approved">Approved</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          AO
          <input
            name="ao"
            required
            placeholder="AO CRE, PPA, Corporate..."
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Priorite
          <select
            name="priority"
            required
            defaultValue="Medium"
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Cas
          <input
            name="caseType"
            required
            placeholder="Base, Upside, Downside..."
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Region
          <input
            name="region"
            required
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Tarif
          <input
            name="tariff"
            required
            type="number"
            min="0"
            step="0.01"
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Annee de mise en service
          <input
            name="commissioningYear"
            required
            type="number"
            min="1900"
            step="1"
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
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
            Creer
          </button>
        </div>
      </form>
    </main>
  );
}
