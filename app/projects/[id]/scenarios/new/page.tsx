import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { createScenario } from "@/app/actions";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { CapexDetailFields } from "@/app/components/CapexDetailFields";
import { DefaultNumberInput } from "@/app/components/DefaultNumberInput";
import { DscrSchedule } from "@/app/components/DscrSchedule";
import { FinancingFeesFields } from "@/app/components/FinancingFeesFields";
import { OpexDetailFields } from "@/app/components/OpexDetailFields";
import { OpexEngagementsFields } from "@/app/components/OpexEngagementsFields";
import {
  DEFAULT_FINANCIAL_ASSUMPTIONS,
  DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS,
} from "@/app/lib/finance/types";
import { prisma } from "@/app/lib/prisma";

const projectParamFields = [
  {
    name: "debtTenorYears" as const,
    label: "Durée dette sculptée / tenor (ans)",
    step: "1",
    placeholder: "ex. 18",
    title: "Nombre d'années de dette sculptée (DSCR). Vide → durée de la dette.",
  },
  {
    name: "ccaRemunRate" as const,
    label: "Taux rémunération CCA (%/an)",
    step: "0.01",
    placeholder: "ex. 2",
    title: "Taux de rémunération du compte courant d'associé (CCA).",
  },
  {
    name: "dsrfFeeRate" as const,
    label: "Taux DSRF (%)",
    step: "0.01",
    placeholder: "ex. 1.4",
    title: "Taux de dotation à la réserve de service de la dette (DSRF).",
  },
  {
    name: "agentFeeAnnuelKeuro" as const,
    label: "Agent fee annuel (k€)",
    step: "0.01",
    placeholder: "ex. 5",
    title: "Commission d'agent bancaire annuelle (k€), indexée inflation OPEX.",
  },
  {
    name: "indemnitesImmoKeuro" as const,
    label: "Indemnités immobilisées (k€)",
    step: "0.01",
    placeholder: "ex. 0",
    title: "Indemnités immobilisées ajoutées au CAPEX.",
  },
  {
    name: "capacityCertificateMw" as const,
    label: "Puissance certificat capacité (MW)",
    step: "0.01",
    placeholder: "ex. 5",
    title: "Puissance ouvrant droit au revenu de capacité.",
  },
  {
    name: "goStartYear" as const,
    label: "Année début GO",
    step: "1",
    placeholder: "ex. 21",
    title: "Première année de revenu Garanties d'Origine.",
  },
  {
    name: "unavailability" as const,
    label: "Indisponibilité (fraction)",
    step: "0.001",
    placeholder: "ex. 0.01",
    title: "Fraction d'indisponibilité (0,01 = 1 %). Production = yield × (1 − indispo).",
  },
  {
    name: "aleasOpexRate" as const,
    label: "Aléas OPEX (% du CA)",
    step: "0.01",
    placeholder: "ex. 0.5",
    title: "Provision aléas OPEX en % du chiffre d'affaires.",
  },
] as const;

const templateParamFields = [
  {
    name: "coefDegressif" as const,
    label: "Coef. amortissement dégressif",
    step: "0.01",
    placeholder: "ex. 2.25",
    title: "Coefficient d'amortissement dégressif Type 1 (barème fiscal FR).",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.coefDegressif,
  },
  {
    name: "goPriceBase" as const,
    label: "Prix GO base (€/MWh)",
    step: "0.01",
    placeholder: "ex. 1",
    title: "Prix de base des Garanties d'Origine, indexé Aurora.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.goPriceBase,
  },
  {
    name: "taxeFinaleSizingKeuro" as const,
    label: "Taxe finale sizing (k€)",
    step: "0.01",
    placeholder: "ex. 0",
    title: "IS soustrait du CFADS de sizing à la dernière année du tenor.",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.taxeFinaleSizingKeuro,
  },
  {
    name: "fonciereBienEuroWc" as const,
    label: "Foncière bien (€/Wc)",
    step: "0.001",
    placeholder: "ex. 0.017",
    title: "Base foncière des biens en €/Wc (BOS divers + terrassement).",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.fonciereBienEuroWc,
  },
  {
    name: "batimentsFonciersKeuro" as const,
    label: "Bâtiments fonciers (k€)",
    step: "0.01",
    placeholder: "ex. 0",
    title: "Bâtiments soumis à la taxe foncière (k€).",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.batimentsFonciersKeuro,
  },
] as const;

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
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.projectLifeYears,
  },
  {
    name: "degradationRate" as const,
    label: "Dégradation (%/an)",
    step: "0.01",
    placeholder: "ex. 0.3",
    title: "Perte de production annuelle des panneaux en % (PV : 0,3–0,5 %/an)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.degradationRate,
  },
  {
    name: "discountRate" as const,
    label: "Taux actualisation (%)",
    step: "0.01",
    placeholder: "ex. 6",
    title: "WACC ou coût des fonds propres en % (ex. 6–8 %)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.discountRate,
  },
  {
    name: "debtInterestRate" as const,
    label: "Taux d'intérêt dette (%)",
    step: "0.01",
    placeholder: "ex. 4",
    title: "Taux d'intérêt annuel de la dette senior (financement de projet : 4–5 %)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.debtInterestRate,
  },
  {
    name: "debtMaturityYears" as const,
    label: "Durée de la dette (ans)",
    step: "1",
    placeholder: "ex. 18",
    title: "Durée d'amortissement de la dette pour le service annualisé (ex. 15–20 ans)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.debtMaturityYears,
  },
  {
    name: "tariffInflationRate" as const,
    label: "Inflation tarif (%/an)",
    step: "0.01",
    placeholder: "ex. 0",
    title: "Revalorisation annuelle du tarif en % (souvent 0 pour les tarifs réglementés)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.tariffInflationRate,
  },
  {
    name: "opexInflationRate" as const,
    label: "Inflation OPEX (%/an)",
    step: "0.01",
    placeholder: "ex. 2",
    title: "Revalorisation annuelle des charges en % (ex. 2 % = inflation générale)",
    defaultValue: DEFAULT_FINANCIAL_ASSUMPTIONS.opexInflationRate,
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
  {
    name: "constructionYears" as const,
    label: "Durée construction (ans)",
    step: "1",
    placeholder: "ex. 1",
    title: "Nombre d'années entre le financement et la mise en service (COD)",
    defaultValue: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.constructionYears,
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

export default async function NewScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      capacityMw: true,
      investorCurveW: true,
      debtSizingCentralW: true,
      debtSizingLowW: true,
    },
  });

  if (!project) {
    notFound();
  }

  const createScenarioForProject = createScenario.bind(null, project.id);
  const auroraStatus = await getAuroraStatus();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Projets", href: "/projects" },
            { label: project.name, href: `/projects/${project.id}` },
            { label: "Nouveau scénario" },
          ]}
        />
        <h1 className="page-title" style={{ marginTop: "0.25rem" }}>Nouveau scénario</h1>
      </div>

      <form action={createScenarioForProject} className="form-card grid gap-5">
        <span className="form-section-title">Identification</span>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Nom du scénario
          <input
            name="name"
            required
            placeholder="ex. Base case"
            title="Nom du scénario"
            className="h-10 px-3"
          />
        </label>
        <input type="hidden" name="debtRate" value="0" />

        <CapexDetailFields
          capacityMw={project.capacityMw}
          initialValue={{
            capex: 0,
            tauxEURUSD: 1.16,
            devFeesKEuroPerMW: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.devFeesKEuroPerMW,
            contingencyRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.contingencyRate,
            longueurModule: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.longueurModule,
            largeurModule: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.largeurModule,
            txAmenagementRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.txAmenagementRate,
            coefArcheo: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.coefArcheo,
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
                  defaultValue={field.defaultValue}
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
          investorCurveW={project.investorCurveW}
          debtSizingCentralW={project.debtSizingCentralW}
          debtSizingLowW={project.debtSizingLowW}
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
                  defaultValue={field.defaultValue}
                  placeholder={field.placeholder}
                  title={field.title}
                  className="h-10 px-3"
                />
              </label>
            ))}
          </div>
        </section>

        <OpexDetailFields
          capacityMw={project.capacityMw}
          initialValue={{
            opex: 0,
            surfaceHa: 0,
            yieldMwh: 0,
            tariff: 0,
            tariffInflationRate: DEFAULT_FINANCIAL_ASSUMPTIONS.tariffInflationRate,
            contractDuration: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.contractDuration,
            assuranceRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.assuranceRate,
            inflationAssurance: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationAssurance,
            balancingCost: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.balancingCost,
            omFixedEuroKwc: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.omFixedEuroKwc,
            mraEuroKwc: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.mraEuroKwc,
            backOfficeKeuro: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.backOfficeKeuro,
            diversOpexKeuro: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.diversOpexKeuro,
            loyerInflation: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.loyerInflation,
            inflationOM: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationOM,
            inflationMRA: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationMRA,
            inflationBackOffice: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationBackOffice,
            inflationDivers: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationDivers,
            methodeTaxes: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.methodeTaxes,
            // Méthode TF/CFE Phase 3 : projet NEUF → sélecteur AUTO actif d'emblée
            // (prix d'achat terrain 0 → appréciation directe template ; > 0 → comptable).
            prixAchatTerrainEuro: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.prixAchatTerrainEuro,
            prixTerrainHa: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.prixTerrainHa,
            abattTerrain: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.abattTerrain,
            inflationTaxes: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.inflationTaxes,
            iferRate1: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRate1,
            iferRate2: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRate2,
            iferRpn: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.iferRpn,
          }}
        />

        <span className="form-section-title">Hypothèses financières</span>

        <div className="grid gap-5 sm:grid-cols-2">
          {assumptionFields.map((field) => (
            <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{field.label} <span className="badge-default">Défaut</span></span>
              <DefaultNumberInput
                name={field.name}
                required
                type="number"
                min="0"
                step={field.step}
                placeholder={field.placeholder}
                title={field.title}
                defaultValue={field.defaultValue}
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
              placeholder="ex. 90"
              title="Plafond de dette en % du CAPEX effectif"
              defaultValue={DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.gearingMax}
              className="h-10 px-3"
            />
          </label>
        </div>

        <FinancingFeesFields
          capacityMw={project.capacityMw}
          initialValue={{
            capexPerMwKeuro: 0,
            gearingMaxPct: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.gearingMax,
            legalFeesKEuro: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.legalFeesKEuro,
            technicalDDKEuro: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.technicalDDKEuro,
            arrangerFeesRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.arrangerFeesRate,
            participantFeesRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.participantFeesRate,
            bankFeesPLTKEuroPerMW:
              DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.bankFeesPLTKEuroPerMW,
            interimFinancingRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.interimFinancingRate,
            commitmentFeesRate: DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.commitmentFeesRate,
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
                    placeholder={field.placeholder}
                    title={field.title}
                    defaultValue={field.defaultValue}
                    className="h-10 px-3"
                  />
                ) : (
                  <input
                    name={field.name}
                    type="number"
                    min="0"
                    step={field.step}
                    placeholder={field.placeholder}
                    title={field.title}
                    className="h-10 px-3"
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <span className="form-section-title">Paramètres projet</span>
        <p className="text-xs text-zinc-500" style={{ marginTop: "-0.75rem" }}>
          Variables propres au projet — à saisir. Laisser vide conserve le comportement par défaut.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {projectParamFields.map((field) => (
            <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
              {field.label}
              <input
                name={field.name}
                type="number"
                min="0"
                step={field.step}
                placeholder={field.placeholder}
                title={field.title}
                className="h-10 px-3"
              />
            </label>
          ))}
        </div>

        <section className="form-section">
          <p className="form-section-head">Engagements OPEX an-par-an (k€)</p>
          <OpexEngagementsFields years={DEFAULT_FINANCIAL_ASSUMPTIONS.projectLifeYears} />
          <div className="grid gap-5 sm:grid-cols-2" style={{ marginTop: "0.75rem" }}>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              Engagements année 1 (k€) — méthode indexée 2 %/an
              <input
                name="engagementsKeuroAn1"
                type="number"
                min="0"
                step="0.01"
                placeholder="optionnel"
                title="Méthode pour projet neuf : engagements(y) = an1 × 1,02^(y-1). Utilisée UNIQUEMENT si la grille an-par-an ci-dessus est vide (la grille garde la priorité). Vide → aucun engagement. Ordre de grandeur des BP existants : an1 ≈ 370 à 9 590 €/MWc (médiane ≈ 2 630) — trop variable pour un défaut imposé."
                className="h-10 px-3"
              />
            </label>
          </div>
          <p className="text-xs text-zinc-400" style={{ marginTop: "0.25rem" }}>
            Alternative à la grille pour un projet neuf : montant an1 indexé 2 %/an. Ignoré si la
            grille an-par-an est renseignée. Pas de défaut : les BP existants vont de ≈ 370 à
            ≈ 9 590 €/MWc en an1 (médiane ≈ 2 630 €/MWc).
          </p>
        </section>

        <div className="grid gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--ps-blue-dark)" }}>
            Profil DSCR cible
          </p>
          <DscrSchedule initialValue={[...DEFAULT_SCENARIO_EXTRA_ASSUMPTIONS.dscrSchedule]} />
        </div>

        <details className="form-section">
          <summary className="form-section-head" style={{ cursor: "pointer" }}>
            Paramètres template (pré-remplis, modulables)
          </summary>
          <p className="text-xs text-zinc-500" style={{ margin: "0.5rem 0 1rem" }}>
            Constantes du template BP — pré-remplies avec leur valeur par défaut, modifiables si besoin.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {templateParamFields.map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium text-zinc-700">
                <span>{field.label} <span className="badge-default">Défaut</span></span>
                <DefaultNumberInput
                  name={field.name}
                  type="number"
                  min="0"
                  step={field.step}
                  defaultValue={field.defaultValue}
                  placeholder={field.placeholder}
                  title={field.title}
                  className="h-10 px-3"
                />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>Marge facturable figée (k€)</span>
              <input
                name="margeFactFigeeKeuro"
                type="number"
                step="0.01"
                placeholder="vide = calcul endogène"
                title="Marge facturable imposée par le BP (k€). Vide → boucle endogène (comportement par défaut)."
                className="h-10 px-3"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>Marge facturable amortie (k€)</span>
              <input
                name="margeFactAmortissableKeuro"
                type="number"
                step="0.01"
                placeholder="vide = non amortie"
                title="Part du MOD (marge facturable) amortie en Type 2 par le BP (C_D&A). N'affecte que la base D&A — pas le CAPEX ni le sizing. Vide → base inchangée."
                className="h-10 px-3"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>Index courbe an1 (override)</span>
              <input
                name="curveIndexAn1"
                type="number"
                step="0.00001"
                placeholder="calculé par défaut"
                title="Index d'inflation des courbes à l'an1. Vide → calculé depuis l'année de mise en service."
                className="h-10 px-3"
              />
            </label>
          </div>
        </details>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/projects/${project.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer le scénario
          </button>
        </div>
      </form>
    </main>
  );
}
