"use client";

import { useMemo, useState } from "react";
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
import type { CalibrationStatus } from "@/app/lib/calibration";

export type DashboardRow = {
  id: string;
  name: string;
  technology: string;
  capacityMw: number;
  commissioningYear: number;
  investorIrr: number;
  /** VAN BRUTE (indicateur VAN principal, cible BP). */
  vanBruteKeuro: number;
  /** VAN NETTE (secondaire) = VAN brute − dev fees. */
  vanNetteKeuro: number;
  debtKeuro: number;
  equityCcaKeuro: number;
  capexEffectifKeuro: number;
  gearingPct: number | null;
  dscr: number | null;
  lcoe: number;
  calibration: CalibrationStatus;
  calibrationDetail: string;
};

// Palette alignée sur ProjectFinancialCharts (cohérence + accessibilité déjà validée en prod) :
// bleu = dette, vert = equity/positif, rouge = négatif, cyan/ambre = paire catégorielle CVD-safe.
const COLORS = {
  debt: "#004f9f",
  equity: "#009557",
  positive: "#009557",
  negative: "#ed7575",
  irr: "#0094cd",
  fixed: "#0094cd",
  tracker: "#f59e0b",
  axis: "#9ca3af",
  grid: "#f1f5f9",
  median: "#004f9f",
} as const;

function fmtMeuro(valueKeuro: number, digits = 1) {
  return `${(valueKeuro / 1000).toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} M€`;
}

function fmtPct(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

function fmtMw(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MW`;
}

function fmtNum(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const CALIBRATION_META: Record<CalibrationStatus, { label: string; badge: string }> = {
  green: { label: "Calé BP", badge: "badge badge-green" },
  red: { label: "Écart BP", badge: "badge badge-red" },
  gray: { label: "Cible invalide", badge: "badge badge-yellow" },
  none: { label: "Sans cible", badge: "badge badge-gray" },
};

type SortKey =
  | "name"
  | "technology"
  | "capacityMw"
  | "commissioningYear"
  | "investorIrr"
  | "vanBruteKeuro"
  | "debtKeuro"
  | "gearingPct"
  | "dscr"
  | "calibration";

type NumberTooltipEntry = { name?: string; value?: number; color?: string; dataKey?: string };

function isNumberEntry(v: unknown): v is NumberTooltipEntry {
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
  format: (value: number) => string;
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

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  const color =
    tone === "negative" ? "var(--ps-red)" : tone === "positive" ? "var(--ps-green)" : "var(--ps-blue-dark)";
  return (
    <div className="card" style={{ padding: "1.1rem 1.25rem" }}>
      <p className="meta-label">{label}</p>
      <p style={{ fontSize: "1.6rem", fontWeight: 700, color, marginTop: "0.25rem", lineHeight: 1.1 }}>
        {value}
      </p>
      {sub ? <p style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "0.2rem" }}>{sub}</p> : null}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  full,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`card ${full ? "lg:col-span-2" : ""}`}>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function PortfolioDashboard({ rows }: { rows: DashboardRow[] }) {
  const [techFilter, setTechFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("vanBruteKeuro");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const technologies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.technology))).sort(),
    [rows],
  );
  const years = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.commissioningYear)))
        .filter((y) => y > 0)
        .sort((a, b) => a - b),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (techFilter === "all" || r.technology === techFilter) &&
          (statusFilter === "all" || r.calibration === statusFilter) &&
          (yearFilter === "all" || String(r.commissioningYear) === yearFilter),
      ),
    [rows, techFilter, statusFilter, yearFilter],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name" || sortKey === "technology" || sortKey === "calibration") {
        return dir * String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return dir * ((av as number) - (bv as number));
    });
  }, [filtered, sortKey, sortDir]);

  const agg = useMemo(() => {
    const count = filtered.length;
    const totalMw = filtered.reduce((s, r) => s + r.capacityMw, 0);
    const totalCapex = filtered.reduce((s, r) => s + r.capexEffectifKeuro, 0);
    const totalDebt = filtered.reduce((s, r) => s + r.debtKeuro, 0);
    const totalEquity = filtered.reduce((s, r) => s + r.equityCcaKeuro, 0);
    const totalVanBrute = filtered.reduce((s, r) => s + r.vanBruteKeuro, 0);
    const totalVanNette = filtered.reduce((s, r) => s + r.vanNetteKeuro, 0);
    const irrs = filtered.map((r) => r.investorIrr).filter((v) => Number.isFinite(v));
    const irrMedian = median(irrs);
    const irrMin = irrs.length ? Math.min(...irrs) : null;
    const irrMax = irrs.length ? Math.max(...irrs) : null;
    const equitySum = filtered.reduce((s, r) => s + Math.max(0, r.equityCcaKeuro), 0);
    const irrWeighted =
      equitySum > 0
        ? filtered.reduce((s, r) => s + r.investorIrr * Math.max(0, r.equityCcaKeuro), 0) / equitySum
        : null;
    const green = filtered.filter((r) => r.calibration === "green").length;
    const withTarget = filtered.filter((r) => r.calibration === "green" || r.calibration === "red").length;
    return {
      count,
      totalMw,
      totalCapex,
      totalDebt,
      totalEquity,
      totalVanBrute,
      totalVanNette,
      irrMedian,
      irrMin,
      irrMax,
      irrWeighted,
      green,
      withTarget,
    };
  }, [filtered]);

  // ── Datasets graphiques ──────────────────────────────────────────────────────────
  const vanData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.vanBruteKeuro - a.vanBruteKeuro)
        .map((r) => ({ name: r.name, van: r.vanBruteKeuro })),
    [filtered],
  );

  const structureData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.capexEffectifKeuro - a.capexEffectifKeuro)
        .map((r) => ({ name: r.name, dette: r.debtKeuro, equity: r.equityCcaKeuro })),
    [filtered],
  );

  const mwByYearTech = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const r of filtered) {
      if (r.commissioningYear <= 0) continue;
      const entry = map.get(r.commissioningYear) ?? {};
      entry[r.technology] = (entry[r.technology] ?? 0) + r.capacityMw;
      map.set(r.commissioningYear, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, byTech]) => ({ year: String(year), ...byTech }));
  }, [filtered]);

  const irrHistogram = useMemo(() => {
    const buckets = [
      { label: "< 5 %", min: -Infinity, max: 5 },
      { label: "5–10 %", min: 5, max: 10 },
      { label: "10–15 %", min: 10, max: 15 },
      { label: "15–20 %", min: 15, max: 20 },
      { label: "20–25 %", min: 20, max: 25 },
      { label: "≥ 25 %", min: 25, max: Infinity },
    ];
    return buckets.map((b) => ({
      label: b.label,
      count: filtered.filter((r) => r.investorIrr >= b.min && r.investorIrr < b.max).length,
    }));
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "technology" ? "asc" : "desc");
    }
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const vanChartHeight = Math.max(240, vanData.length * 22 + 40);
  const structureChartHeight = Math.max(240, structureData.length * 22 + 40);

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
    <div className="flex flex-col gap-6">
      {/* ── Bandeau KPIs agrégés ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Projets" value={String(agg.count)} sub={`${agg.green}/${agg.withTarget} calés BP`} />
        <KpiCard label="Puissance totale" value={fmtMw(agg.totalMw)} />
        <KpiCard label="CAPEX total" value={fmtMeuro(agg.totalCapex)} />
        <KpiCard label="Dette totale" value={fmtMeuro(agg.totalDebt)} />
        <KpiCard label="Equity / CCA" value={fmtMeuro(agg.totalEquity)} />
        <KpiCard
          label="VAN brute portefeuille"
          value={fmtMeuro(agg.totalVanBrute)}
          sub={`VAN nette ${fmtMeuro(agg.totalVanNette)}`}
          tone={agg.totalVanBrute < 0 ? "negative" : "positive"}
        />
        <KpiCard
          label="TRI investisseur médian"
          value={fmtPct(agg.irrMedian)}
          sub={`min ${fmtPct(agg.irrMin)} · max ${fmtPct(agg.irrMax)} · pondéré equity ${fmtPct(agg.irrWeighted)}`}
          tone="positive"
        />
      </section>

      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "-0.75rem" }}>
        Agrégation TRI : un TRI ne s&apos;additionne pas et ne se moyenne pas naïvement. On affiche la{" "}
        <strong>médiane</strong> (robuste aux extrêmes), l&apos;étendue <strong>min–max</strong>, et une
        moyenne <strong>pondérée par l&apos;equity</strong> (chaque projet pèse à hauteur de sa mise CCA).
      </p>

      {/* ── Filtres ── */}
      <section className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <p className="meta-label" style={{ marginBottom: "0.35rem" }}>Technologie</p>
            <select style={selectStyle} value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
              <option value="all">Toutes</option>
              {technologies.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="meta-label" style={{ marginBottom: "0.35rem" }}>Statut calibration</p>
            <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="green">Calé BP</option>
              <option value="red">Écart BP</option>
              <option value="gray">Cible invalide</option>
              <option value="none">Sans cible</option>
            </select>
          </div>
          <div>
            <p className="meta-label" style={{ marginBottom: "0.35rem" }}>Année MES</p>
            <select style={selectStyle} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="all">Toutes</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          {(techFilter !== "all" || statusFilter !== "all" || yearFilter !== "all") ? (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setTechFilter("all");
                setStatusFilter("all");
                setYearFilter("all");
              }}
            >
              Réinitialiser
            </button>
          ) : null}
          <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: "auto" }}>
            {agg.count} projet{agg.count !== 1 ? "s" : ""} affiché{agg.count !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {/* ── Graphiques ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="VAN brute par projet"
          subtitle="k€, triée — vert = créatrice de valeur, rouge = destructrice"
          full
        >
          <div style={{ width: "100%", height: vanChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vanData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={COLORS.axis}
                  fontSize={11}
                  tickFormatter={(v: number) => `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}M`}
                />
                <YAxis type="category" dataKey="name" stroke={COLORS.axis} fontSize={11} width={150} />
                <Tooltip
                  cursor={{ fill: "rgba(0,79,159,0.05)" }}
                  content={(p) => <ChartTooltip {...p} format={(v) => fmtMeuro(v, 2)} />}
                />
                <ReferenceLine x={0} stroke="#9ca3af" />
                <Bar dataKey="van" name="VAN brute" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {vanData.map((d) => (
                    <Cell key={d.name} fill={d.van >= 0 ? COLORS.positive : COLORS.negative} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Structure de financement par projet"
          subtitle="k€ — dette senior + equity/CCA = CAPEX effectif (empilé, trié)"
          full
        >
          <div style={{ width: "100%", height: structureChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={structureData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={COLORS.axis}
                  fontSize={11}
                  tickFormatter={(v: number) => `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}M`}
                />
                <YAxis type="category" dataKey="name" stroke={COLORS.axis} fontSize={11} width={150} />
                <Tooltip
                  cursor={{ fill: "rgba(0,79,159,0.05)" }}
                  content={(p) => <ChartTooltip {...p} format={(v) => fmtMeuro(v, 2)} />}
                />
                <Legend />
                <Bar dataKey="dette" stackId="cap" name="Dette senior" fill={COLORS.debt} isAnimationActive={false} />
                <Bar dataKey="equity" stackId="cap" name="Equity / CCA" fill={COLORS.equity} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Puissance par année de MES et technologie" subtitle="MW installés, empilés par technologie">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mwByYearTech} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="year" stroke={COLORS.axis} fontSize={12} />
                <YAxis
                  stroke={COLORS.axis}
                  fontSize={12}
                  width={44}
                  label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,79,159,0.05)" }}
                  content={(p) => <ChartTooltip {...p} format={(v) => fmtMw(v)} />}
                />
                <Legend />
                {technologies.map((t, i) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    stackId="mw"
                    name={t}
                    fill={i === 0 ? COLORS.fixed : COLORS.tracker}
                    radius={i === technologies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Distribution des TRI investisseur" subtitle="nombre de projets par tranche de TRI equity">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={irrHistogram} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.axis} fontSize={12} />
                <YAxis stroke={COLORS.axis} fontSize={12} width={36} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(0,79,159,0.05)" }}
                  content={(p) => <ChartTooltip {...p} title="Projets" format={(v) => String(v)} />}
                />
                {agg.irrMedian !== null ? (
                  <ReferenceLine
                    x={
                      irrHistogram.find((b, i) => {
                        const bounds = [5, 10, 15, 20, 25];
                        const lower = i === 0 ? -Infinity : bounds[i - 1];
                        const upper = i < bounds.length ? bounds[i] : Infinity;
                        return (agg.irrMedian ?? 0) >= lower && (agg.irrMedian ?? 0) < upper;
                      })?.label
                    }
                    stroke={COLORS.median}
                    strokeDasharray="4 4"
                    label={{ value: "médiane", position: "top", fontSize: 11, fill: COLORS.median }}
                  />
                ) : null}
                <Bar dataKey="count" name="Projets" fill={COLORS.irr} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* ── Tableau projets ── */}
      <section className="flex flex-col gap-3">
        <h2 className="section-title">Projets ({agg.count})</h2>
        <div
          className="overflow-x-auto"
          style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", background: "white" }}
        >
          <table className="ps-table" style={{ minWidth: "1100px" }}>
            <thead>
              <tr>
                <SortableTh label="Projet" k="name" current={sortKey} arrow={sortArrow} onClick={toggleSort} align="left" />
                <SortableTh label="Techno" k="technology" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="MW" k="capacityMw" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="MES" k="commissioningYear" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="TRI inv." k="investorIrr" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="VAN brute" k="vanBruteKeuro" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <th>VAN nette</th>
                <SortableTh label="Dette" k="debtKeuro" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="Gearing" k="gearingPct" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="DSCR" k="dscr" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
                <SortableTh label="Calibration" k="calibration" current={sortKey} arrow={sortArrow} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="col-left">
                    <Link href={`/projects/${r.id}`} style={{ color: "var(--ps-blue-dark)", fontWeight: 600 }}>
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.technology}</td>
                  <td>{fmtNum(r.capacityMw, 1)}</td>
                  <td>{r.commissioningYear > 0 ? r.commissioningYear : "—"}</td>
                  <td className="val-pos">{fmtPct(r.investorIrr)}</td>
                  <td className={r.vanBruteKeuro >= 0 ? "val-pos" : "val-neg"}>{fmtMeuro(r.vanBruteKeuro, 2)}</td>
                  <td className={r.vanNetteKeuro >= 0 ? "val-pos" : "val-neg"}>{fmtMeuro(r.vanNetteKeuro, 2)}</td>
                  <td>{fmtMeuro(r.debtKeuro, 2)}</td>
                  <td>{fmtPct(r.gearingPct)}</td>
                  <td>{fmtNum(r.dscr)}</td>
                  <td>
                    <span className={CALIBRATION_META[r.calibration].badge} title={r.calibrationDetail}>
                      {CALIBRATION_META[r.calibration].label}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    Aucun projet ne correspond aux filtres.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SortableTh({
  label,
  k,
  current,
  arrow,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  arrow: (k: SortKey) => string;
  onClick: (k: SortKey) => void;
  align?: "left";
}) {
  return (
    <th
      className={align === "left" ? "col-left" : undefined}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => onClick(k)}
      title="Trier"
    >
      {label}
      <span style={{ color: current === k ? "var(--ps-blue-dark)" : "#cbd5e1" }}>{arrow(k) || " ↕"}</span>
    </th>
  );
}
