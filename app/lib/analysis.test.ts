import { describe, expect, it } from "vitest";
import type { FinanceEngineInput } from "@/app/lib/finance/engine";
import {
  ANOMALY_RATIO,
  applyStressDeltas,
  benchmarkValue,
  buildLeverPlan,
  classifyHealth,
  computePosteStats,
  detectAnomalies,
  median,
  perMwc,
  quantile,
  quartileRank,
  ZERO_STRESS_DELTAS,
  type ProjectAnalysis,
  type ProjectMetrics,
  type ProjectPostes,
} from "@/app/lib/analysis";

function makeMetrics(over: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    id: "p",
    name: "P",
    technology: "Fixed",
    region: "R",
    country: "FR",
    capacityMw: 10,
    commissioningYear: 2026,
    investorIrr: 12,
    npv: 1000,
    debtKeuro: 8000,
    ccaKeuro: 2000,
    capexEffectifKeuro: 10000,
    opexAn1Keuro: 300,
    gearingPct: 80,
    dscr: 1.3,
    ...over,
  };
}

function makePostes(capexModules: number): ProjectPostes {
  return {
    capex: {
      modules: capexModules,
      bos: 0,
      raccordement: 0,
      mod: 0,
      foncier: 0,
      contingency: 0,
      apport: 0,
      financing: 0,
    },
    opex: {
      om: 0,
      mra: 0,
      loyer: 0,
      assurance: 0,
      ifer: 0,
      balancing: 0,
      taxes: 0,
      backoffice: 0,
      divers: 0,
      aleas: 0,
    },
  };
}

describe("stats de base", () => {
  it("median gère pair/impair/vide", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("quantile type-7 (Excel PERCENTILE)", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 6);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 6);
  });

  it("quartileRank place la valeur dans le bon quartile", () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(quartileRank(1, vals)).toBe(1);
    expect(quartileRank(8, vals)).toBe(4);
  });

  it("perMwc protège la division par zéro", () => {
    expect(perMwc(1000, 10)).toBe(100);
    expect(perMwc(1000, 0)).toBe(0);
  });
});

describe("criticité economics", () => {
  it("critique si VAN < 0 ou TRI < 7,5 %", () => {
    expect(classifyHealth(makeMetrics({ npv: -1 }))).toBe("critical");
    expect(classifyHealth(makeMetrics({ investorIrr: 7 }))).toBe("critical");
  });
  it("tendu si gearing ≥ 94,5 % ou DSCR ≤ 1,16", () => {
    expect(classifyHealth(makeMetrics({ gearingPct: 94.6 }))).toBe("tense");
    expect(classifyHealth(makeMetrics({ dscr: 1.15 }))).toBe("tense");
  });
  it("sain sinon", () => {
    expect(classifyHealth(makeMetrics())).toBe("healthy");
  });
});

describe("détection d'anomalies", () => {
  const projects: ProjectAnalysis[] = [
    { metrics: makeMetrics({ id: "a", name: "A", capacityMw: 10 }), postes: makePostes(1000) }, // 100/MWc
    { metrics: makeMetrics({ id: "b", name: "B", capacityMw: 10 }), postes: makePostes(1000) }, // 100/MWc
    { metrics: makeMetrics({ id: "c", name: "C", capacityMw: 10 }), postes: makePostes(2000) }, // 200/MWc → anomalie
  ];

  it("médiane portefeuille sur valeurs > 0", () => {
    const stats = computePosteStats(projects);
    expect(stats.get("modules")?.median).toBe(100);
  });

  it("signale > médiane × 1,5 et chiffre l'écart en k€", () => {
    const anomalies = detectAnomalies(projects);
    const mod = anomalies.find((a) => a.projectId === "c" && a.poste.key === "modules");
    expect(mod).toBeDefined();
    expect(mod?.perMwc).toBe(200);
    expect(mod?.deviationPct).toBeCloseTo(100, 6); // +100 % vs médiane
    expect(mod?.excessKeuro).toBeCloseTo((200 - 100) * 10, 6); // 1000 k€ en trop
    expect(200 / 100).toBeGreaterThanOrEqual(ANOMALY_RATIO);
  });
});

describe("mapping poste → levier", () => {
  const input = {
    capacityMw: 10,
    prixModuleUSDWc: 0.2,
    raccordementOuvrageKEuro: 500,
    boSCtWc: null,
  } as unknown as FinanceEngineInput;

  it("modules : scale prixModuleUSDWc au ratio médiane/courant", () => {
    const plan = buildLeverPlan("modules", input, 2000, 1000); // ratio 0,5
    expect(plan.kind).toBe("recompute");
    if (plan.kind === "recompute") {
      expect(plan.override.prixModuleUSDWc).toBeCloseTo(0.1, 6);
      expect(plan.approximate).toBe(false);
    }
  });

  it("raccordement : abaisse l'ouvrage du surcoût exact", () => {
    const plan = buildLeverPlan("raccordement", input, 800, 500); // delta 300
    expect(plan.kind).toBe("recompute");
    if (plan.kind === "recompute") {
      expect(plan.override.raccordementOuvrageKEuro).toBeCloseTo(200, 6);
    }
  });

  it("input nul → indicatif (rétrocompat, pas de plantage)", () => {
    const plan = buildLeverPlan("bos", input, 2000, 1000);
    expect(plan.kind).toBe("indicative");
  });
});

describe("stress test — perturbation d'input", () => {
  const base = {
    tariff: 80,
    debtInterestRate: 4,
    boSCtWc: 20,
    yieldMwh: 1200,
    yieldP90Mwh: 1116,
    omFixedEuroKwc: 5,
    auroraCurves: [
      { year: 2030, high: 70, central: 60, low: 50 },
      { year: 2031, high: 72, central: 62, low: 52 },
    ],
  } as unknown as FinanceEngineInput;

  it("deltas nuls → input identique (baseline == stressé)", () => {
    const out = applyStressDeltas(base, { ...ZERO_STRESS_DELTAS });
    expect(out).toEqual(base);
  });

  it("tarif additif €/MWh, taux +bips/100 pts %, CAPEX via BOS, OPEX additif", () => {
    const out = applyStressDeltas(base, {
      ...ZERO_STRESS_DELTAS,
      tariff: 1,
      debtRate: 10,
      capex: 1,
      opex: 0.5,
    });
    expect(out.tariff).toBeCloseTo(81, 6); // +1 €/MWh
    expect(out.debtInterestRate).toBeCloseTo(4.1, 6); // +10 bips = +0,10 pt de %
    expect(out.boSCtWc).toBeCloseTo(21, 6); // +1 ct/Wc (proxy CAPEX)
    expect(out.omFixedEuroKwc).toBeCloseTo(5.5, 6); // +0,5 €/kWc
  });

  it("productible multiplicatif ×(1+δ/100) sur P50 et P90", () => {
    const out = applyStressDeltas(base, { ...ZERO_STRESS_DELTAS, yield: 10 });
    expect(out.yieldMwh).toBeCloseTo(1320, 6);
    expect(out.yieldP90Mwh).toBeCloseTo(1227.6, 6);
  });

  it("prix merchant décale chaque point de courbe Aurora de +€/MWh", () => {
    const out = applyStressDeltas(base, { ...ZERO_STRESS_DELTAS, merchant: 5 });
    expect(out.auroraCurves?.[0]).toEqual({ year: 2030, high: 75, central: 65, low: 55 });
    expect(out.auroraCurves?.[1].central).toBeCloseTo(67, 6);
    // non mutant : la base est intacte
    expect(base.auroraCurves?.[0].central).toBe(60);
  });

  it("BOS nul + delta CAPEX → part du 0 (proxy forcé)", () => {
    const noBos = { ...base, boSCtWc: null } as unknown as FinanceEngineInput;
    const out = applyStressDeltas(noBos, { ...ZERO_STRESS_DELTAS, capex: 2 });
    expect(out.boSCtWc).toBeCloseTo(2, 6);
  });
});

describe("benchmark", () => {
  it("normalise les colonnes en €/MWc et lit les métriques directes", () => {
    const m = makeMetrics({ capacityMw: 10, capexEffectifKeuro: 10000, investorIrr: 12, dscr: 1.3 });
    expect(benchmarkValue(m, "capexPerMwc")).toBe(1000);
    expect(benchmarkValue(m, "investorIrr")).toBe(12);
    expect(benchmarkValue(m, "dscr")).toBe(1.3);
  });
});
