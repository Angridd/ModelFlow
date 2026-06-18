import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateScenario } from "@/app/actions";
import { DscrSchedule } from "@/app/components/DscrSchedule";
import type { DscrTranche } from "@/app/lib/finance/types";
import { prisma } from "@/app/lib/prisma";

const primaryFields = [
  {
    name: "capex" as const,
    label: "CAPEX (k€/MW)",
    step: "0.01",
    placeholder: "ex. 700",
    title: "Coût d'investissement en k€ par MW installé (solaire posé : 650–750 k€/MW)",
  },
  {
    name: "opex" as const,
    label: "OPEX (k€/MW/an)",
    step: "0.01",
    placeholder: "ex. 15",
    title: "Charges d'exploitation annuelles en k€ par MW installé (solaire : 12–18 k€/MW/an)",
  },
  {
    name: "tariff" as const,
    label: "Tarif (€/MWh)",
    step: "0.01",
    placeholder: "ex. 75",
    title: "Prix de vente de l'électricité en €/MWh (tarif CRE ou contrat de marché)",
  },
  {
    name: "debtRate" as const,
    label: "Dette cible (%)",
    step: "0.01",
    placeholder: "ex. 70",
    title: "Part du CAPEX financée par la dette en % (ex. 70 % pour un financement de projet solaire)",
  },
] as const;

const assumptionFields = [
  {
    name: "projectLifeYears" as const,
    label: "Durée projet (ans)",
    step: "1",
    placeholder: "ex. 30",
    title: "Durée totale d'exploitation du projet (ex. 25–30 ans)",
  },
  {
    name: "degradationRate" as const,
    label: "Dégradation (%/an)",
    step: "0.01",
    placeholder: "ex. 0.3",
    title: "Perte de production annuelle des panneaux en % (PV : 0,3–0,5 %/an)",
  },
  {
    name: "discountRate" as const,
    label: "Taux actualisation (%)",
    step: "0.01",
    placeholder: "ex. 6",
    title: "WACC ou coût des fonds propres en % (ex. 6–8 %)",
  },
  {
    name: "debtInterestRate" as const,
    label: "Taux d'intérêt dette (%)",
    step: "0.01",
    placeholder: "ex. 4",
    title: "Taux d'intérêt annuel de la dette senior (financement de projet : 4–5 %)",
  },
  {
    name: "debtMaturityYears" as const,
    label: "Maturité dette (ans)",
    step: "1",
    placeholder: "ex. 20",
    title: "Durée d'amortissement de la dette pour le service annualisé (ex. 15–20 ans)",
  },
  {
    name: "tariffInflationRate" as const,
    label: "Inflation tarif (%/an)",
    step: "0.01",
    placeholder: "ex. 0",
    title: "Revalorisation annuelle du tarif en % (souvent 0 pour les tarifs réglementés)",
  },
  {
    name: "opexInflationRate" as const,
    label: "Inflation OPEX (%/an)",
    step: "0.01",
    placeholder: "ex. 2",
    title: "Revalorisation annuelle des charges en % (ex. 2 % = inflation générale)",
  },
] as const;

const fiscalFields = [
  {
    name: "tauxIS" as const,
    label: "Taux IS (%)",
    step: "0.01",
    placeholder: "ex. 25",
    title: "Taux d'impot sur les societes applique au resultat fiscal.",
  },
  {
    name: "amortDuree" as const,
    label: "Duree amortissement (ans)",
    step: "1",
    placeholder: "ex. 20",
    title: "Duree d'amortissement comptable utilisee pour le calcul fiscal.",
  },
  {
    name: "dsraMonths" as const,
    label: "DSRA (mois)",
    step: "1",
    placeholder: "ex. 6",
    title: "Nombre de mois de service dette a couvrir en reserve DSRA.",
  },
  {
    name: "devFeesKEuroPerMW" as const,
    label: "Dev fees (kEUR/MW)",
    step: "0.01",
    placeholder: "ex. 110",
    title: "Frais de developpement factures au closing, en kEUR par MW.",
  },
  {
    name: "tauxISEntreprise" as const,
    label: "Taux IS entreprise (%)",
    step: "0.01",
    placeholder: "ex. 25",
    title: "Taux IS applique aux revenus de l'entreprise pour le double TRI.",
  },
] as const;

function resolveInitialSchedule(
  dscrScheduleJson: string | null,
  dscrTarget: number | null,
  debtTenorYears: number | null,
): DscrTranche[] | null {
  if (dscrScheduleJson) {
    try {
      const parsed = JSON.parse(dscrScheduleJson) as DscrTranche[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  if (dscrTarget != null && dscrTarget > 0 && debtTenorYears != null && debtTenorYears > 0) {
    return [{ yearFrom: 1, yearTo: debtTenorYears, dscrValue: dscrTarget }];
  }
  return null;
}

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

  const initialDscrSchedule = resolveInitialSchedule(
    scenario.dscrSchedule,
    scenario.dscrTarget,
    scenario.debtTenorYears,
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
            placeholder="ex. Base case"
            title="Nom du scénario"
            className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          {primaryFields.map((field) => (
            <label key={field.name} className="grid gap-2 text-sm font-medium text-zinc-700">
              {field.label}
              <input
                name={field.name}
                required
                type="number"
                step={field.step}
                defaultValue={scenario[field.name]}
                placeholder={field.placeholder}
                title={field.title}
                className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Productible P50 (MWh/MW/an)
            <input
              name="yieldMwh"
              required
              type="number"
              step="0.01"
              defaultValue={scenario.yieldMwh}
              placeholder="ex. 1450"
              title="Production annuelle en MWh par MW installé — scénario médian P50 (solaire France : 1 300–1 600 MWh/MW/an)"
              className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Productible P90 (MWh/MW/an)
            <input
              name="yieldP90Mwh"
              type="number"
              step="0.01"
              defaultValue={scenario.yieldP90Mwh ?? ""}
              placeholder="Défaut : P50 × 0,9"
              title="Production annuelle au niveau de confiance P90 — solaire : environ P50 × 0,9. Utilisé pour le dimensionnement bancaire (DSCR)."
              className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
            />
          </label>
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
                defaultValue={scenario[field.name]}
                placeholder={field.placeholder}
                title={field.title}
                className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Ténor dette sculptée (ans)
            <input
              name="debtTenorYears"
              type="number"
              step="1"
              min="0"
              defaultValue={scenario.debtTenorYears ?? ""}
              placeholder="ex. 15"
              title="Durée de remboursement de la dette sculptée. Si omis, le ténor est déduit de l'année fin de la dernière tranche du profil DSCR."
              className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Gearing maximum autorisé (%)
            <input
              name="gearingMaxPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={scenario.gearingMaxPct ?? ""}
              placeholder="ex. 90"
              title="Plafond de dette en % du CAPEX effectif"
              className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
            />
          </label>
        </div>

        <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="text-sm font-semibold text-zinc-950">Fiscalité & CCA</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {fiscalFields.map((field) => (
              <label
                key={field.name}
                className="grid gap-2 text-sm font-medium text-zinc-700"
              >
                {field.label}
                <input
                  name={field.name}
                  type="number"
                  min="0"
                  step={field.step}
                  defaultValue={scenario[field.name] ?? ""}
                  placeholder={field.placeholder}
                  title={field.title}
                  className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400"
                />
              </label>
            ))}
          </div>
        </section>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-zinc-700">Profil DSCR cible</p>
          <DscrSchedule initialValue={initialDscrSchedule} />
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
