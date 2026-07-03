import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  cloneScenario,
  importScenarios,
  setReferenceScenario,
} from "@/app/actions";
import { DeleteScenarioButton } from "@/app/projects/[id]/delete-scenario-button";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateOpexDetails,
  calculateScenarioMetrics,
} from "@/app/lib/finance/engine";
import { AnimatedKpiCards } from "@/app/components/AnimatedKpiCards";
import { ProjectFinancialCharts } from "@/app/components/ProjectFinancialCharts";
import { CAPACITY_PRICE_CURVE, merchantCurveForTechnology } from "@/app/lib/finance/merchantCurves";
import type { DscrTranche } from "@/app/lib/finance/types";
import { generateSensitivityRows } from "@/app/lib/sensitivity";
import { prisma } from "@/app/lib/prisma";

function maxValue(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function minValue(values: number[]) {
  return values.length > 0 ? Math.min(...values) : null;
}

function formatNumber(value: number | null, suffix = "") {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function formatYear(value: number) {
  return value > 0 ? String(value) : "-";
}

function formatMillionEuros(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${(value / 1_000).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} M€`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${(value * 100).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} %`;
}

function parseDscrSchedule(json: string | null): DscrTranche[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as DscrTranche[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function getStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "rtb") return "badge badge-green";
  if (s === "in review" || s === "permitted") return "badge badge-blue";
  return "badge badge-yellow";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenarioId?: string | string[] | undefined }>;
}) {
  await connection();

  const { id } = await params;
  const { scenarioId } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scenarios: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const scenarios = project.scenarios;
  // Courbe merchant résolue PAR TECHNO (Fixed → FIXED_CURVE_2026Q2, Tracker → TRACKER_CURVE_2026Q2),
  // exactement comme l'import (source de vérité versionnée). Remplace l'ancienne lecture de la table
  // AuroraCurve globale (year @unique → une seule techno) → détail == liste à l'euro, Fixed ET Tracker.
  const merchantCurves = merchantCurveForTechnology(project.technology);
  const buildFinanceInput = (scenario: (typeof scenarios)[number]) => ({
    capacityMw: project.capacityMw,
    commissioningYear: project.commissioningYear,
    auroraCurves: merchantCurves,
    debtSizingCentralW: project.debtSizingCentralW,
    debtSizingLowW: project.debtSizingLowW,
    investorCurveW: project.investorCurveW,
    capex: scenario.capex,
    surfaceHa: scenario.surfaceHa,
    prixModuleUSDWc: scenario.prixModuleUSDWc,
    tauxEURUSD: scenario.tauxEURUSD,
    boSCtWc: scenario.boSCtWc,
    raccordementOuvrageKEuro: scenario.raccordementOuvrageKEuro,
    tarifQPKEuroPerMW: scenario.tarifQPKEuroPerMW,
    apportAffaireMode: scenario.apportAffaireMode,
    apportAffaireValeur: scenario.apportAffaireValeur,
    opex: scenario.opex,
    omFixedEuroKwc: scenario.omFixedEuroKwc,
    mraEuroKwc: scenario.mraEuroKwc,
    backOfficeKeuro: scenario.backOfficeKeuro,
    diversOpexKeuro: scenario.diversOpexKeuro,
    loyerMode: scenario.loyerMode,
    loyerValeur: scenario.loyerValeur,
    loyerInflation: scenario.loyerInflation,
    inflationOM: scenario.inflationOM,
    inflationMRA: scenario.inflationMRA,
    inflationBackOffice: scenario.inflationBackOffice,
    inflationDivers: scenario.inflationDivers,
    methodeTaxes: scenario.methodeTaxes,
    tauxTFCommune: scenario.tauxTFCommune,
    tauxTFEPCI: scenario.tauxTFEPCI,
    tauxTSE: scenario.tauxTSE,
    tauxGEMAPI: scenario.tauxGEMAPI,
    tauxTEOM: scenario.tauxTEOM,
    tauxCFECommune: scenario.tauxCFECommune,
    tauxCFEEPCI: scenario.tauxCFEEPCI,
    tauxCCI: scenario.tauxCCI,
    prixTerrainHa: scenario.prixTerrainHa,
    abattTerrain: scenario.abattTerrain,
    inflationTaxes: scenario.inflationTaxes,
    iferRate1: scenario.iferRate1,
    iferRate2: scenario.iferRate2,
    iferRpn: scenario.iferRpn,
    inflationAurora: scenario.inflationAurora,
    yieldMwh: scenario.yieldMwh,
    yieldP90Mwh: scenario.yieldP90Mwh,
    tariff: scenario.tariff,
    debtRate: scenario.debtRate,
    projectLifeYears: scenario.projectLifeYears,
    degradationRate: scenario.degradationRate,
    discountRate: scenario.discountRate,
    debtInterestRate: scenario.debtInterestRate,
    debtMaturityYears: scenario.debtMaturityYears,
    tariffInflationRate: scenario.tariffInflationRate,
    opexInflationRate: scenario.opexInflationRate,
    contractDuration: scenario.contractDuration,
    constructionYears: scenario.constructionYears,
    assuranceRate: scenario.assuranceRate,
    inflationAssurance: scenario.inflationAssurance,
    balancingCost: scenario.balancingCost,
    dscrTarget: scenario.dscrTarget,
    debtTenorYears: scenario.debtTenorYears,
    dscrSchedule: parseDscrSchedule(scenario.dscrSchedule),
    gearingMaxPct: scenario.gearingMaxPct,
    tauxIS: scenario.tauxIS,
    amortDuree: scenario.amortDuree,
    dsraMonths: scenario.dsraMonths,
    devFeesKEuroPerMW: scenario.devFeesKEuroPerMW,
    tauxISEntreprise: scenario.tauxISEntreprise,
    contingencyRate: scenario.contingencyRate,
    longueurModule: scenario.longueurModule,
    largeurModule: scenario.largeurModule,
    txAmenagementRate: scenario.txAmenagementRate,
    coefArcheo: scenario.coefArcheo,
    legalFeesKEuro: scenario.legalFeesKEuro,
    technicalDDKEuro: scenario.technicalDDKEuro,
    arrangerFeesRate: scenario.arrangerFeesRate,
    participantFeesRate: scenario.participantFeesRate,
    bankFeesPLTKEuroPerMW: scenario.bankFeesPLTKEuroPerMW,
    interimFinancingRate: scenario.interimFinancingRate,
    commitmentFeesRate: scenario.commitmentFeesRate,
    // Inputs moteur désormais persistés (migration scenario_full_engine_inputs) — fallback ?? null
    // => scénario legacy (colonnes null) recompute à l'identique via les défauts du moteur.
    ccaRemunRate: scenario.ccaRemunRate,
    unavailability: scenario.unavailability,
    indemnitesImmoKeuro: scenario.indemnitesImmoKeuro,
    aleasOpexRate: scenario.aleasOpexRate,
    tauxTSECfe: scenario.tauxTSECfe,
    tauxGEMAPICfe: scenario.tauxGEMAPICfe,
    coefDegressif: scenario.coefDegressif,
    taxeFinaleSizingKeuro: scenario.taxeFinaleSizingKeuro,
    agentFeeAnnuelKeuro: scenario.agentFeeAnnuelKeuro,
    dsrfFeeRate: scenario.dsrfFeeRate,
    capacityCertificateMw: scenario.capacityCertificateMw ?? undefined,
    goStartYear: scenario.goStartYear ?? undefined,
    goPriceBase: scenario.goPriceBase ?? undefined,
    curveIndexAn1: scenario.curveIndexAn1,
    fonciereBienEuroWc: scenario.fonciereBienEuroWc,
    batimentsFonciersKeuro: scenario.batimentsFonciersKeuro,
    modRetraitementKeuro: scenario.modRetraitementKeuro,
    valeurTerrainKeuro: scenario.valeurTerrainKeuro,
    // Donnée de marché partagée (comme auroraCurves), pas une colonne : sans effet si
    // capacityCertificateMw est null (revenu capacité = 0), donc rétrocompatible pour le legacy.
    capacityPriceCurve: CAPACITY_PRICE_CURVE,
  });
  const projectReferenceScenario = scenarios.find((scenario) => scenario.isReference);
  const selectedScenarioId =
    typeof scenarioId === "string"
      ? scenarioId
      : (projectReferenceScenario?.id ?? scenarios[0]?.id);
  const analysisScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    projectReferenceScenario ??
    scenarios[0];
  const tariffSensitivityRows = analysisScenario
    ? generateSensitivityRows(analysisScenario, "tariff")
    : [];
  const capexSensitivityRows = analysisScenario
    ? generateSensitivityRows(analysisScenario, "capex")
    : [];
  const referenceMetrics = projectReferenceScenario
    ? calculateScenarioMetrics(buildFinanceInput(projectReferenceScenario))
    : null;
  const analysisMetrics = analysisScenario
    ? calculateScenarioMetrics(buildFinanceInput(analysisScenario))
    : null;
  const kpiNpv =
    referenceMetrics?.npv ?? maxValue(scenarios.map((scenario) => scenario.npv));
  const kpiIrr =
    referenceMetrics?.irr ?? maxValue(scenarios.map((scenario) => scenario.irr));
  const kpiDscr = projectReferenceScenario
    ? (referenceMetrics?.dscr ?? null)
    : minValue(scenarios.map((scenario) => scenario.dscr).filter((dscr) => dscr > 0));
  const kpiLcoe =
    referenceMetrics?.lcoe ?? minValue(scenarios.map((scenario) => scenario.lcoe));
  const importScenariosForProject = importScenarios.bind(null, project.id);
  const cashFlowScenario = projectReferenceScenario ?? analysisScenario;
  const annualCashFlows = cashFlowScenario
    ? calculateAnnualCashFlows(buildFinanceInput(cashFlowScenario))
    : [];
  const cashFlowMetrics = cashFlowScenario
    ? calculateScenarioMetrics(buildFinanceInput(cashFlowScenario))
    : null;
  const cashFlowCapexDetails = cashFlowScenario
    ? calculateCapexDetails(buildFinanceInput(cashFlowScenario))
    : null;
  const firstOperatingCashFlow = annualCashFlows.find((row) => row.year === 1);
  const cashFlowOpexDetails =
    cashFlowScenario && firstOperatingCashFlow
      ? calculateOpexDetails(
          buildFinanceInput(cashFlowScenario),
          1,
          firstOperatingCashFlow.revenueP50Keuro,
          firstOperatingCashFlow.productionP50Mwh,
        )
      : null;
  const sizing = cashFlowMetrics?.sizing ?? null;
  const capexInitialKeuro = cashFlowScenario
    ? (cashFlowCapexDetails?.capexTotalKeuro ?? cashFlowScenario.capex * project.capacityMw)
    : 0;
  const capexBeforeContingencyKeuro =
    cashFlowCapexDetails?.capexBeforeContingencyKeuro ?? capexInitialKeuro;
  const contingencyKeuro = cashFlowMetrics?.contingencyKeuro ?? 0;
  const taxesFoncieresKeuro = cashFlowCapexDetails?.taxesFoncieresKeuro ?? 0;
  const financingFeesKeuro = cashFlowMetrics?.financingFeesKeuro ?? 0;
  const estimatedPltKeuro = cashFlowMetrics?.estimatedPltKeuro ?? 0;
  const financingFeesDetail = cashFlowMetrics?.financingFeesDetail ?? null;
  const capexTotalWithFinancingFeesKeuro = capexInitialKeuro + financingFeesKeuro;
  const capexEffectifKeuro = sizing !== null
    ? capexTotalWithFinancingFeesKeuro + sizing.margeFactKeuro
    : null;
  const ccaKeuro =
    sizing !== null && capexEffectifKeuro !== null
      ? Math.max(0, capexEffectifKeuro - sizing.debtRetenuKeuro)
      : null;
  const gearingRealisePct =
    sizing !== null
      ? sizing.gearingActuel * 100
      : null;
  const analysisDevFeesKeuro =
    analysisScenario !== undefined
      ? (analysisScenario.devFeesKEuroPerMW ?? 0) * project.capacityMw
      : null;
  const analysisNpvNetKeuro =
    analysisScenario !== undefined && analysisDevFeesKeuro !== null
      ? (analysisMetrics?.npv ?? analysisScenario.npv) - analysisDevFeesKeuro
      : null;
  const financingChartData =
    sizing !== null && ccaKeuro !== null
      ? [
          { name: "Dette" as const, value: sizing.debtRetenuKeuro, color: "#2563eb" },
          { name: "CCA" as const, value: ccaKeuro, color: "#16a34a" },
        ]
      : [];
  const cashFlowChartData = annualCashFlows.filter((row) => row.year >= 1).map((row) => {
    const areaBaseKeuro = Math.min(row.revenueP50Keuro, row.revenueP90Keuro);

    return {
      year: row.year,
      revenueP50Keuro: row.revenueP50Keuro,
      revenueP90Keuro: row.revenueP90Keuro,
      opexTotalKeuro: row.opexKeuro,
      areaBaseKeuro,
      areaSpreadKeuro:
        Math.max(row.revenueP50Keuro, row.revenueP90Keuro) - areaBaseKeuro,
    };
  });
  const capexChartData =
    cashFlowCapexDetails !== null
      ? [
          {
            name: "CAPEX",
            modulesKeuro: cashFlowCapexDetails.modulesKeuro,
            boSKeuro: cashFlowCapexDetails.boSKeuro,
            raccordementKeuro: cashFlowCapexDetails.raccordementKeuro,
            apportAffaireKeuro: cashFlowCapexDetails.apportAffaireKeuro,
            devFeesKeuro: cashFlowCapexDetails.devFeesKeuro,
            contingencyKeuro,
            taxesFoncieresKeuro,
            financingFeesKeuro,
          },
        ]
      : [];
  const dscrChartData = annualCashFlows
    .filter((row) => {
      const debtService = row.debtServiceSculptedKeuro ?? row.debtServiceKeuro;
      return debtService > 0 && row.dscrRealized !== null && row.dscrTargetAtYear !== null;
    })
    .map((row) => {
      const dscrRealized = row.dscrRealized ?? 0;
      const dscrTarget = row.dscrTargetAtYear ?? 0;

      return {
        year: row.year,
        dscrRealized,
        dscrTarget,
        dscrGreenBase: Math.min(dscrRealized, dscrTarget),
        dscrGreenDelta: dscrRealized > dscrTarget ? dscrRealized - dscrTarget : 0,
        dscrRedBase: Math.min(dscrRealized, dscrTarget),
        dscrRedDelta: dscrRealized < dscrTarget ? dscrTarget - dscrRealized : 0,
      };
    });
  const debtRepaymentChartData = annualCashFlows
    .filter((row) => {
      const debtService = row.debtServiceSculptedKeuro ?? row.debtServiceKeuro;
      return debtService > 0 || row.debtOutstandingKeuro > 0 || row.dsraSoldeKeuro > 0;
    })
    .map((row) => ({
      year: row.year,
      debtOutstandingKeuro: row.debtOutstandingKeuro,
      dsraBalanceKeuro: row.dsraSoldeKeuro,
      debtServiceKeuro: row.debtServiceSculptedKeuro ?? row.debtServiceKeuro,
    }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      {/* ── Hero ── */}
      <div className="project-hero">
        <div className="project-hero-particles" aria-hidden="true" />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <Link href="/projects" className="page-breadcrumb" style={{ color: "rgba(255,255,255,0.55)" }}>
              ← Projets
            </Link>
            <h1 className="project-hero-title">{project.name}</h1>
            <div className="project-hero-badges">
              {projectReferenceScenario ? (
                <span className="badge badge-base-case">Base Case</span>
              ) : null}
              <span className={getStatusBadgeClass(project.status)}>{project.status}</span>
              <span className="badge badge-ghost">{project.technology}</span>
              {project.region ? <span className="badge badge-ghost">{project.region}</span> : null}
              <span className="badge badge-ghost">{project.capacityMw} MW</span>
              {project.ao ? <span className="badge badge-ghost">{project.ao}</span> : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <form action={importScenariosForProject} className="flex gap-2">
              <input
                name="csv"
                type="file"
                accept=".csv,text/csv"
                required
                style={{ height: "2.5rem", maxWidth: "11rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", padding: "0 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.85)" }}
              />
              <button
                type="submit"
                className="btn-secondary"
                style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)", color: "white" }}
              >
                Import CSV
              </button>
            </form>
            <Link
              href="/api/scenarios/template"
              className="btn-secondary"
              style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)", color: "white" }}
            >
              Template
            </Link>
            <Link
              href={`/api/projects/${project.id}/scenarios/export`}
              className="btn-secondary"
              style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)", color: "white" }}
            >
              Export CSV
            </Link>
            <Link
              href={`/projects/${project.id}/scenarios/new`}
              className="btn-primary"
              style={{ background: "white", color: "var(--ps-blue-dark)" }}
            >
              + Scénario
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI Cards (float over hero bottom) ── */}
      <AnimatedKpiCards
        cards={[
          {
            label: projectReferenceScenario ? "VAN rÃ©fÃ©rence" : "Meilleure VAN",
            value: kpiNpv,
            suffix: " Mâ‚¬",
            scale: 1000,
            decimals: 2,
            tone: kpiNpv !== null && kpiNpv < 0 ? "negative" : "positive",
          },
          {
            label: projectReferenceScenario ? "TRI rÃ©fÃ©rence" : "Meilleur TRI",
            value: kpiIrr,
            suffix: " %",
            decimals: 2,
            tone: "positive",
          },
          {
            label: projectReferenceScenario ? "DSCR rÃ©fÃ©rence" : "DSCR minimum",
            value: kpiDscr,
            decimals: 2,
          },
          {
            label: projectReferenceScenario ? "LCOE rÃ©fÃ©rence" : "LCOE minimum",
            value: kpiLcoe,
            suffix: " â‚¬/MWh",
            decimals: 2,
          },
        ]}
      />
      <div
        className="hidden"
        style={{ marginTop: "-3rem", position: "relative", zIndex: 10 }}
      >
        <div className="kpi-card fade-up delay-1">
          <span className="kpi-label">
            {projectReferenceScenario ? "VAN référence" : "Meilleure VAN"}
          </span>
          <span className="kpi-value">{formatMillionEuros(kpiNpv)}</span>
        </div>
        <div className="kpi-card fade-up delay-2">
          <span className="kpi-label">
            {projectReferenceScenario ? "TRI référence" : "Meilleur TRI"}
          </span>
          <span className="kpi-value">{formatNumber(kpiIrr, " %")}</span>
        </div>
        <div className="kpi-card fade-up delay-3">
          <span className="kpi-label">
            {projectReferenceScenario ? "DSCR référence" : "DSCR minimum"}
          </span>
          <span className="kpi-value">{formatNumber(kpiDscr)}</span>
        </div>
        <div className="kpi-card fade-up delay-4">
          <span className="kpi-label">
            {projectReferenceScenario ? "LCOE référence" : "LCOE minimum"}
          </span>
          <span className="kpi-value">{formatNumber(kpiLcoe, " €/MWh")}</span>
        </div>
      </div>

      {/* ── Project metadata ── */}
      <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="meta-label">Technologie</p>
          <p className="meta-value">{project.technology}</p>
        </div>
        <div>
          <p className="meta-label">Pays</p>
          <p className="meta-value">{project.country}</p>
        </div>
        <div>
          <p className="meta-label">Capacité</p>
          <p className="meta-value">{project.capacityMw} MW</p>
        </div>
        <div>
          <p className="meta-label">Statut</p>
          <p className="meta-value">{project.status}</p>
        </div>
        <div>
          <p className="meta-label">AO</p>
          <p className="meta-value">{project.ao}</p>
        </div>
        <div>
          <p className="meta-label">Priorité</p>
          <p className="meta-value">{project.priority}</p>
        </div>
        <div>
          <p className="meta-label">Cas</p>
          <p className="meta-value">{project.caseType}</p>
        </div>
        <div>
          <p className="meta-label">Région</p>
          <p className="meta-value">{project.region}</p>
        </div>
        <div>
          <p className="meta-label">Tarif projet</p>
          <p className="meta-value">{formatNumber(project.tariff, " €/MWh")}</p>
        </div>
        <div>
          <p className="meta-label">Mise en service</p>
          <p className="meta-value">{formatYear(project.commissioningYear)}</p>
        </div>
        {cashFlowScenario ? (
          <div>
            <p className="meta-label">Productible P50</p>
            <p className="meta-value">{formatNumber(cashFlowScenario.yieldMwh, " MWh/MW/an")}</p>
          </div>
        ) : null}
        {cashFlowScenario ? (
          <div>
            <p className="meta-label">Productible P90</p>
            <p className="meta-value">
              {cashFlowScenario.yieldP90Mwh !== null
                ? formatNumber(cashFlowScenario.yieldP90Mwh, " MWh/MW/an")
                : formatNumber(cashFlowScenario.yieldMwh * 0.93, " MWh/MW/an (défaut)")}
            </p>
          </div>
        ) : null}
        {sizing !== null ? (
          <div>
            <p className="meta-label">Dette retenue</p>
            <p className="meta-value">{formatMillionEuros(sizing.debtRetenuKeuro)}</p>
          </div>
        ) : null}
        {cashFlowCapexDetails !== null ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="meta-label">Détail CAPEX</p>
            <div className="mt-2 grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3" style={{ border: "1px solid #e5e7eb" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Modules</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(cashFlowCapexDetails.modulesKeuro, " kEUR")}{" "}
                  <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                    {formatNumber(cashFlowCapexDetails.modulesCtWc, " ct/Wc")}
                  </span>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>BoS</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(cashFlowCapexDetails.boSKeuro, " kEUR")}{" "}
                  <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                    {formatNumber(cashFlowCapexDetails.boSCtWc, " ct/Wc")}
                  </span>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Raccordement</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(cashFlowCapexDetails.raccordementKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Apport d&apos;affaire</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(cashFlowCapexDetails.apportAffaireKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Dev fees</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(cashFlowCapexDetails.devFeesKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Sous-total</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(capexBeforeContingencyKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Contingency</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(contingencyKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Taxes foncières</span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(taxesFoncieresKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>CAPEX total</span>
                <p style={{ fontWeight: 700, color: "#0d1117" }}>
                  {formatNumber(capexInitialKeuro, " kEUR")}
                </p>
              </div>
              <div
                title={
                  financingFeesDetail !== null
                    ? [
                        `PLT estimé: ${formatNumber(estimatedPltKeuro, " kEUR")}`,
                        `Legal fees: ${formatNumber(financingFeesDetail.legalFees, " kEUR")}`,
                        `Technical DD: ${formatNumber(financingFeesDetail.technicalDD, " kEUR")}`,
                        `Arranger fees: ${formatNumber(financingFeesDetail.arrangerFees, " kEUR")}`,
                        `Participant fees: ${formatNumber(financingFeesDetail.participantFees, " kEUR")}`,
                        `Bank fees PLT: ${formatNumber(financingFeesDetail.bankFeesPLT, " kEUR")}`,
                        `Interim financing: ${formatNumber(financingFeesDetail.interimFinancing, " kEUR")}`,
                        `Commitment fees: ${formatNumber(financingFeesDetail.commitmentFees, " kEUR")}`,
                      ].join("\n")
                    : undefined
                }
              >
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Frais de financement
                </span>
                <p style={{ fontWeight: 600, color: "#0d1117" }}>
                  {formatNumber(financingFeesKeuro, " kEUR")}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>CAPEX effectif</span>
                <p style={{ fontWeight: 700, color: "var(--ps-blue-dark)" }}>
                  {formatNumber(capexEffectifKeuro ?? capexTotalWithFinancingFeesKeuro, " kEUR")}{" "}
                  <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                    {formatNumber(
                      project.capacityMw > 0
                        ? (capexEffectifKeuro ?? capexTotalWithFinancingFeesKeuro) / project.capacityMw
                        : 0,
                      " kEUR/MWc",
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {cashFlowOpexDetails !== null ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="meta-label">Détail OPEX an 1</p>
            <div className="mt-2 grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4" style={{ border: "1px solid #e5e7eb" }}>
              {[
                { label: "O&M", value: formatNumber(cashFlowOpexDetails.omKeuro, " kEUR/an") },
                { label: "MRA", value: formatNumber(cashFlowOpexDetails.mraKeuro, " kEUR/an") },
                { label: "Back-office", value: formatNumber(cashFlowOpexDetails.backOfficeKeuro, " kEUR/an") },
                { label: "Divers", value: formatNumber(cashFlowOpexDetails.diversKeuro, " kEUR/an") },
                { label: "Loyer", value: formatNumber(cashFlowOpexDetails.loyerKeuro, " kEUR/an") },
                { label: "Assurance", value: formatNumber(cashFlowOpexDetails.assuranceKeuro, " kEUR/an") },
                { label: "Balancing", value: formatNumber(cashFlowOpexDetails.balancingKeuro, " kEUR/an") },
                { label: "TF", value: formatNumber(cashFlowOpexDetails.tfKeuro, " kEUR/an") },
                { label: "CFE", value: formatNumber(cashFlowOpexDetails.cfeKeuro, " kEUR/an") },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{label}</span>
                  <p style={{ fontWeight: 600, color: "#0d1117" }}>{value}</p>
                </div>
              ))}
              <div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Total</span>
                <p style={{ fontWeight: 700, color: "var(--ps-blue-dark)" }}>
                  {formatNumber(cashFlowOpexDetails.opexTotalKeuro, " kEUR/an")}{" "}
                  <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                    {formatNumber(cashFlowOpexDetails.opexPerMwKeuro, " kEUR/MWc")}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {cashFlowScenario?.dscrSchedule ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="meta-label">Profil DSCR cible</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(parseDscrSchedule(cashFlowScenario.dscrSchedule) ?? []).map((t, i) => (
                <span key={i} className="badge badge-blue">
                  {t.dscrValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} · an {t.yearFrom}–{t.yearTo}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ProjectFinancialCharts
        financingData={financingChartData}
        gearingRealisePct={gearingRealisePct}
        cashFlowData={cashFlowChartData}
        contractDuration={cashFlowScenario?.contractDuration ?? null}
        capexData={capexChartData}
        dscrData={dscrChartData}
        debtRepaymentData={debtRepaymentChartData}
      />

      <section className="card">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 className="section-title">Hypothèses financières</h2>
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{cashFlowScenario?.name ?? "-"}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {[
            { label: "Durée projet", value: cashFlowScenario ? `${cashFlowScenario.projectLifeYears} ans` : "-" },
            { label: "Actualisation", value: formatNumber(cashFlowScenario?.discountRate ?? null, " %") },
            { label: "Dégradation", value: formatNumber(cashFlowScenario?.degradationRate ?? null, " %") },
            { label: "Taux dette", value: formatNumber(cashFlowScenario?.debtInterestRate ?? null, " %") },
            { label: "Maturité dette", value: cashFlowScenario ? `${cashFlowScenario.debtMaturityYears} ans` : "-" },
            { label: "Inflation tarif", value: formatNumber(cashFlowScenario?.tariffInflationRate ?? null, " %") },
            { label: "Inflation OPEX", value: formatNumber(cashFlowScenario?.opexInflationRate ?? null, " %") },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="meta-label">{label}</p>
              <p className="meta-value">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {sizing !== null ? (
        <section className="card">
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>Structuration dette</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="meta-label">Dette sculptée (P90)</p>
              <p className="meta-value">{formatNumber(sizing.debtSculptedKeuro, " k€")}</p>
            </div>
            {sizing.debtGearingMaxKeuro !== null ? (
              <div>
                <p className="meta-label">Gearing max ({cashFlowScenario?.gearingMaxPct ?? ""}%)</p>
                <p className="meta-value">{formatNumber(sizing.debtGearingMaxKeuro, " k€")}</p>
              </div>
            ) : null}
            <div>
              <p className="meta-label">Dette retenue</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ps-blue-dark)" }}>
                  {formatNumber(sizing.debtRetenuKeuro, " k€")}
                </span>
                {sizing.bindingConstraint === "dscr" ? (
                  <span className="constraint-badge dscr">DSCR</span>
                ) : sizing.bindingConstraint === "gearing" ? (
                  <span className="constraint-badge gearing">Gearing</span>
                ) : (
                  <span className="constraint-badge equal">Égal</span>
                )}
              </div>
            </div>
            <div>
              <p className="meta-label">Ecart contrainte gearing</p>
              <p className="meta-value">
                {formatNumber(
                  sizing.debtGearingMaxKeuro !== null
                    ? sizing.debtGearingMaxKeuro - sizing.debtRetenuKeuro
                    : null,
                  " k€",
                )}
              </p>
            </div>
            <div>
              <p className="meta-label">CCA</p>
              <p className="meta-value">{formatNumber(ccaKeuro, " k€")}</p>
            </div>
            <div>
              <p className="meta-label">Gearing réalisé</p>
              <p className="meta-value">{formatNumber(gearingRealisePct, " %")}</p>
            </div>
            {sizing.margeFactKeuro > 0 ? (
              <div>
                <p className="meta-label">Marge facturable</p>
                <p style={{ fontWeight: 700, color: "var(--ps-green)", marginTop: "0.2rem" }}>
                  +{formatNumber(sizing.margeFactKeuro, " k€")}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 className="section-title">Résultats calculés</h2>
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{analysisScenario?.name ?? "-"}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="meta-label">VAN Brute</p>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ps-blue-dark)", marginTop: "0.2rem" }}>
              {formatMillionEuros(analysisMetrics?.npv ?? analysisScenario?.npv ?? null)}
            </p>
          </div>
          <div>
            <p className="meta-label">VAN Nette</p>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ps-green)", marginTop: "0.2rem" }}>
              {formatMillionEuros(analysisNpvNetKeuro)}
            </p>
          </div>
          <div>
            <p className="meta-label">LCOE</p>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ps-blue-mid)", marginTop: "0.2rem" }}>
              {formatNumber(analysisMetrics?.lcoe ?? analysisScenario?.lcoe ?? null, " €/MWh")}
            </p>
          </div>
        </div>
      </section>

      {cashFlowMetrics?.doubleIRR !== null && cashFlowMetrics?.doubleIRR !== undefined ? (
        <section className="card">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 className="section-title">Double TRI</h2>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{cashFlowScenario?.name ?? "-"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="meta-label">TRI Invest</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ps-green)", marginTop: "0.2rem" }}>
                {formatNumber(cashFlowMetrics.doubleIRR.irrInvest, " %")}
              </p>
            </div>
            <div>
              <p className="meta-label">TRI Entreprise</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ps-blue-dark)", marginTop: "0.2rem" }}>
                {formatNumber(cashFlowMetrics.doubleIRR.irrEntreprise, " %")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 className="section-title">Cash-flows annuels</h2>
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{cashFlowScenario?.name ?? "-"}</span>
        </div>
        <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}>
          <table className="ps-table" style={{ minWidth: "3450px" }}>
            <thead>
              <tr>
                <th className="col-left">Année</th>
                <th>Tarif €/MWh</th>
                <th>Prod. P50 MWh</th>
                <th>Prod. P90 MWh</th>
                <th>CA P50 k€</th>
                <th>CA P90 k€</th>
                <th>OPEX k€</th>
                <th>CF P50 k€</th>
                <th>CF actualisé k€</th>
                <th>Svc dette k€</th>
                <th>Svc sculpté k€</th>
                <th>CFADS P90 IS k€</th>
                <th>IS</th>
                <th>Déficit cum.</th>
                <th>Résultat net</th>
                <th>CFADS ap. IS</th>
                <th>DSRA solde</th>
                <th>Cash bloqué</th>
                <th>Dividende</th>
                <th>Flux action.</th>
                <th>DSCR P90</th>
                <th>DSCR cible</th>
                <th>DSCR réalisé</th>
                <th>Dette sculptée k€</th>
                <th>Dette retenue k€</th>
              </tr>
            </thead>
            <tbody>
              {sizing !== null ? (
                <tr style={{ fontStyle: "italic", color: "#6b7280", background: "#f8fafc" }}>
                  <td className="col-left">0</td>
                  {Array.from({ length: 22 }, (_, i) => <td key={i}>-</td>)}
                  <td className="col-left" style={{ color: "var(--ps-blue-dark)", fontStyle: "normal" }}>
                    {formatNumber(sizing.debtSculptedKeuro)}
                  </td>
                  <td style={{ color: "var(--ps-blue-dark)", fontStyle: "normal" }}>
                    {formatNumber(sizing.debtRetenuKeuro)}
                  </td>
                </tr>
              ) : null}
              {annualCashFlows.map((row) => (
                <tr key={row.year}>
                  <td className="col-left">{row.year}</td>
                  <td>{formatNumber(row.annualTariff)}</td>
                  <td>{formatNumber(row.productionP50Mwh)}</td>
                  <td>{formatNumber(row.productionP90Mwh)}</td>
                  <td>{formatNumber(row.revenueP50Keuro)}</td>
                  <td>{formatNumber(row.revenueP90Keuro)}</td>
                  <td className="val-neg">{formatNumber(row.opexKeuro)}</td>
                  <td className={row.cashFlowKeuro >= 0 ? "val-pos" : "val-neg"}>
                    {formatNumber(row.cashFlowKeuro)}
                  </td>
                  <td>{formatNumber(row.discountedCashFlowKeuro)}</td>
                  <td>{formatNumber(row.debtServiceSculptedKeuro ?? row.debtServiceKeuro)}</td>
                  <td>
                    {row.debtServiceSculptedKeuro !== null
                      ? formatNumber(row.debtServiceSculptedKeuro)
                      : "-"}
                  </td>
                  <td>{formatNumber(row.cfadsP90AfterTaxKeuro)}</td>
                  <td>{formatNumber(row.is)}</td>
                  <td>{formatNumber(row.deficitCumuleKeuro)}</td>
                  <td className={row.resultatNet !== null && row.resultatNet >= 0 ? "val-pos" : "val-neg"}>
                    {formatNumber(row.resultatNet)}
                  </td>
                  <td>{formatNumber(row.cfadsAfterTax)}</td>
                  <td>{formatNumber(row.dsraSoldeKeuro)}</td>
                  <td>{formatNumber(row.cashBloqueKeuro)}</td>
                  <td className={row.dividende !== null && row.dividende >= 0 ? "val-pos" : ""}>
                    {formatNumber(row.dividende)}
                  </td>
                  <td className={row.fluxActionnaire !== null && row.fluxActionnaire >= 0 ? "val-pos" : "val-neg"}>
                    {formatNumber(row.fluxActionnaire)}
                  </td>
                  <td>{formatNumber(row.dscr)}</td>
                  <td>{row.dscrTargetAtYear !== null ? formatNumber(row.dscrTargetAtYear) : "-"}</td>
                  <td>{row.dscrRealized !== null ? formatNumber(row.dscrRealized) : "-"}</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              ))}
              {annualCashFlows.length === 0 ? (
                <tr>
                  <td colSpan={25} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    -
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flex flex-col gap-4">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 className="section-title">Analyses de sensibilité</h2>
            <p className="section-subtitle">Sensibilités sur scénario sélectionné</p>
          </div>
          <form style={{ display: "flex", gap: "0.5rem" }}>
            <select
              name="scenarioId"
              defaultValue={analysisScenario?.id}
              className="h-10 px-3"
              style={{ fontSize: "0.875rem" }}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Analyser
            </button>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SensitivityTable
            title="Sensibilité Tarif"
            valueLabel="Tarif"
            valueSuffix=" €/MWh"
            rows={tariffSensitivityRows}
          />
          <SensitivityTable
            title="Sensibilité CAPEX"
            valueLabel="CAPEX"
            valueSuffix=" k€/MW"
            rows={capexSensitivityRows}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Comparaison des scénarios</h2>
        <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}>
          <table className="ps-table" style={{ minWidth: "980px" }}>
            <thead>
              <tr>
                <th className="col-left">Scénario</th>
                <th>CAPEX</th>
                <th>OPEX</th>
                <th>Yield MWh</th>
                <th>Tarif</th>
                <th>Dette</th>
                <th>DSCR</th>
                <th>VAN</th>
                <th>TRI</th>
                <th>LCOE</th>
                <th className="col-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id}>
                  <td className="col-left">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>{scenario.name}</span>
                      {scenario.isReference ? (
                        <span className="badge badge-blue" style={{ fontSize: "0.6rem" }}>Référence</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatNumber(scenario.capex, " k€/MW")}</td>
                  <td>{formatNumber(scenario.opex, " k€/MW")}</td>
                  <td>{formatNumber(scenario.yieldMwh)}</td>
                  <td>{formatNumber(scenario.tariff, " €/MWh")}</td>
                  <td>{formatNumber(scenario.debtRate, " %")}</td>
                  <td>{formatNumber(scenario.dscr > 0 ? scenario.dscr : null)}</td>
                  <td className="val-pos">{formatMillionEuros(scenario.npv)}</td>
                  <td className="val-pos">{formatNumber(scenario.irr, " %")}</td>
                  <td>{formatNumber(scenario.lcoe, " €/MWh")}</td>
                  <td className="col-left">
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                      <Link
                        href={`/projects/${project.id}/scenarios/${scenario.id}/edit`}
                        className="btn-secondary btn-sm"
                      >
                        Modifier
                      </Link>
                      <form action={cloneScenario.bind(null, project.id, scenario.id)}>
                        <button type="submit" className="btn-secondary btn-sm">
                          Dupliquer
                        </button>
                      </form>
                      {!scenario.isReference ? (
                        <form action={setReferenceScenario.bind(null, project.id, scenario.id)}>
                          <button type="submit" className="btn-secondary btn-sm">
                            Définir réf.
                          </button>
                        </form>
                      ) : null}
                      <DeleteScenarioButton
                        projectId={project.id}
                        scenarioId={scenario.id}
                        scenarioName={scenario.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    -
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SensitivityTable({
  title,
  valueLabel,
  valueSuffix,
  rows,
}: {
  title: string;
  valueLabel: string;
  valueSuffix: string;
  rows: ReturnType<typeof generateSensitivityRows>;
}) {
  return (
    <div className="overflow-x-auto" style={{ borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <table className="ps-table" style={{ minWidth: "520px" }}>
        <thead>
          <tr>
            <th className="col-left">{title}</th>
            <th>Variation</th>
            <th>{valueLabel}</th>
            <th>VAN</th>
            <th>TRI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="col-left">{row.label}</td>
              <td style={{ color: row.variation > 0 ? "var(--ps-green)" : row.variation < 0 ? "var(--ps-red)" : undefined }}>
                {formatPercent(row.variation)}
              </td>
              <td>{formatNumber(row.value, valueSuffix)}</td>
              <td className="val-pos">{formatMillionEuros(row.npv)}</td>
              <td className="val-pos">{formatNumber(row.irr, " %")}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                -
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
