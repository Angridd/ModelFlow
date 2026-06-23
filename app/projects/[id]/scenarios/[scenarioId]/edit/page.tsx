import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { updateScenario } from "@/app/actions";
import { CapexDetailFields } from "@/app/components/CapexDetailFields";
import { DefaultNumberInput } from "@/app/components/DefaultNumberInput";
import { DscrSchedule } from "@/app/components/DscrSchedule";
import { FinancingFeesFields } from "@/app/components/FinancingFeesFields";
import { OpexDetailFields } from "@/app/components/OpexDetailFields";
import {
  DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS,
  type DscrTranche,
} from "@/app/lib/finance/types";
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
    label: "Durée de la dette (ans)",
    step: "1",
    placeholder: "ex. 18",
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
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.tauxIS,
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
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.dsraMonths,
  },
  {
    name: "devFeesKEuroPerMW" as const,
    label: "Dev fees (kEUR/MW)",
    step: "0.01",
    placeholder: "ex. 110",
    title: "Frais de developpement factures au closing, en kEUR par MW.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.devFeesKEuroPerMW,
  },
  {
    name: "tauxISEntreprise" as const,
    label: "Taux IS entreprise (%)",
    step: "0.01",
    placeholder: "ex. 25",
    title: "Taux IS applique aux revenus de l'entreprise pour le double TRI.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.tauxISEntreprise,
  },
] as const;

const revenueFields = [
  {
    name: "contractDuration" as const,
    label: "Duree contrat tarifaire (ans)",
    step: "1",
    placeholder: "ex. 20",
    title: "Duree du tarif contractuel. Prix marche applique ensuite",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.contractDuration,
  },
] as const;

const opexExtraFields = [
  {
    name: "assuranceRate" as const,
    label: "Assurance (% du CA P50)",
    step: "0.01",
    placeholder: "ex. 2.5",
    title: "Assurance annuelle calculee en pourcentage du chiffre d'affaires P50.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.assuranceRate,
  },
  {
    name: "inflationAssurance" as const,
    label: "Inflation assurance (%/an)",
    step: "0.01",
    placeholder: "ex. 2",
    title: "Inflation annuelle appliquee au cout d'assurance.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationAssurance,
  },
  {
    name: "balancingCost" as const,
    label: "Balancing cost (EUR/MWh)",
    step: "0.01",
    placeholder: "ex. 2",
    title: "Cout de balancing applique a la production P50.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.balancingCost,
  },
] as const;

type AuroraStatus = {
  imported: boolean;
  technology: string | null;
  updatedAt: string | null;
};

async function getAuroraStatus(): Promise<AuroraStatus> {
  const headersList = await headers();
  const host = headersList.get("host");

  if (!host) {
    return { imported: false, technology: null, updatedAt: null };
  }

  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const response = await fetch(`${protocol}://${host}/api/aurora/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return { imported: false, technology: null, updatedAt: null };
  }

  return response.json() as Promise<AuroraStatus>;
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";
}

function formatTechnology(value: string | null) {
  return value === "tracking" ? "Tracking" : "Fixed";
}

function AuroraPriceCurveFields({
  status,
  investorCurveW = 1,
  debtSizingCentralW = 0.7,
  debtSizingLowW = 0.3,
  inflationAurora = DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationAurora,
}: {
  status: AuroraStatus;
  investorCurveW?: number | null;
  debtSizingCentralW?: number | null;
  debtSizingLowW?: number | null;
  inflationAurora?: number | null;
}) {
  const investorCurveDefault = (investorCurveW ?? 1) * 100;
  const debtSizingCentralDefault = (debtSizingCentralW ?? 0.7) * 100;
  const debtSizingLowDefault = (debtSizingLowW ?? 0.3) * 100;

  return (
    <section className="form-section">
      <p className="form-section-head">Courbes de prix post-contrat (Aurora)</p>
      {status.imported ? (
        <>
          <span className="badge badge-green" style={{ marginBottom: "1rem", display: "inline-flex" }}>
            Aurora importé · {formatTechnology(status.technology)} · {formatDate(status.updatedAt)}
          </span>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              Pondération Investor Curve - Central (%)
              <DefaultNumberInput
                name="investorCurveW"
                type="number"
                min="0"
                step="0.01"
                defaultValue={investorCurveDefault}
                title="100% = courbe Central Aurora pour le TRI investisseur"
                className="h-10 px-3"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              Pondération Debt Sizing - Central (%)
              <DefaultNumberInput
                name="debtSizingCentralW"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={debtSizingCentralDefault}
                className="h-10 px-3"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              Pondération Debt Sizing - Low (%)
              <DefaultNumberInput
                name="debtSizingLowW"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={debtSizingLowDefault}
                title="Central + Low doit etre egal a 100 %."
                className="h-10 px-3"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>Inflation Aurora post-contrat (%/an) <span className="badge-default">Defaut</span></span>
              <DefaultNumberInput
                name="inflationAurora"
                type="number"
                min="0"
                step="0.01"
                defaultValue={inflationAurora ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationAurora}
                placeholder="ex. 2"
                title="Inflation annuelle appliquee aux prix Aurora apres la periode contractuelle."
                className="h-10 px-3"
              />
            </label>
          </div>
        </>
      ) : (
        <span className="badge badge-yellow">
          Aucune courbe Aurora — importer depuis la liste des projets
        </span>
      )}
    </section>
  );
}

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
          capacityMw: true,
          investorCurveW: true,
          debtSizingCentralW: true,
          debtSizingLowW: true,
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
  const auroraStatus = await getAuroraStatus();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href={`/projects/${scenario.project.id}`} className="page-breadcrumb">
          ← {scenario.project.name}
        </Link>
        <h1 className="page-title" style={{ marginTop: "0.25rem" }}>Modifier le scénario</h1>
      </div>

      <form action={updateScenarioForProject} className="form-card grid gap-5">
        <span className="form-section-title">Identification</span>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Nom du scénario
          <input
            name="name"
            required
            defaultValue={scenario.name}
            placeholder="ex. Base case"
            title="Nom du scénario"
            className="h-10 px-3"
          />
        </label>
        <input type="hidden" name="debtRate" value={scenario.debtRate} />

        <CapexDetailFields
          capacityMw={scenario.project.capacityMw}
          initialValue={{
            capex: scenario.capex,
            surfaceHa: scenario.surfaceHa,
            prixModuleUSDWc: scenario.prixModuleUSDWc,
            tauxEURUSD: scenario.tauxEURUSD ?? 1.16,
            boSCtWc: scenario.boSCtWc,
            raccordementOuvrageKEuro: scenario.raccordementOuvrageKEuro,
            tarifQPKEuroPerMW: scenario.tarifQPKEuroPerMW,
            apportAffaireMode: scenario.apportAffaireMode,
            apportAffaireValeur: scenario.apportAffaireValeur,
            devFeesKEuroPerMW:
              scenario.devFeesKEuroPerMW ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.devFeesKEuroPerMW,
            contingencyRate:
              scenario.contingencyRate ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.contingencyRate,
            longueurModule:
              scenario.longueurModule ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.longueurModule,
            largeurModule:
              scenario.largeurModule ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.largeurModule,
            txAmenagementRate:
              scenario.txAmenagementRate ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.txAmenagementRate,
            coefArcheo:
              scenario.coefArcheo ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.coefArcheo,
          }}
        />

        <span className="form-section-title">Paramètres clés</span>

        <div className="grid gap-5 sm:grid-cols-2">
          {primaryFields.filter((field) => field.name !== "capex" && field.name !== "opex").map((field) => (
            <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
              {field.label}
              <input
                name={field.name}
                required
                type="number"
                step={field.step}
                defaultValue={scenario[field.name]}
                placeholder={field.placeholder}
                title={field.title}
                className="h-10 px-3"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Productible P50 (MWh/MW/an)
            <input
              name="yieldMwh"
              required
              type="number"
              step="0.01"
              defaultValue={scenario.yieldMwh}
              placeholder="ex. 1450"
              title="Production annuelle en MWh par MW installé — scénario médian P50 (solaire France : 1 300–1 600 MWh/MW/an)"
              className="h-10 px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Productible P90 (MWh/MW/an)
            <input
              name="yieldP90Mwh"
              type="number"
              step="0.01"
              defaultValue={scenario.yieldP90Mwh ?? ""}
              placeholder="Défaut : P50 × 0,93"
              title="Production annuelle au niveau de confiance P90 — solaire : environ P50 × 0,93. Utilisé pour le dimensionnement bancaire (DSCR)."
              className="h-10 px-3"
            />
          </label>
        </div>

        <section className="form-section">
          <p className="form-section-head">Revenus</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {revenueFields.map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
                <span>{field.label} <span className="badge-default">Défaut</span></span>
                <DefaultNumberInput
                  name={field.name}
                  type="number"
                  min="0"
                  step={field.step}
                  defaultValue={scenario[field.name] ?? field.defaultValue}
                  placeholder={field.placeholder}
                  title={field.title}
                  className="h-10 px-3"
                />
              </label>
            ))}
          </div>
        </section>

        <AuroraPriceCurveFields
          status={auroraStatus}
          investorCurveW={scenario.project.investorCurveW}
          debtSizingCentralW={scenario.project.debtSizingCentralW}
          debtSizingLowW={scenario.project.debtSizingLowW}
          inflationAurora={scenario.inflationAurora}
        />

        <section className="form-section">
          <p className="form-section-head">OPEX complémentaires</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {opexExtraFields.map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
                <span>{field.label} <span className="badge-default">Défaut</span></span>
                <DefaultNumberInput
                  name={field.name}
                  type="number"
                  min="0"
                  step={field.step}
                  defaultValue={scenario[field.name] ?? field.defaultValue}
                  placeholder={field.placeholder}
                  title={field.title}
                  className="h-10 px-3"
                />
              </label>
            ))}
          </div>
        </section>

        <OpexDetailFields
          capacityMw={scenario.project.capacityMw}
          initialValue={{
            opex: scenario.opex,
            surfaceHa: scenario.surfaceHa,
            yieldMwh: scenario.yieldMwh,
            tariff: scenario.tariff,
            tariffInflationRate: scenario.tariffInflationRate,
            contractDuration:
              scenario.contractDuration ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.contractDuration,
            assuranceRate:
              scenario.assuranceRate ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.assuranceRate,
            inflationAssurance:
              scenario.inflationAssurance ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationAssurance,
            balancingCost:
              scenario.balancingCost ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.balancingCost,
            omFixedEuroKwc:
              scenario.omFixedEuroKwc ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.omFixedEuroKwc,
            mraEuroKwc: scenario.mraEuroKwc ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.mraEuroKwc,
            backOfficeKeuro:
              scenario.backOfficeKeuro ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.backOfficeKeuro,
            diversOpexKeuro:
              scenario.diversOpexKeuro ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.diversOpexKeuro,
            loyerMode: scenario.loyerMode,
            loyerValeur: scenario.loyerValeur,
            loyerInflation:
              scenario.loyerInflation ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.loyerInflation,
            inflationOM:
              scenario.inflationOM ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationOM,
            inflationMRA:
              scenario.inflationMRA ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationMRA,
            inflationBackOffice:
              scenario.inflationBackOffice ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationBackOffice,
            inflationDivers:
              scenario.inflationDivers ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationDivers,
            methodeTaxes:
              scenario.methodeTaxes ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.methodeTaxes,
            tauxTFCommune: scenario.tauxTFCommune,
            tauxTFEPCI: scenario.tauxTFEPCI,
            tauxTSE: scenario.tauxTSE,
            tauxGEMAPI: scenario.tauxGEMAPI,
            tauxTEOM: scenario.tauxTEOM,
            tauxCFECommune: scenario.tauxCFECommune,
            tauxCFEEPCI: scenario.tauxCFEEPCI,
            tauxCCI: scenario.tauxCCI,
            prixTerrainHa:
              scenario.prixTerrainHa ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.prixTerrainHa,
            abattTerrain:
              scenario.abattTerrain ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.abattTerrain,
            inflationTaxes:
              scenario.inflationTaxes ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationTaxes,
            iferRate1: scenario.iferRate1 ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRate1,
            iferRate2: scenario.iferRate2 ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRate2,
            iferRpn: scenario.iferRpn ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRpn,
          }}
        />

        <span className="form-section-title">Hypothèses financières</span>

        <div className="grid gap-5 sm:grid-cols-2">
          {assumptionFields.map((field) => (
            <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
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
                className="h-10 px-3"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            Gearing maximum autorisé (%) <span className="badge-default">Défaut</span>
            <DefaultNumberInput
              name="gearingMaxPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={scenario.gearingMaxPct ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.gearingMax}
              placeholder="ex. 90"
              title="Plafond de dette en % du CAPEX effectif"
              className="h-10 px-3"
            />
          </label>
        </div>

        <FinancingFeesFields
          capacityMw={scenario.project.capacityMw}
          initialValue={{
            capexPerMwKeuro: scenario.capex,
            gearingMaxPct:
              scenario.gearingMaxPct ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.gearingMax,
            legalFeesKEuro:
              scenario.legalFeesKEuro ?? DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.legalFeesKEuro,
            technicalDDKEuro:
              scenario.technicalDDKEuro ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.technicalDDKEuro,
            arrangerFeesRate:
              scenario.arrangerFeesRate ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.arrangerFeesRate,
            participantFeesRate:
              scenario.participantFeesRate ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.participantFeesRate,
            bankFeesPLTKEuroPerMW:
              scenario.bankFeesPLTKEuroPerMW ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.bankFeesPLTKEuroPerMW,
            interimFinancingRate:
              scenario.interimFinancingRate ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.interimFinancingRate,
            commitmentFeesRate:
              scenario.commitmentFeesRate ??
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.commitmentFeesRate,
          }}
        />

        <section className="form-section">
          <p className="form-section-head">Fiscalité &amp; CCA</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {fiscalFields.map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
                <span>
                  {field.label}
                  {"defaultValue" in field ? <span className="badge-default">Défaut</span> : null}
                </span>
                {"defaultValue" in field ? (
                  <DefaultNumberInput
                    name={field.name}
                    type="number"
                    min="0"
                    step={field.step}
                    defaultValue={scenario[field.name] ?? field.defaultValue}
                    placeholder={field.placeholder}
                    title={field.title}
                    className="h-10 px-3"
                  />
                ) : (
                  <input
                    name={field.name}
                    type="number"
                    min="0"
                    step={field.step}
                    defaultValue={scenario[field.name] ?? ""}
                    placeholder={field.placeholder}
                    title={field.title}
                    className="h-10 px-3"
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <div className="grid gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--ps-blue-dark)" }}>
            Profil DSCR cible
          </p>
          <DscrSchedule
            initialValue={
              initialDscrSchedule ?? [...DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.dscrSchedule]
            }
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/projects/${scenario.project.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </main>
  );
}
