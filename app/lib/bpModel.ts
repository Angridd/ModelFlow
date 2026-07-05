/**
 * Brique COMMUNE « toutes les lignes du modèle année par année ».
 *
 * `buildBpModel` est une fonction PURE (zéro `any`, aucun rendu JSX) qui, à partir d'un projet +
 * scénario, produit une STRUCTURE de lignes du modèle regroupées par SECTION. Chaque ligne =
 * { label, unite, valeurs[] } alignée sur le vecteur `years` (an0..anN, années de construction
 * incluses). Elle NE recalcule PAS la finance : elle appelle le moteur (`buildFinanceInput` +
 * `computeFinanceFromInput` + `calculateAnnualCashFlows` + capex/opex details) et se contente de
 * MAPPER les champs réels d'`AnnualCashFlow` / `FinanceEngineResult` sur des lignes.
 *
 * Le résultat est indépendant du rendu → réutilisable tel quel pour :
 *   - la vue BP à l'écran (app/projects/[id]/bp/page.tsx),
 *   - un futur export Excel (une section = un bloc de lignes ; `years` = l'en-tête de colonnes).
 */
import type { Scenario } from "@/app/generated/prisma/client";
import {
  calculateAnnualCashFlows,
  calculateCapexDetails,
  calculateOpexDetails,
  type AnnualCashFlow,
  type OpexDetails,
} from "@/app/lib/finance/engine";
import {
  buildFinanceInput,
  computeFinanceFromInput,
  type ProjectFinanceFields,
} from "@/app/lib/scenarioMetrics";

/** Unité d'une ligne (pilote le formatage : milliers, %, ratio…). */
export type BpUnit =
  | "kEUR"
  | "%"
  | "MWh"
  | "ratio"
  | "EUR/MWh"
  | "MW"
  | "annees"
  | "kEUR/MW";

/**
 * Une ligne du modèle. `valeurs` a la même longueur que `BpModel.years` (une valeur par année),
 * SAUF pour les lignes `scalar` (métrique projet, non annuelle) où `valeurs` contient une seule
 * valeur. `NaN` = « non applicable » (affiché « - », cellule vide à l'export).
 */
export type BpLine = {
  label: string;
  unite: BpUnit;
  valeurs: number[];
  /** Métrique projet (TRI, VAN…) : une seule valeur, pas une série annuelle. */
  scalar?: boolean;
  /** Ligne de total / sous-total (mise en gras à l'affichage). */
  emphasis?: boolean;
};

/** Un bloc de lignes (onglet / regroupement du BP réel : C_P50, C_P90, C_Financing, C_D&A…). */
export type BpSection = {
  title: string;
  lines: BpLine[];
};

/** Structure complète du modèle BP, prête pour l'écran ET l'export Excel. */
export type BpModel = {
  projectName: string;
  scenarioName: string;
  /** En-tête temps : an négatif = construction, an1 = MES. Aligne toutes les lignes annuelles. */
  years: number[];
  sections: BpSection[];
  /** Champs du BP que le moteur n'expose PAS au niveau annuel (pour information / TODO export). */
  gaps: string[];
};

/** Projet minimal requis : les champs moteur + le nom (pour l'en-tête du modèle). */
export type BpProjectFields = ProjectFinanceFields & { name: string };

/** `null`/`undefined` → NaN (affiché « - »). Sinon la valeur telle quelle. */
function orNaN(value: number | null | undefined): number {
  return value == null ? NaN : value;
}

/**
 * Construit la structure BP complète. Fonction pure : lecture seule, aucun effet de bord.
 */
export function buildBpModel(project: BpProjectFields, scenario: Scenario): BpModel {
  const input = buildFinanceInput(project, scenario);
  const finance = computeFinanceFromInput(input);
  const { metrics } = finance;
  const flows = calculateAnnualCashFlows(input);
  const capex = calculateCapexDetails(input);
  const years = flows.map((row) => row.year);

  // ── OPEX détaillé par poste, par année (re-dérivé via calculateOpexDetails) ──────────────────
  // Le moteur n'expose que le TOTAL opexKeuro dans AnnualCashFlow. On reconstruit le split P50
  // poste par poste comme le fait le moteur : l'aléas des années > 1 est basé sur l'aléas an1
  // FIGÉ (aleasBaseKeuro), exactement comme buildPreRows (opexP90Basket.aleasKeuro).
  const firstOp = flows.find((row) => row.year === 1);
  const aleasBaseAn1 = firstOp
    ? calculateOpexDetails(
        input,
        1,
        firstOp.revenueP50Keuro,
        firstOp.productionP50Mwh,
        capex.capexTotalKeuro,
      ).aleasKeuro
    : 0;
  const opexByYear = new Map<number, OpexDetails>();
  for (const row of flows) {
    if (row.year < 1) continue;
    opexByYear.set(
      row.year,
      calculateOpexDetails(
        input,
        row.year,
        row.revenueP50Keuro,
        row.productionP50Mwh,
        capex.capexTotalKeuro,
        undefined,
        row.year === 1 ? undefined : aleasBaseAn1,
      ),
    );
  }

  // Extrait une série annuelle alignée sur `years`.
  const serie = (fn: (row: AnnualCashFlow) => number): number[] => flows.map(fn);
  // Extrait un poste OPEX (0 pendant la construction).
  const opexSerie = (fn: (od: OpexDetails) => number): number[] =>
    flows.map((row) => {
      const od = opexByYear.get(row.year);
      return od ? fn(od) : 0;
    });
  // Intérêts de la dette senior = intérêts totaux − intérêts SHL (le moteur agrège les deux).
  const debtInterest = (row: AnnualCashFlow): number => row.interets - row.ccaInteretsKeuro;
  const appliedDebtService = (row: AnnualCashFlow): number =>
    row.debtServiceSculptedKeuro ?? row.debtServiceKeuro;

  const line = (
    label: string,
    unite: BpUnit,
    valeurs: number[],
    opts: { emphasis?: boolean } = {},
  ): BpLine => ({ label, unite, valeurs, emphasis: opts.emphasis });

  const scalarLine = (label: string, unite: BpUnit, value: number | null | undefined): BpLine => ({
    label,
    unite,
    valeurs: [orNaN(value)],
    scalar: true,
  });

  const sizing = metrics.sizing;

  const sections: BpSection[] = [
    {
      title: "Hypothèses clés (rappel)",
      lines: [
        scalarLine("Capacité", "MW", input.capacityMw),
        scalarLine("Productible P50", "MWh", input.yieldMwh),
        scalarLine("Productible P90", "MWh", input.yieldP90Mwh ?? input.yieldMwh * 0.93),
        scalarLine("Tarif PPA (base)", "EUR/MWh", input.tariff),
        scalarLine("Durée contrat PPA", "annees", input.contractDuration),
        scalarLine("Taux d'actualisation", "%", input.discountRate),
        scalarLine("Taux dette (all-in)", "%", input.debtInterestRate),
        scalarLine("Ténor dette", "annees", input.debtTenorYears ?? input.debtMaturityYears),
        scalarLine("Gearing max", "%", input.gearingMaxPct),
        scalarLine("Taux IS", "%", input.tauxIS),
      ],
    },
    {
      title: "Production",
      lines: [
        line("Production P50", "MWh", serie((r) => r.productionP50Mwh)),
        line("Production P90", "MWh", serie((r) => r.productionP90Mwh)),
        line("Tarif appliqué", "EUR/MWh", serie((r) => r.annualTariff)),
      ],
    },
    {
      title: "Revenus",
      lines: [
        line("Revenus P50 (total)", "kEUR", serie((r) => r.revenueP50Keuro), { emphasis: true }),
        line("Revenus P90 (sizing)", "kEUR", serie((r) => r.revenueP90Keuro)),
      ],
    },
    {
      title: "OPEX par poste (P50)",
      lines: [
        line("O&M", "kEUR", opexSerie((od) => od.omKeuro)),
        line("MRA", "kEUR", opexSerie((od) => od.mraKeuro)),
        line("Back-office", "kEUR", opexSerie((od) => od.backOfficeKeuro)),
        line("Divers", "kEUR", opexSerie((od) => od.diversKeuro)),
        line("Loyer", "kEUR", opexSerie((od) => od.loyerKeuro)),
        line("Assurance", "kEUR", opexSerie((od) => od.assuranceKeuro)),
        line("Balancing", "kEUR", opexSerie((od) => od.balancingKeuro)),
        line("IFER", "kEUR", opexSerie((od) => od.iferKeuro)),
        line("Taxe foncière (TF)", "kEUR", opexSerie((od) => od.tfKeuro)),
        line("CFE", "kEUR", opexSerie((od) => od.cfeKeuro)),
        line("Aléas", "kEUR", opexSerie((od) => od.aleasKeuro)),
        // Engagements = total OPEX moteur (incl. engagements) − total des postes ci-dessus.
        line(
          "Engagements",
          "kEUR",
          flows.map((r) => {
            const od = opexByYear.get(r.year);
            return od ? r.opexKeuro - od.opexTotalKeuro : 0;
          }),
        ),
        line("Total OPEX", "kEUR", serie((r) => r.opexKeuro), { emphasis: true }),
      ],
    },
    {
      title: "EBITDA",
      lines: [
        line("EBITDA P50", "kEUR", serie((r) => r.cashFlowKeuro), { emphasis: true }),
        line("EBITDA P90", "kEUR", serie((r) => r.cfadsP90Keuro)),
      ],
    },
    {
      title: "Amortissements (D&A)",
      lines: [
        line("Dotation D&A", "kEUR", serie((r) => r.amort)),
        line("VNC (valeur nette comptable)", "kEUR", serie((r) => r.vncKeuro)),
      ],
    },
    {
      title: "Compte de résultat",
      lines: [
        line("EBIT", "kEUR", serie((r) => r.ebit)),
        line("Intérêts dette senior", "kEUR", serie(debtInterest)),
        line("Intérêts SHL (CCA)", "kEUR", serie((r) => r.ccaInteretsKeuro)),
        line("Intérêts totaux", "kEUR", serie((r) => r.interets)),
        line("EBT", "kEUR", serie((r) => r.ebt)),
        line("IS", "kEUR", serie((r) => r.is)),
        line("Résultat net", "kEUR", serie((r) => r.resultatNet), { emphasis: true }),
        line("Déficit fiscal cumulé", "kEUR", serie((r) => r.deficitCumuleKeuro)),
        line("Résultat cumulé", "kEUR", serie((r) => r.resultatCumuleKeuro)),
      ],
    },
    {
      title: "CFADS",
      lines: [
        line("CFADS après IS (P50)", "kEUR", serie((r) => r.cfadsAfterTax), { emphasis: true }),
        line("CFADS P90 (sizing)", "kEUR", serie((r) => r.cfadsP90Keuro)),
        line("CFADS P90 après IS", "kEUR", serie((r) => r.cfadsP90AfterTaxKeuro)),
      ],
    },
    {
      title: "Service de la dette",
      lines: [
        line("Service dette (appliqué)", "kEUR", serie(appliedDebtService), { emphasis: true }),
        line(
          "dont principal",
          "kEUR",
          serie((r) => appliedDebtService(r) - debtInterest(r)),
        ),
        line("dont intérêts", "kEUR", serie(debtInterest)),
        line("Dette restante (EoP)", "kEUR", serie((r) => r.debtOutstandingKeuro)),
        line("DSCR cible", "ratio", serie((r) => orNaN(r.dscrTargetAtYear))),
        line("DSCR réalisé", "ratio", serie((r) => orNaN(r.dscrRealized))),
      ],
    },
    {
      title: "Réserve de service de la dette (DSRA)",
      lines: [
        line("DSRA solde", "kEUR", serie((r) => r.dsraSoldeKeuro)),
        line("DSRA dépôt", "kEUR", serie((r) => r.dsraDepotKeuro)),
        line("DSRA retrait", "kEUR", serie((r) => r.dsraRetraitKeuro)),
      ],
    },
    {
      title: "Waterfall SHL (CCA)",
      lines: [
        line("SHL solde d'ouverture (BoP)", "kEUR", serie((r) => r.ccaBoPKeuro)),
        line("SHL tirage (drawdown)", "kEUR", serie((r) => r.ccaDrawdownKeuro)),
        line("SHL intérêts capitalisés", "kEUR", serie((r) => r.ccaCapitalizedInterestKeuro)),
        line("SHL intérêts courus", "kEUR", serie((r) => r.ccaInteretsKeuro)),
        line("SHL remboursement", "kEUR", serie((r) => r.ccaRemboursementKeuro)),
        line("SHL solde de clôture (EoP)", "kEUR", serie((r) => r.ccaEoPKeuro), { emphasis: true }),
      ],
    },
    {
      title: "Distribution actionnaire",
      lines: [
        line("Dividende", "kEUR", serie((r) => r.dividende)),
        line("Cash bloqué", "kEUR", serie((r) => r.cashBloqueKeuro)),
        line("Flux actionnaire (FCF after DS)", "kEUR", serie((r) => r.fluxActionnaire), {
          emphasis: true,
        }),
      ],
    },
    {
      title: "Outputs (synthèse)",
      lines: [
        scalarLine("TRI investisseur", "%", metrics.investorIrr),
        scalarLine("TRI projet", "%", metrics.irr),
        scalarLine("VAN brute", "kEUR", finance.vanBruteKeuro),
        scalarLine("VAN nette", "kEUR", finance.vanNetteKeuro),
        scalarLine("LCOE", "EUR/MWh", metrics.lcoe),
        scalarLine("DSCR minimum", "ratio", metrics.dscr),
        scalarLine("CAPEX effectif", "kEUR", finance.capexEffectifKeuro),
        scalarLine("Dette retenue", "kEUR", finance.debtRetenuKeuro),
        scalarLine("CCA (SHL)", "kEUR", finance.ccaKeuro),
        scalarLine("Gearing", "%", finance.gearingPct),
        scalarLine("Marge facturable", "kEUR", sizing?.margeFactKeuro),
      ],
    },
  ];

  // Champs du BP présents dans la spec mais non exposés au grain annuel par le moteur.
  const gaps: string[] = [
    "Revenus P50 : split PPA / merchant / capacité / GO non exposé par AnnualCashFlow (seul le total revenueP50Keuro l'est) — ligne « Revenus P50 (total) » agrégée.",
    "Assurance (OPEX P50) re-dérivée sur le revenu total ; le moteur l'assoit sur le revenu PV (hors capacité/GO), non exposé → léger écart possible les années à capacité/GO.",
    "Démantèlement (BP §1.7, 24 k€/an an25-29) : non modélisé par le moteur, donc absent du modèle.",
  ];

  return {
    projectName: project.name,
    scenarioName: scenario.name,
    years,
    sections,
    gaps,
  };
}
