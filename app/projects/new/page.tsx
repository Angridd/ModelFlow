import Link from "next/link";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { createProject } from "@/app/actions";

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Projets", href: "/projects" },
            { label: "Nouveau projet" },
          ]}
        />
        <h1 className="page-title" style={{ marginTop: "0.25rem" }}>
          Nouveau projet
        </h1>
      </div>

      <form action={createProject} className="form-card grid gap-5">
        <span className="form-section-title">Identification</span>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Nom du projet
            <input
              name="name"
              required
              placeholder="ex. Solaire Bordeaux Sud"
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Technologie
            <input
              name="technology"
              required
              placeholder="PV, Batterie, Hybride..."
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Pays
            <input
              name="country"
              required
              placeholder="France"
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Capacité (MW)
            <input
              name="capacityMw"
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="ex. 50"
              className="h-10 px-3"
            />
          </label>
        </div>

        <span className="form-section-title">Statut &amp; Priorité</span>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Statut
            <select name="status" required defaultValue="Draft" className="h-10 px-3">
              <option value="Draft">Draft</option>
              <option value="In review">In review</option>
              <option value="Approved">Approved</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Priorité
            <select name="priority" required defaultValue="Medium" className="h-10 px-3">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            AO
            <input
              name="ao"
              required
              placeholder="AO CRE, PPA, Corporate..."
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Cas
            <input
              name="caseType"
              required
              placeholder="Base, Upside, Downside..."
              className="h-10 px-3"
            />
          </label>
        </div>

        <span className="form-section-title">Localisation &amp; Financier</span>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Région
            <input name="region" required placeholder="ex. Nouvelle-Aquitaine" className="h-10 px-3" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Tarif (€/MWh)
            <input
              name="tariff"
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="ex. 75"
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Année de mise en service
            <input
              name="commissioningYear"
              required
              type="number"
              min="1900"
              step="1"
              placeholder="ex. 2026"
              className="h-10 px-3"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer le projet
          </button>
        </div>
      </form>
    </main>
  );
}
