/**
 * Logique d'ANALYSE STRATÉGIQUE du portefeuille (pure, testable, ZÉRO `any`).
 *
 * Ce module NE calcule PAS la finance (c'est le rôle de app/lib/finance/engine.ts, non modifié) :
 * il consomme des métriques déjà calculées côté serveur (via computeProjectFinance + décomposition
 * CAPEX/OPEX) et fournit l'agrégation transverse portefeuille :
 *   - normalisation €/MWc (k€/MW) par poste,
 *   - médiane / quartiles portefeuille par poste,
 *   - détection d'anomalies (> médiane × seuil, + repère IQR),
 *   - badge de criticité (santé economics),
 *   - mapping « poste → input moteur » pour chiffrer les leviers (le recalcul lui-même est fait
 *     côté serveur en ré-appelant le moteur avec l'override retourné ici).
 *
 * Seule dépendance : le TYPE FinanceEngineInput (import type, aucun runtime moteur ici).
 */
import type { FinanceEngineInput } from "@/app/lib/finance/engine";

// ── Seuils (documentés) ──────────────────────────────────────────────────────────────
/** Un poste est signalé « anomalie » s'il dépasse la médiane portefeuille de +50 % (× 1,5). */
export const ANOMALY_RATIO = 1.5;
/** Repère IQR complémentaire : au-delà de Q3 + 1,5·IQR, l'anomalie est marquée « sévère ». */
export const IQR_FENCE = 1.5;

// Seuils de criticité economics (alignés cap gearing 95 % / plancher DSCR 1,15).
export const IRR_CRITICAL_PCT = 7.5;
export const GEARING_TENSE_PCT = 94.5;
export const DSCR_TENSE = 1.16;

// ── Postes de coût ─────────────────────────────────────────────────────────────────────
export type CapexPosteKey =
  | "modules"
  | "bos"
  | "raccordement"
  | "mod"
  | "foncier"
  | "contingency"
  | "apport"
  | "financing";

export type OpexPosteKey =
  | "om"
  | "mra"
  | "loyer"
  | "assurance"
  | "ifer"
  | "balancing"
  | "taxes"
  | "backoffice"
  | "divers"
  | "aleas";

export type PosteKey = CapexPosteKey | OpexPosteKey;
export type PosteCategory = "capex" | "opex";

export type PosteDef = {
  key: PosteKey;
  label: string;
  category: PosteCategory;
};

export const CAPEX_POSTES: readonly PosteDef[] = [
  { key: "modules", label: "Modules PV", category: "capex" },
  { key: "bos", label: "BOS", category: "capex" },
  { key: "raccordement", label: "Raccordement", category: "capex" },
  { key: "mod", label: "MOD / dev fees", category: "capex" },
  { key: "foncier", label: "Foncier & taxes aménagement", category: "capex" },
  { key: "contingency", label: "Contingency", category: "capex" },
  { key: "apport", label: "Apport d'affaire", category: "capex" },
  { key: "financing", label: "Frais de financement", category: "capex" },
] as const;

export const OPEX_POSTES: readonly PosteDef[] = [
  { key: "om", label: "O&M", category: "opex" },
  { key: "mra", label: "MRA (gros entretien)", category: "opex" },
  { key: "loyer", label: "Loyer foncier", category: "opex" },
  { key: "assurance", label: "Assurance", category: "opex" },
  { key: "ifer", label: "IFER", category: "opex" },
  { key: "balancing", label: "Balancing / écarts", category: "opex" },
  { key: "taxes", label: "Taxes locales (TF+CFE)", category: "opex" },
  { key: "backoffice", label: "Back-office", category: "opex" },
  { key: "divers", label: "Divers", category: "opex" },
  { key: "aleas", label: "Aléas OPEX", category: "opex" },
] as const;

export const ALL_POSTES: readonly PosteDef[] = [...CAPEX_POSTES, ...OPEX_POSTES];

/** Décomposition d'un projet en k€ absolus (CAPEX total, OPEX an-1). Construite côté serveur. */
export type ProjectPostes = {
  capex: Record<CapexPosteKey, number>;
  opex: Record<OpexPosteKey, number>;
};

// ── Métriques projet consolidées (sérialisables, construites côté serveur) ───────────────
export type ProjectMetrics = {
  id: string;
  name: string;
  technology: string;
  region: string;
  country: string;
  capacityMw: number;
  commissioningYear: number;
  investorIrr: number;
  npv: number;
  debtKeuro: number;
  ccaKeuro: number;
  capexEffectifKeuro: number;
  opexAn1Keuro: number;
  gearingPct: number | null;
  dscr: number | null;
};

/** Bundle par projet passé au client : métriques + décomposition postes (k€/MWc calculé à la volée). */
export type ProjectAnalysis = {
  metrics: ProjectMetrics;
  postes: ProjectPostes;
};

// ── Statistiques ─────────────────────────────────────────────────────────────────────
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Quantile linéaire (méthode « type 7 » façon Excel PERCENTILE), q ∈ [0,1]. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type QuartileStats = {
  q1: number;
  median: number;
  q3: number;
  /** Barrière haute de Tukey : Q3 + 1,5·(Q3−Q1). */
  upperFence: number;
};

export function quartileStats(values: readonly number[]): QuartileStats | null {
  const q1 = quantile(values, 0.25);
  const med = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  if (q1 === null || med === null || q3 === null) return null;
  return { q1, median: med, q3, upperFence: q3 + IQR_FENCE * (q3 - q1) };
}

/** Rang de quartile (1 = plus bas … 4 = plus haut) d'une valeur dans la distribution. */
export function quartileRank(value: number, values: readonly number[]): 1 | 2 | 3 | 4 {
  const s = quartileStats(values);
  if (!s) return 1;
  if (value <= s.q1) return 1;
  if (value <= s.median) return 2;
  if (value <= s.q3) return 3;
  return 4;
}

/** k€ absolus → k€/MWc (k€ par MW de puissance). MW ≤ 0 → 0. */
export function perMwc(keuro: number, capacityMw: number): number {
  return capacityMw > 0 ? keuro / capacityMw : 0;
}

// ── Criticité economics ───────────────────────────────────────────────────────────────
export type Health = "critical" | "tense" | "healthy";

export const HEALTH_META: Record<Health, { label: string; emoji: string; color: string }> = {
  critical: { label: "Critique", emoji: "🔴", color: "#ed7575" },
  tense: { label: "Tendu", emoji: "🟠", color: "#f59e0b" },
  healthy: { label: "Sain", emoji: "🟢", color: "#009557" },
};

export function classifyHealth(m: Pick<
  ProjectMetrics,
  "npv" | "investorIrr" | "gearingPct" | "dscr"
>): Health {
  if (m.npv < 0 || m.investorIrr < IRR_CRITICAL_PCT) return "critical";
  const gearingTense = m.gearingPct != null && m.gearingPct >= GEARING_TENSE_PCT;
  const dscrTense = m.dscr != null && m.dscr <= DSCR_TENSE;
  if (gearingTense || dscrTense) return "tense";
  return "healthy";
}

// ── Détection d'anomalies ─────────────────────────────────────────────────────────────
/** Médiane / quartiles portefeuille d'un poste, en k€/MWc (valeurs > 0 uniquement). */
export type PosteStat = {
  poste: PosteDef;
  values: number[]; // k€/MWc, seulement projets où le poste > 0
  median: number;
  stats: QuartileStats | null;
};

export function computePosteStats(projects: readonly ProjectAnalysis[]): Map<PosteKey, PosteStat> {
  const out = new Map<PosteKey, PosteStat>();
  for (const poste of ALL_POSTES) {
    const values: number[] = [];
    for (const p of projects) {
      const keuro =
        poste.category === "capex"
          ? p.postes.capex[poste.key as CapexPosteKey]
          : p.postes.opex[poste.key as OpexPosteKey];
      const v = perMwc(keuro, p.metrics.capacityMw);
      if (Number.isFinite(v) && v > 0) values.push(v);
    }
    const med = median(values) ?? 0;
    out.set(poste.key, { poste, values, median: med, stats: quartileStats(values) });
  }
  return out;
}

export type Anomaly = {
  projectId: string;
  projectName: string;
  capacityMw: number;
  poste: PosteDef;
  /** Valeur du poste pour ce projet, k€/MWc. */
  perMwc: number;
  /** Médiane portefeuille du poste, k€/MWc. */
  medianPerMwc: number;
  /** Écart relatif à la médiane, en % (ex. +180 %). */
  deviationPct: number;
  /** k€ absolus du poste pour ce projet. */
  keuro: number;
  /** k€ « en trop » vs médiane (perMwc − médiane) × MW. */
  excessKeuro: number;
  /** true si au-delà de la barrière IQR (Q3 + 1,5·IQR) → anomalie forte. */
  severe: boolean;
};

/**
 * Signale, pour chaque projet et chaque poste, les valeurs > médiane × ANOMALY_RATIO.
 * Trié par écart absolu (k€ en trop) décroissant.
 */
export function detectAnomalies(projects: readonly ProjectAnalysis[]): Anomaly[] {
  const stats = computePosteStats(projects);
  const anomalies: Anomaly[] = [];
  for (const p of projects) {
    for (const poste of ALL_POSTES) {
      const st = stats.get(poste.key);
      if (!st || st.median <= 0) continue;
      const keuro =
        poste.category === "capex"
          ? p.postes.capex[poste.key as CapexPosteKey]
          : p.postes.opex[poste.key as OpexPosteKey];
      const value = perMwc(keuro, p.metrics.capacityMw);
      if (!(value >= st.median * ANOMALY_RATIO)) continue;
      const excessKeuro = (value - st.median) * p.metrics.capacityMw;
      anomalies.push({
        projectId: p.metrics.id,
        projectName: p.metrics.name,
        capacityMw: p.metrics.capacityMw,
        poste,
        perMwc: value,
        medianPerMwc: st.median,
        deviationPct: (value / st.median - 1) * 100,
        keuro,
        excessKeuro,
        severe: st.stats != null && value > st.stats.upperFence,
      });
    }
  }
  return anomalies.sort((a, b) => b.excessKeuro - a.excessKeuro);
}

// ── Mapping poste → input moteur (pour chiffrer les leviers) ─────────────────────────────
export type LeverPlan =
  | {
      kind: "recompute";
      /** Override à fusionner dans le FinanceEngineInput avant recalcul moteur. */
      override: Partial<FinanceEngineInput>;
      /** true : plusieurs inputs scalés → ΔVAN/ΔTRI approximatif (mais du bon ordre de grandeur). */
      approximate: boolean;
    }
  | { kind: "indicative"; reason: string };

function clampRatio(target: number, current: number): number {
  if (!(current > 0)) return 1;
  const r = target / current;
  if (!Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, r));
}

/** Scale un champ nullable : null/absent → non modifié (rétrocompat : moteur inchangé). */
function scaled(
  input: FinanceEngineInput,
  field: keyof FinanceEngineInput,
  ratio: number,
): number | null {
  const v = input[field];
  return typeof v === "number" && Number.isFinite(v) ? v * ratio : null;
}

/**
 * Construit l'override moteur qui ramène `posteKey` à `targetKeuro` (la médiane portefeuille).
 * Champ input nul → on ne peut pas piloter le poste proprement : « indicative » (on montrera juste
 * le Δcoût, jamais de plantage). Le recalcul VAN/TRI est fait par l'appelant (serveur).
 */
export function buildLeverPlan(
  posteKey: PosteKey,
  input: FinanceEngineInput,
  currentKeuro: number,
  targetKeuro: number,
): LeverPlan {
  const ratio = clampRatio(targetKeuro, currentKeuro);

  // Helper : construit un override en scalant N champs par `ratio`, en ignorant les champs nuls.
  const scaleFields = (
    fields: readonly (keyof FinanceEngineInput)[],
  ): Partial<FinanceEngineInput> | null => {
    const override: Partial<FinanceEngineInput> = {};
    let touched = 0;
    for (const f of fields) {
      const v = scaled(input, f, ratio);
      if (v !== null) {
        (override as Record<string, number>)[f as string] = v;
        touched++;
      }
    }
    return touched > 0 ? override : null;
  };

  switch (posteKey) {
    case "modules": {
      const o = scaleFields(["prixModuleUSDWc"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "prix module non saisi" };
    }
    case "bos": {
      const o = scaleFields(["boSCtWc"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "BOS non saisi" };
    }
    case "raccordement": {
      // Raccordement = ouvrage + quote-part QP. On abaisse l'ouvrage du surcoût exact vs médiane.
      const ouvrage = input.raccordementOuvrageKEuro;
      if (typeof ouvrage !== "number" || !(ouvrage > 0)) {
        return { kind: "indicative", reason: "ouvrage raccordement non saisi" };
      }
      const delta = Math.max(0, currentKeuro - targetKeuro);
      return {
        kind: "recompute",
        override: { raccordementOuvrageKEuro: Math.max(0, ouvrage - delta) },
        approximate: false,
      };
    }
    case "mod": {
      const o = scaleFields(["devFeesKEuroPerMW"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "dev fees non saisis" };
    }
    case "foncier": {
      const o = scaleFields(["txAmenagementRate", "coefArcheo", "indemnitesImmoKeuro"]);
      return o ? { kind: "recompute", override: o, approximate: true } : { kind: "indicative", reason: "postes fonciers non saisis" };
    }
    case "contingency": {
      const o = scaleFields(["contingencyRate"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "taux contingency non saisi" };
    }
    case "apport": {
      const o = scaleFields(["apportAffaireValeur"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "apport non saisi" };
    }
    case "financing": {
      const o = scaleFields([
        "arrangerFeesRate",
        "participantFeesRate",
        "interimFinancingRate",
        "commitmentFeesRate",
        "bankFeesPLTKEuroPerMW",
        "legalFeesKEuro",
        "technicalDDKEuro",
      ]);
      return o ? { kind: "recompute", override: o, approximate: true } : { kind: "indicative", reason: "frais de financement dérivés (défauts moteur)" };
    }
    case "om": {
      const o = scaleFields(["omFixedEuroKwc"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "O&M non saisi" };
    }
    case "mra": {
      const o = scaleFields(["mraEuroKwc"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "MRA non saisie" };
    }
    case "loyer": {
      const o = scaleFields(["loyerValeur"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "loyer non saisi" };
    }
    case "assurance": {
      const o = scaleFields(["assuranceRate"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "taux assurance non saisi" };
    }
    case "ifer": {
      const o = scaleFields(["iferRate1", "iferRate2"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "tarif IFER non saisi" };
    }
    case "balancing": {
      const o = scaleFields(["balancingCost"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "coût balancing non saisi" };
    }
    case "taxes": {
      const o = scaleFields([
        "tauxTFCommune",
        "tauxTFEPCI",
        "tauxTSE",
        "tauxGEMAPI",
        "tauxTEOM",
        "tauxCFECommune",
        "tauxCFEEPCI",
        "tauxCCI",
        "tauxTSECfe",
        "tauxGEMAPICfe",
      ]);
      return o ? { kind: "recompute", override: o, approximate: true } : { kind: "indicative", reason: "taux de taxes locales non saisis" };
    }
    case "backoffice": {
      const o = scaleFields(["backOfficeKeuro"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "back-office non saisi" };
    }
    case "divers": {
      const o = scaleFields(["diversOpexKeuro"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "divers OPEX non saisi" };
    }
    case "aleas": {
      const o = scaleFields(["aleasOpexRate"]);
      return o ? { kind: "recompute", override: o, approximate: false } : { kind: "indicative", reason: "taux aléas non saisi" };
    }
    default: {
      // Exhaustivité : tous les PosteKey sont traités ci-dessus.
      const _never: never = posteKey;
      return { kind: "indicative", reason: String(_never) };
    }
  }
}

// ── Résultat d'un levier chiffré (rempli côté serveur après recalcul moteur) ──────────────
export type LeverResult = {
  projectId: string;
  projectName: string;
  poste: PosteDef;
  /** k€ économisés en ramenant le poste à la médiane (Δcoût brut, toujours disponible). */
  savingKeuro: number;
  deviationPct: number;
  /** ΔVAN (k€) du recalcul moteur. null si levier « indicatif » (pas d'input pilotable). */
  deltaVanKeuro: number | null;
  /** ΔTRI investisseur (points de %). null si indicatif. */
  deltaIrrPp: number | null;
  /** true : impact VAN/TRI approximatif (plusieurs inputs scalés). */
  approximate: boolean;
  /** true : aucun input pilotable → seul le Δcoût est montré. */
  indicative: boolean;
};

// ── Benchmark : colonnes normalisées €/MWc + sens de lecture pour le heatmap ──────────────
export type BenchmarkColumnKey =
  | "capexPerMwc"
  | "opexPerMwc"
  | "debtPerMwc"
  | "vanPerMwc"
  | "investorIrr"
  | "gearingPct"
  | "dscr";

export type BenchmarkColumn = {
  key: BenchmarkColumnKey;
  label: string;
  unit: string;
  /** "high" = une valeur haute est BONNE (vert au Q4) ; "low" = une valeur haute est MAUVAISE. */
  goodDirection: "high" | "low";
  digits: number;
};

export const BENCHMARK_COLUMNS: readonly BenchmarkColumn[] = [
  { key: "capexPerMwc", label: "CAPEX", unit: "k€/MWc", goodDirection: "low", digits: 0 },
  { key: "opexPerMwc", label: "OPEX an-1", unit: "k€/MWc", goodDirection: "low", digits: 1 },
  { key: "debtPerMwc", label: "Dette", unit: "k€/MWc", goodDirection: "low", digits: 0 },
  { key: "vanPerMwc", label: "VAN nette", unit: "k€/MWc", goodDirection: "high", digits: 0 },
  { key: "investorIrr", label: "TRI inv.", unit: "%", goodDirection: "high", digits: 1 },
  { key: "gearingPct", label: "Gearing", unit: "%", goodDirection: "low", digits: 1 },
  { key: "dscr", label: "DSCR", unit: "x", goodDirection: "high", digits: 2 },
] as const;

// ── Sensibilité (tornado) — types partagés client ⇆ server action ────────────────────────
export type TornadoVariable = "tariff" | "capex" | "yield" | "debtRate" | "merchant";

export type TornadoRow = {
  variable: TornadoVariable;
  label: string;
  baseIrr: number;
  lowIrr: number;
  highIrr: number;
  baseNpv: number;
  lowNpv: number;
  highNpv: number;
};

// ── Stress test PORTEFEUILLE — choc UNIFORME sur les inputs (types + perturbation pure) ──────
/**
 * Drivers exposés dans l'onglet stress test. Chaque delta est un ÉCART ABSOLU (défaut 0) appliqué
 * À L'IDENTIQUE sur les 25 projets. La perturbation se fait AU NIVEAU DES INPUTS (moteur inchangé).
 */
export type StressDriverKey = "tariff" | "debtRate" | "capex" | "yield" | "merchant" | "opex";

export type StressDeltas = Record<StressDriverKey, number>;

export const ZERO_STRESS_DELTAS: StressDeltas = {
  tariff: 0,
  debtRate: 0,
  capex: 0,
  yield: 0,
  merchant: 0,
  opex: 0,
};

export type StressDriverDef = {
  key: StressDriverKey;
  label: string;
  unit: string;
  /** Pas suggéré pour le champ (incrément UI). */
  step: number;
  /** Note affichée sous le champ (mapping input / proxy). */
  hint: string;
};

export const STRESS_DRIVERS: readonly StressDriverDef[] = [
  { key: "tariff", label: "Tarif PPA", unit: "€/MWh", step: 1, hint: "additif sur input « tariff »" },
  { key: "debtRate", label: "Taux de dette (all-in)", unit: "bips", step: 10, hint: "+bips/100 sur « debtInterestRate » (points de %)" },
  { key: "capex", label: "CAPEX", unit: "ct/Wc", step: 1, hint: "proxy via « boSCtWc » : s'ajoute au CAPEX, D&A et base des frais de financing" },
  { key: "yield", label: "Productible", unit: "%", step: 1, hint: "×(1+δ) sur « yieldMwh » / « yieldP90Mwh »" },
  { key: "merchant", label: "Prix merchant", unit: "€/MWh", step: 1, hint: "décale les courbes Aurora (investor + debt sizing)" },
  { key: "opex", label: "OPEX O&M", unit: "€/kWc", step: 0.1, hint: "additif sur « omFixedEuroKwc »" },
] as const;

/**
 * Applique le choc UNIFORME aux inputs d'UN projet (pure, ZÉRO `any`, moteur non touché).
 * Chaque driver est indépendant ; un delta nul ⇒ champ inchangé (baseline == stressé si tout à 0).
 *   - tariff    : + €/MWh sur `tariff`
 *   - debtRate  : + bips → + bips/100 points de % sur `debtInterestRate`
 *   - capex     : + ct/Wc via `boSCtWc` (proxy fidèle : le BOS s'ajoute linéairement au CAPEX et
 *                 alimente D&A + base des frais de financing comme du vrai capex)
 *   - yield     : ×(1 + δ/100) sur `yieldMwh` et `yieldP90Mwh`
 *   - merchant  : + €/MWh sur chaque point des courbes Aurora (high/central/low)
 *   - opex      : + €/kWc sur `omFixedEuroKwc`
 */
export function applyStressDeltas(
  input: FinanceEngineInput,
  deltas: StressDeltas,
): FinanceEngineInput {
  let out: FinanceEngineInput = input;

  if (deltas.tariff !== 0 && typeof out.tariff === "number" && Number.isFinite(out.tariff)) {
    out = { ...out, tariff: out.tariff + deltas.tariff };
  }

  if (
    deltas.debtRate !== 0 &&
    typeof out.debtInterestRate === "number" &&
    Number.isFinite(out.debtInterestRate)
  ) {
    out = { ...out, debtInterestRate: out.debtInterestRate + deltas.debtRate / 100 };
  }

  if (deltas.capex !== 0) {
    out = { ...out, boSCtWc: (out.boSCtWc ?? 0) + deltas.capex };
  }

  if (deltas.yield !== 0) {
    const factor = 1 + deltas.yield / 100;
    const next: Partial<FinanceEngineInput> = {};
    if (typeof out.yieldMwh === "number" && Number.isFinite(out.yieldMwh)) {
      next.yieldMwh = out.yieldMwh * factor;
    }
    if (typeof out.yieldP90Mwh === "number" && Number.isFinite(out.yieldP90Mwh)) {
      next.yieldP90Mwh = out.yieldP90Mwh * factor;
    }
    out = { ...out, ...next };
  }

  if (deltas.merchant !== 0 && out.auroraCurves) {
    out = {
      ...out,
      auroraCurves: out.auroraCurves.map((c) => ({
        year: c.year,
        high: c.high + deltas.merchant,
        central: c.central + deltas.merchant,
        low: c.low + deltas.merchant,
      })),
    };
  }

  if (
    deltas.opex !== 0 &&
    typeof out.omFixedEuroKwc === "number" &&
    Number.isFinite(out.omFixedEuroKwc)
  ) {
    out = { ...out, omFixedEuroKwc: out.omFixedEuroKwc + deltas.opex };
  }

  return out;
}

// ── Stress test — types résultat partagés client ⇆ server action ─────────────────────────
export type PortfolioStressProjectRow = {
  id: string;
  name: string;
  capacityMw: number;
  baseIrr: number;
  stressIrr: number;
  baseNpv: number;
  stressNpv: number;
  baseHealth: Health;
  stressHealth: Health;
};

export type PortfolioStressAggregate = {
  projectCount: number;
  baseNpvTotal: number;
  stressNpvTotal: number;
  baseIrrMedian: number | null;
  stressIrrMedian: number | null;
  baseDebtTotal: number;
  stressDebtTotal: number;
  baseEquityTotal: number;
  stressEquityTotal: number;
  /** Nb de projets avec TRI investisseur ≥ IRR_CRITICAL_PCT (7,5 %). */
  baseAboveThreshold: number;
  stressAboveThreshold: number;
};

export type PortfolioStressResult = {
  deltas: StressDeltas;
  rows: PortfolioStressProjectRow[];
  aggregate: PortfolioStressAggregate;
};

export function benchmarkValue(m: ProjectMetrics, key: BenchmarkColumnKey): number | null {
  switch (key) {
    case "capexPerMwc":
      return perMwc(m.capexEffectifKeuro, m.capacityMw);
    case "opexPerMwc":
      return perMwc(m.opexAn1Keuro, m.capacityMw);
    case "debtPerMwc":
      return perMwc(m.debtKeuro, m.capacityMw);
    case "vanPerMwc":
      return perMwc(m.npv, m.capacityMw);
    case "investorIrr":
      return m.investorIrr;
    case "gearingPct":
      return m.gearingPct;
    case "dscr":
      return m.dscr;
    default: {
      const _never: never = key;
      return _never;
    }
  }
}
