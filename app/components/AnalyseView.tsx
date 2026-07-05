"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BENCHMARK_COLUMNS,
  benchmarkValue,
  classifyHealth,
  computePosteStats,
  HEALTH_META,
  perMwc,
  quartileRank,
  ALL_POSTES,
  CAPEX_POSTES,
  OPEX_POSTES,
  IRR_CRITICAL_PCT,
  STRESS_DRIVERS,
  ZERO_STRESS_DELTAS,
  type Anomaly,
  type BenchmarkColumnKey,
  type Health,
  type LeverResult,
  type PortfolioStressResult,
  type ProjectAnalysis,
  type StressDeltas,
  type StressDriverKey,
  type TornadoRow,
} from "@/app/lib/analysis";
import { computePortfolioStress, computeTornado } from "@/app/analyse/actions";

// Palette réutilisée du Dashboard (déjà validée CVD-safe en prod).
const COLORS = {
  debt: "#004f9f",
  positive: "#009557",
  negative: "#ed7575",
  irr: "#0094cd",
  amber: "#f59e0b",
  axis: "#9ca3af",
  grid: "#f1f5f9",
} as const;

// Rampe divergente PÂLE (mauvais → bon), texte foncé lisible. Index par « bonté » 1..4 (4 = meilleur).
const QUARTILE_FILL: Record<1 | 2 | 3 | 4, string> = {
  1: "#f4b7b0", // pire quartile
  2: "#fde0da",
  3: "#dff2e8",
  4: "#b3e0c8", // meilleur quartile
};

function goodnessRank(value: number, values: number[], goodDirection: "high" | "low"): 1 | 2 | 3 | 4 {
  const rank = quartileRank(value, values);
  return goodDirection === "high" ? rank : ((5 - rank) as 1 | 2 | 3 | 4);
}

// ── formatters ─────────────────────────────────────────────────────────────────────────
function fmtNum(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPct(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${fmtNum(v, digits)} %`;
}
function fmtKeuro(v: number | null, digits = 0): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${fmtNum(v, digits)} k€`;
}
function fmtSigned(v: number | null, digits = 1, unit = ""): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${fmtNum(v, digits)}${unit}`;
}

type NumberEntry = { name?: string; value?: number; color?: string; dataKey?: string };
function isNumberEntry(v: unknown): v is NumberEntry {
  return typeof v === "object" && v !== null && "value" in v;
}
function ChartTooltip({
  active,
  payload,
  label,
  title,
  format,
}: {
  active?: boolean;
  payload?: readonly unknown[];
  label?: string | number;
  title?: string;
  format: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter(isNumberEntry).filter((it) => typeof it.value === "number");
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{title ?? String(label ?? "")}</div>
      <div className="chart-tooltip-items">
        {items.map((it, i) => (
          <div key={`${String(it.dataKey ?? it.name)}-${i}`} className="chart-tooltip-row">
            <span className="chart-tooltip-dot" style={{ background: it.color ?? COLORS.irr }} />
            <span>{String(it.name ?? "")}</span>
            <strong>{format(it.value ?? 0)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthBadge({ health }: { health: Health }) {
  const m = HEALTH_META[health];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.12rem 0.5rem",
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 600,
        background: `${m.color}22`,
        color: "#0d1117",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>{m.emoji}</span>
      {m.label}
    </span>
  );
}

// ── Onglets ─────────────────────────────────────────────────────────────────────────────
type TabKey = "pipeline" | "costs" | "levers" | "benchmark" | "sensitivity" | "stress";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pipeline", label: "📅 Pipeline MES" },
  { key: "costs", label: "🔍 Coûts & anomalies" },
  { key: "levers", label: "💡 Leviers chiffrés" },
  { key: "benchmark", label: "📊 Benchmark" },
  { key: "sensitivity", label: "🎚️ Sensibilité" },
  { key: "stress", label: "🌍 Stress test" },
];

export function AnalyseView({
  projects,
  anomalies,
  levers,
}: {
  projects: ProjectAnalysis[];
  anomalies: Anomaly[];
  levers: LeverResult[];
}) {
  const [tab, setTab] = useState<TabKey>("pipeline");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Outils d'analyse"
        style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 8,
              border: "1px solid",
              borderColor: tab === t.key ? "var(--ps-blue-dark)" : "#e5e7eb",
              background: tab === t.key ? "var(--ps-blue-dark)" : "white",
              color: tab === t.key ? "white" : "#374151",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pipeline" && <PipelineTab projects={projects} />}
      {tab === "costs" && <CostsTab projects={projects} anomalies={anomalies} />}
      {tab === "levers" && <LeversTab levers={levers} />}
      {tab === "benchmark" && <BenchmarkTab projects={projects} />}
      {tab === "sensitivity" && <SensitivityTab projects={projects} />}
      {tab === "stress" && <StressTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 1. PIPELINE MES
// ══════════════════════════════════════════════════════════════════════════════════════
function PipelineTab({ projects }: { projects: ProjectAnalysis[] }) {
  const rows = useMemo(
    () =>
      [...projects]
        .map((p) => ({ ...p.metrics, health: classifyHealth(p.metrics) }))
        .sort((a, b) => a.commissioningYear - b.commissioningYear || a.name.localeCompare(b.name)),
    [projects],
  );

  const friseData = useMemo(() => {
    const map = new Map<number, { critical: number; tense: number; healthy: number }>();
    for (const r of rows) {
      if (r.commissioningYear <= 0) continue;
      const e = map.get(r.commissioningYear) ?? { critical: 0, tense: 0, healthy: 0 };
      e[r.health] += r.capacityMw;
      map.set(r.commissioningYear, e);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({ year: String(year), ...v }));
  }, [rows]);

  const counts = useMemo(
    () => ({
      critical: rows.filter((r) => r.health === "critical").length,
      tense: rows.filter((r) => r.health === "tense").length,
      healthy: rows.filter((r) => r.health === "healthy").length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {(["critical", "tense", "healthy"] as const).map((h) => (
          <div key={h} className="card" style={{ padding: "1rem 1.15rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }} aria-hidden>{HEALTH_META[h].emoji}</span>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1, color: "#0d1117" }}>{counts[h]}</p>
              <p className="meta-label">{HEALTH_META[h].label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="section-title">Frise de mise en service</h2>
        <p className="section-subtitle">MW mis en service par année, empilés par santé economics.</p>
        <div style={{ width: "100%", height: 300, marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={friseData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="year" stroke={COLORS.axis} fontSize={12} />
              <YAxis stroke={COLORS.axis} fontSize={12} width={44} label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
              <Tooltip cursor={{ fill: "rgba(0,79,159,0.05)" }} content={(p) => <ChartTooltip {...p} format={(v) => `${fmtNum(v, 1)} MW`} />} />
              <Legend />
              <Bar dataKey="critical" stackId="mw" name="🔴 Critique" fill={HEALTH_META.critical.color} isAnimationActive={false} />
              <Bar dataKey="tense" stackId="mw" name="🟠 Tendu" fill={HEALTH_META.tense.color} isAnimationActive={false} />
              <Bar dataKey="healthy" stackId="mw" name="🟢 Sain" fill={HEALTH_META.healthy.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}>
        <table className="ps-table" style={{ minWidth: "1000px" }}>
          <thead>
            <tr>
              <th className="col-left">Projet</th>
              <th>MES</th>
              <th>Région</th>
              <th>Techno</th>
              <th>MW</th>
              <th>TRI inv.</th>
              <th>VAN nette</th>
              <th>Dette</th>
              <th>Gearing</th>
              <th>DSCR</th>
              <th>Santé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="col-left">
                  <Link href={`/projects/${r.id}`} style={{ color: "var(--ps-blue-dark)", fontWeight: 600 }}>{r.name}</Link>
                </td>
                <td>{r.commissioningYear > 0 ? r.commissioningYear : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.region}</td>
                <td>{r.technology}</td>
                <td>{fmtNum(r.capacityMw, 1)}</td>
                <td className={r.investorIrr < 7.5 ? "val-neg" : "val-pos"}>{fmtPct(r.investorIrr)}</td>
                <td className={r.npv >= 0 ? "val-pos" : "val-neg"}>{fmtKeuro(r.npv)}</td>
                <td>{fmtKeuro(r.debtKeuro)}</td>
                <td>{fmtPct(r.gearingPct)}</td>
                <td>{fmtNum(r.dscr, 2)}</td>
                <td><HealthBadge health={r.health} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 2. COÛTS & ANOMALIES
// ══════════════════════════════════════════════════════════════════════════════════════
function CostsTab({ projects, anomalies }: { projects: ProjectAnalysis[]; anomalies: Anomaly[] }) {
  const stats = useMemo(() => computePosteStats(projects), [projects]);
  const [category, setCategory] = useState<"capex" | "opex">("capex");
  const postes = category === "capex" ? CAPEX_POSTES : OPEX_POSTES;

  // Heatmap : par poste, distribution des valeurs €/MWc pour colorer par quartile (coût haut = rouge).
  const posteValues = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const poste of ALL_POSTES) {
      map.set(poste.key, (stats.get(poste.key)?.values ?? []));
    }
    return map;
  }, [stats]);

  const heatRows = useMemo(
    () =>
      [...projects]
        .map((p) => ({
          id: p.metrics.id,
          name: p.metrics.name,
          mw: p.metrics.capacityMw,
          cells: postes.map((poste) => {
            const bucket: Record<string, number> = category === "capex" ? p.postes.capex : p.postes.opex;
            const keuro = bucket[poste.key] ?? 0;
            return { key: poste.key, value: perMwc(keuro, p.metrics.capacityMw) };
          }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, postes, category],
  );

  const topAnomalies = anomalies.slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <h2 className="section-title">Top anomalies de coût du portefeuille</h2>
        <p className="section-subtitle">
          Poste &gt; médiane portefeuille × 1,5 (soit +50 %). Écart chiffré en k€ vs médiane. 🔺 = au-delà de la barrière IQR (anomalie forte).
        </p>
        {topAnomalies.length === 0 ? (
          <p style={{ marginTop: "1rem", color: "#6b7280" }}>Aucune anomalie détectée.</p>
        ) : (
          <ul style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {topAnomalies.map((a) => (
              <li
                key={`${a.projectId}-${a.poste.key}`}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.8rem", borderRadius: 8, background: "#f8fafc", flexWrap: "wrap" }}
              >
                {a.severe ? <span aria-label="anomalie forte">🔺</span> : <span aria-hidden style={{ color: COLORS.amber }}>▲</span>}
                <strong style={{ color: "var(--ps-blue-dark)" }}>{a.projectName}</strong>
                <span>· {a.poste.label}</span>
                <span style={{ color: COLORS.negative, fontWeight: 700 }}>{fmtSigned(a.deviationPct, 0, " %")} vs médiane</span>
                <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.82rem" }}>
                  {fmtNum(a.perMwc, 1)} vs {fmtNum(a.medianPerMwc, 1)} k€/MWc · +{fmtKeuro(a.excessKeuro)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 className="section-title">Heatmap coûts par poste (k€/MWc)</h2>
            <p className="section-subtitle">Couleur = quartile portefeuille du poste — rouge pâle = coûteux, vert pâle = économe.</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
            {(["capex", "opex"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={category === c ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                {c === "capex" ? "CAPEX" : "OPEX an-1"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto" style={{ marginTop: "1rem" }}>
          <table className="ps-table" style={{ minWidth: `${180 + postes.length * 90}px` }}>
            <thead>
              <tr>
                <th className="col-left">Projet</th>
                {postes.map((poste) => (
                  <th key={poste.key} style={{ whiteSpace: "nowrap" }}>{poste.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatRows.map((row) => (
                <tr key={row.id}>
                  <td className="col-left" style={{ whiteSpace: "nowrap" }}>{row.name}</td>
                  {row.cells.map((cell) => {
                    const vals = posteValues.get(cell.key) ?? [];
                    const rank = cell.value > 0 && vals.length > 1 ? goodnessRank(cell.value, vals, "low") : null;
                    return (
                      <td
                        key={cell.key}
                        style={{
                          background: rank ? QUARTILE_FILL[rank] : undefined,
                          color: "#0d1117",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                        title={`${row.name} · ${cell.value.toFixed(1)} k€/MWc`}
                      >
                        {cell.value > 0 ? fmtNum(cell.value, cell.value >= 100 ? 0 : 1) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-left" style={{ fontWeight: 700 }}>Médiane portefeuille</td>
                {postes.map((poste) => (
                  <td key={poste.key} style={{ textAlign: "right", fontWeight: 700, color: "var(--ps-blue-dark)" }}>
                    {fmtNum(stats.get(poste.key)?.median ?? 0, (stats.get(poste.key)?.median ?? 0) >= 100 ? 0 : 1)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 3. LEVIERS CHIFFRÉS
// ══════════════════════════════════════════════════════════════════════════════════════
function LeversTab({ levers }: { levers: LeverResult[] }) {
  const chartData = useMemo(
    () =>
      levers
        .filter((l) => l.deltaVanKeuro !== null)
        .slice(0, 12)
        .map((l) => ({ label: `${l.projectName} · ${l.poste.label}`, van: l.deltaVanKeuro ?? 0 })),
    [levers],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <h2 className="section-title">Gain VAN en ramenant le poste à la médiane</h2>
        <p className="section-subtitle">
          Top 12 leviers · ΔVAN (k€) recalculée par le moteur en abaissant l'input du poste jusqu'à la médiane portefeuille.
        </p>
        {chartData.length === 0 ? (
          <p style={{ marginTop: "1rem", color: "#6b7280" }}>Aucun levier chiffrable (recalcul moteur).</p>
        ) : (
          <div style={{ width: "100%", height: Math.max(240, chartData.length * 30 + 40), marginTop: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis type="number" stroke={COLORS.axis} fontSize={11} tickFormatter={(v: number) => `${fmtNum(v, 0)}`} />
                <YAxis type="category" dataKey="label" stroke={COLORS.axis} fontSize={11} width={220} />
                <Tooltip cursor={{ fill: "rgba(0,79,159,0.05)" }} content={(p) => <ChartTooltip {...p} title="ΔVAN" format={(v) => fmtKeuro(v)} />} />
                <ReferenceLine x={0} stroke="#9ca3af" />
                <Bar dataKey="van" name="ΔVAN" fill={COLORS.positive} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}>
        <table className="ps-table" style={{ minWidth: "900px" }}>
          <thead>
            <tr>
              <th className="col-left">Projet</th>
              <th className="col-left">Poste</th>
              <th>Écart</th>
              <th>Δcoût (à la médiane)</th>
              <th>ΔVAN</th>
              <th>ΔTRI</th>
              <th className="col-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {levers.map((l) => (
              <tr key={`${l.projectId}-${l.poste.key}`}>
                <td className="col-left" style={{ fontWeight: 600, color: "var(--ps-blue-dark)" }}>{l.projectName}</td>
                <td className="col-left">{l.poste.label}</td>
                <td className="val-neg">{fmtSigned(l.deviationPct, 0, " %")}</td>
                <td className="val-pos">{fmtKeuro(l.savingKeuro)}</td>
                <td className={l.deltaVanKeuro !== null && l.deltaVanKeuro >= 0 ? "val-pos" : ""}>
                  {l.deltaVanKeuro !== null ? fmtSigned(l.deltaVanKeuro, 0, " k€") : "—"}
                </td>
                <td className={l.deltaIrrPp !== null && l.deltaIrrPp >= 0 ? "val-pos" : ""}>
                  {l.deltaIrrPp !== null ? `${fmtSigned(l.deltaIrrPp, 2)} pp` : "—"}
                </td>
                <td className="col-left" style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                  {l.indicative ? "indicatif (Δcoût seul)" : l.approximate ? "impact approx. (multi-inputs)" : "recalcul moteur exact"}
                </td>
              </tr>
            ))}
            {levers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>Aucun levier.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 4. BENCHMARK
// ══════════════════════════════════════════════════════════════════════════════════════
function BenchmarkTab({ projects }: { projects: ProjectAnalysis[] }) {
  const [sortKey, setSortKey] = useState<BenchmarkColumnKey>("vanPerMwc");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const columnValues = useMemo(() => {
    const map = new Map<BenchmarkColumnKey, number[]>();
    for (const col of BENCHMARK_COLUMNS) {
      const vals = projects
        .map((p) => benchmarkValue(p.metrics, col.key))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      map.set(col.key, vals);
    }
    return map;
  }, [projects]);

  const rows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...projects].sort((a, b) => {
      const av = benchmarkValue(a.metrics, sortKey);
      const bv = benchmarkValue(b.metrics, sortKey);
      return dir * ((av ?? -Infinity) - (bv ?? -Infinity));
    });
  }, [projects, sortKey, sortDir]);

  const toggle = (k: BenchmarkColumnKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return (
    <div className="card">
      <h2 className="section-title">Benchmark portefeuille (normalisé €/MWc)</h2>
      <p className="section-subtitle">
        Couleur = quartile par colonne (vert pâle = favorable, rouge pâle = défavorable). Cliquer un en-tête pour trier.
      </p>
      <div className="overflow-x-auto" style={{ marginTop: "1rem" }}>
        <table className="ps-table" style={{ minWidth: "980px" }}>
          <thead>
            <tr>
              <th className="col-left">Projet</th>
              {BENCHMARK_COLUMNS.map((col) => (
                <th key={col.key} style={{ cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => toggle(col.key)} title="Trier">
                  {col.label}
                  <div style={{ fontSize: "0.62rem", fontWeight: 400, opacity: 0.75 }}>{col.unit}</div>
                  <span style={{ color: sortKey === col.key ? "white" : "#9ca3af" }}>
                    {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : " ↕"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.metrics.id}>
                <td className="col-left" style={{ whiteSpace: "nowrap" }}>
                  <Link href={`/projects/${p.metrics.id}`} style={{ color: "var(--ps-blue-dark)", fontWeight: 600 }}>{p.metrics.name}</Link>
                </td>
                {BENCHMARK_COLUMNS.map((col) => {
                  const v = benchmarkValue(p.metrics, col.key);
                  const vals = columnValues.get(col.key) ?? [];
                  const rank = v !== null && vals.length > 1 ? goodnessRank(v, vals, col.goodDirection) : null;
                  return (
                    <td
                      key={col.key}
                      style={{ background: rank ? QUARTILE_FILL[rank] : undefined, color: "#0d1117", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmtNum(v, col.digits)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 5. SENSIBILITÉ (TORNADO)
// ══════════════════════════════════════════════════════════════════════════════════════
function SensitivityTab({ projects }: { projects: ProjectAnalysis[] }) {
  const sorted = useMemo(
    () => [...projects].sort((a, b) => a.metrics.name.localeCompare(b.metrics.name)),
    [projects],
  );
  const [projectId, setProjectId] = useState<string>(sorted[0]?.metrics.id ?? "");
  const [metric, setMetric] = useState<"irr" | "npv">("irr");
  const [data, setData] = useState<TornadoRow[]>([]);
  const [loadedFor, setLoadedFor] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!projectId) return;
    startTransition(async () => {
      const rows = await computeTornado(projectId);
      setData(rows);
      setLoadedFor(projectId);
    });
  };

  const chartData = useMemo(() => {
    return data.map((r) => {
      const base = metric === "irr" ? r.baseIrr : r.baseNpv;
      const low = (metric === "irr" ? r.lowIrr : r.lowNpv) - base;
      const high = (metric === "irr" ? r.highIrr : r.highNpv) - base;
      return { label: r.label, low, high };
    });
  }, [data, metric]);

  const unit = metric === "irr" ? " pp" : " k€";
  const fmtDelta = (v: number) => fmtSigned(v, metric === "irr" ? 2 : 0, unit);
  const selectStyle: React.CSSProperties = {
    height: "2.5rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 0.75rem",
    fontSize: "0.85rem",
    background: "white",
    color: "#0d1117",
  };

  return (
    <div className="card">
      <h2 className="section-title">Tornado de sensibilité (±10 %)</h2>
      <p className="section-subtitle">
        Impact d'une variation ±10 % de chaque hypothèse sur le {metric === "irr" ? "TRI investisseur" : "VAN nette"} — recalcul moteur à la demande.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "1rem" }}>
        <div>
          <p className="meta-label" style={{ marginBottom: "0.35rem" }}>Projet</p>
          <select style={selectStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {sorted.map((p) => (
              <option key={p.metrics.id} value={p.metrics.id}>{p.metrics.name}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="meta-label" style={{ marginBottom: "0.35rem" }}>Métrique</p>
          <select style={selectStyle} value={metric} onChange={(e) => setMetric(e.target.value as "irr" | "npv")}>
            <option value="irr">TRI investisseur</option>
            <option value="npv">VAN nette</option>
          </select>
        </div>
        <button className="btn-primary" onClick={run} disabled={pending || !projectId}>
          {pending ? "Calcul…" : "Calculer le tornado"}
        </button>
      </div>

      {chartData.length === 0 ? (
        <p style={{ marginTop: "1.5rem", color: "#6b7280" }}>
          Sélectionner un projet puis « Calculer le tornado » (recalcul à la demande, pour éviter des centaines de calculs au chargement).
        </p>
      ) : (
        <div style={{ marginTop: "1.25rem" }}>
          <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Projet : <strong>{sorted.find((p) => p.metrics.id === loadedFor)?.metrics.name ?? ""}</strong> · barres = écart vs cas de base.
          </p>
          <div style={{ width: "100%", height: Math.max(220, chartData.length * 46 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barGap={2}>
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis type="number" stroke={COLORS.axis} fontSize={11} tickFormatter={(v: number) => fmtSigned(v, metric === "irr" ? 1 : 0)} />
                <YAxis type="category" dataKey="label" stroke={COLORS.axis} fontSize={11} width={170} />
                <Tooltip cursor={{ fill: "rgba(0,79,159,0.05)" }} content={(p) => <ChartTooltip {...p} format={fmtDelta} />} />
                <ReferenceLine x={0} stroke="#6b7280" />
                <Legend />
                <Bar dataKey="low" name="Hypothèse −10 %" fill={COLORS.debt} isAnimationActive={false} />
                <Bar dataKey="high" name="Hypothèse +10 %" fill={COLORS.amber} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 6. STRESS TEST PORTEFEUILLE (choc uniforme sur les 25 projets)
// ══════════════════════════════════════════════════════════════════════════════════════
/** Bloc « avant → après » d'un KPI agrégé. */
function StressKpi({
  label,
  before,
  after,
  delta,
  emphasize,
}: {
  label: string;
  before: string;
  after: string;
  delta?: { text: string; positive: boolean } | null;
  emphasize?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "0.9rem 1.1rem" }}>
      <p className="meta-label" style={{ marginBottom: "0.4rem" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ color: "#6b7280", fontSize: "0.95rem" }}>{before}</span>
        <span aria-hidden style={{ color: "#9ca3af" }}>→</span>
        <span style={{ fontSize: emphasize ? "1.35rem" : "1.15rem", fontWeight: 700, color: "#0d1117" }}>{after}</span>
      </div>
      {delta ? (
        <p style={{ marginTop: "0.3rem", fontSize: "0.82rem", fontWeight: 600, color: delta.positive ? COLORS.positive : COLORS.negative }}>
          {delta.text}
        </p>
      ) : null}
    </div>
  );
}

function StressTab() {
  const [deltas, setDeltas] = useState<StressDeltas>({ ...ZERO_STRESS_DELTAS });
  const [result, setResult] = useState<PortfolioStressResult | null>(null);
  const [pending, startTransition] = useTransition();

  const setDriver = (key: StressDriverKey, raw: string) => {
    const v = raw.trim() === "" || raw.trim() === "-" ? 0 : Number(raw);
    setDeltas((d) => ({ ...d, [key]: Number.isFinite(v) ? v : 0 }));
  };

  const apply = () => {
    startTransition(async () => {
      const r = await computePortfolioStress(deltas);
      setResult(r);
    });
  };

  const reset = () => {
    setDeltas({ ...ZERO_STRESS_DELTAS });
    setResult(null);
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return [...result.rows]
      .map((r) => ({ label: r.name, van: r.stressNpv - r.baseNpv }))
      .sort((a, b) => a.van - b.van)
      .slice(0, 15);
  }, [result]);

  const inputStyle: React.CSSProperties = {
    height: "2.4rem",
    width: "6.5rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 0.6rem",
    fontSize: "0.9rem",
    background: "white",
    color: "#0d1117",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <h2 className="section-title">Stress test portefeuille — choc uniforme</h2>
        <p className="section-subtitle">
          Applique le MÊME écart absolu sur les {result?.aggregate.projectCount ?? 25} projets BP réel à la fois, puis
          recalcule le moteur (perturbation des inputs uniquement). Le driver « CAPEX ±ct/Wc » est un proxy fidèle via le
          BOS (s'ajoute au CAPEX, à l'amortissement et à la base des frais de financement).
        </p>

        <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", marginTop: "1.1rem" }}>
          {STRESS_DRIVERS.map((d) => (
            <div key={d.key}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#0d1117", marginBottom: "0.3rem" }}>
                {d.label} <span style={{ color: "#6b7280", fontWeight: 400 }}>(± {d.unit})</span>
              </label>
              <input
                type="number"
                step={d.step}
                value={deltas[d.key]}
                onChange={(e) => setDriver(d.key, e.target.value)}
                style={inputStyle}
                aria-label={`${d.label} en ${d.unit}`}
              />
              <p style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: "0.25rem", lineHeight: 1.25 }}>{d.hint}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.15rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={apply} disabled={pending}>
            {pending ? "Calcul…" : "Appliquer le choc"}
          </button>
          <button className="btn-secondary" onClick={reset} disabled={pending}>Réinitialiser</button>
        </div>
      </div>

      {result === null ? (
        <p style={{ color: "#6b7280" }}>
          Saisir un ou plusieurs deltas puis « Appliquer le choc » (≈ {25} recalculs, à la demande).
        </p>
      ) : (
        (() => {
          const agg = result.aggregate;
          const deltaVanTotal = agg.stressNpvTotal - agg.baseNpvTotal;
          return (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StressKpi
              label="VAN nette portefeuille"
              before={fmtKeuro(agg.baseNpvTotal)}
              after={fmtKeuro(agg.stressNpvTotal)}
              delta={{ text: `${fmtSigned(deltaVanTotal, 0, " k€")} (ΔVAN totale)`, positive: deltaVanTotal >= 0 }}
              emphasize
            />
            <StressKpi
              label="TRI investisseur médian"
              before={fmtPct(agg.baseIrrMedian)}
              after={fmtPct(agg.stressIrrMedian)}
              delta={
                agg.baseIrrMedian !== null && agg.stressIrrMedian !== null
                  ? { text: `${fmtSigned(agg.stressIrrMedian - agg.baseIrrMedian, 2)} pp`, positive: agg.stressIrrMedian - agg.baseIrrMedian >= 0 }
                  : null
              }
            />
            <StressKpi
              label={`Projets ≥ ${IRR_CRITICAL_PCT} %`}
              before={`${agg.baseAboveThreshold}/${agg.projectCount}`}
              after={`${agg.stressAboveThreshold}/${agg.projectCount}`}
              delta={{ text: `${fmtSigned(agg.stressAboveThreshold - agg.baseAboveThreshold, 0)} projet(s)`, positive: agg.stressAboveThreshold - agg.baseAboveThreshold >= 0 }}
              emphasize
            />
            <StressKpi
              label="Dette totale"
              before={fmtKeuro(agg.baseDebtTotal)}
              after={fmtKeuro(agg.stressDebtTotal)}
              delta={{ text: fmtSigned(agg.stressDebtTotal - agg.baseDebtTotal, 0, " k€"), positive: agg.stressDebtTotal - agg.baseDebtTotal >= 0 }}
            />
            <StressKpi
              label="Equity totale (CCA)"
              before={fmtKeuro(agg.baseEquityTotal)}
              after={fmtKeuro(agg.stressEquityTotal)}
              delta={{ text: fmtSigned(agg.stressEquityTotal - agg.baseEquityTotal, 0, " k€"), positive: agg.stressEquityTotal - agg.baseEquityTotal <= 0 }}
            />
          </div>

          <div className="card">
            <h2 className="section-title">ΔVAN par projet (top 15 mouvements)</h2>
            <p className="section-subtitle">VAN stressée − VAN de base, k€. Rouge = dégradation, vert = amélioration.</p>
            {chartData.length === 0 ? (
              <p style={{ marginTop: "1rem", color: "#6b7280" }}>Aucun mouvement.</p>
            ) : (
              <div style={{ width: "100%", height: Math.max(240, chartData.length * 28 + 40), marginTop: "1rem" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                    <XAxis type="number" stroke={COLORS.axis} fontSize={11} tickFormatter={(v: number) => fmtSigned(v, 0)} />
                    <YAxis type="category" dataKey="label" stroke={COLORS.axis} fontSize={11} width={150} />
                    <Tooltip cursor={{ fill: "rgba(0,79,159,0.05)" }} content={(p) => <ChartTooltip {...p} title="ΔVAN" format={(v) => fmtSigned(v, 0, " k€")} />} />
                    <ReferenceLine x={0} stroke="#6b7280" />
                    <Bar dataKey="van" name="ΔVAN" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {chartData.map((d) => (
                        <Cell key={d.label} fill={d.van >= 0 ? COLORS.positive : COLORS.negative} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}>
            <table className="ps-table" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th className="col-left">Projet</th>
                  <th>MW</th>
                  <th>TRI inv. (av. → ap.)</th>
                  <th>ΔTRI</th>
                  <th>VAN (av. → ap.)</th>
                  <th>ΔVAN</th>
                  <th>Santé (av. → ap.)</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => {
                  const dIrr = r.stressIrr - r.baseIrr;
                  const dVan = r.stressNpv - r.baseNpv;
                  return (
                    <tr key={r.id}>
                      <td className="col-left">
                        <Link href={`/projects/${r.id}`} style={{ color: "var(--ps-blue-dark)", fontWeight: 600 }}>{r.name}</Link>
                      </td>
                      <td>{fmtNum(r.capacityMw, 1)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: "#6b7280" }}>{fmtPct(r.baseIrr)}</span>
                        {" → "}
                        <strong className={r.stressIrr < IRR_CRITICAL_PCT ? "val-neg" : "val-pos"}>{fmtPct(r.stressIrr)}</strong>
                      </td>
                      <td className={dIrr >= 0 ? "val-pos" : "val-neg"}>{fmtSigned(dIrr, 2)} pp</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: "#6b7280" }}>{fmtKeuro(r.baseNpv)}</span>
                        {" → "}
                        <strong className={r.stressNpv >= 0 ? "val-pos" : "val-neg"}>{fmtKeuro(r.stressNpv)}</strong>
                      </td>
                      <td className={dVan >= 0 ? "val-pos" : "val-neg"}>{fmtSigned(dVan, 0, " k€")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <HealthBadge health={r.baseHealth} />
                        {r.baseHealth !== r.stressHealth ? (
                          <>
                            <span aria-hidden style={{ margin: "0 0.3rem", color: "#9ca3af" }}>→</span>
                            <HealthBadge health={r.stressHealth} />
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
          );
        })()
      )}
    </div>
  );
}
