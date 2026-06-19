"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type FinancingChartDatum = {
  name: "Dette" | "CCA";
  value: number;
  color: string;
};

type CashFlowChartDatum = {
  year: number;
  revenueP50Keuro: number;
  revenueP90Keuro: number;
  opexTotalKeuro: number;
  areaBaseKeuro: number;
  areaSpreadKeuro: number;
};

type CapexChartDatum = {
  name: string;
  modulesKeuro: number;
  boSKeuro: number;
  raccordementKeuro: number;
  apportAffaireKeuro: number;
  devFeesKeuro: number;
};

type CapexComponentDatum = {
  name: string;
  valueKeuro: number;
  color: string;
  label: string;
};

type DscrChartDatum = {
  year: number;
  dscrRealized: number;
  dscrTarget: number;
  dscrGreenBase: number;
  dscrGreenDelta: number;
  dscrRedBase: number;
  dscrRedDelta: number;
};

type DebtRepaymentChartDatum = {
  year: number;
  debtOutstandingKeuro: number;
  dsraBalanceKeuro: number;
  debtServiceKeuro: number;
};

type TooltipPayloadItem = {
  name?: NameType;
  value?: ValueType;
  color?: string;
  payload?: CapexComponentDatum;
};

type ProjectFinancialChartsProps = {
  financingData: FinancingChartDatum[];
  gearingRealisePct: number | null;
  cashFlowData: CashFlowChartDatum[];
  capexData: CapexChartDatum[];
  dscrData: DscrChartDatum[];
  debtRepaymentData: DebtRepaymentChartDatum[];
};

const chartColors = {
  debt: "#2563eb",
  cca: "#16a34a",
  p50: "#2563eb",
  p90: "#f97316",
  opex: "#dc2626",
  spread: "#93c5fd",
  modules: "#0f766e",
  bos: "#7c3aed",
  raccordement: "#f59e0b",
  apport: "#0891b2",
  devFees: "#64748b",
  dscrRealized: "#2563eb",
  dscrTarget: "#dc2626",
  dscrAbove: "#16a34a",
  dscrBelow: "#dc2626",
  debtOutstanding: "#2563eb",
  dsra: "#16a34a",
  debtService: "#f97316",
};

function formatKeuro(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€`;
}

function formatExactKeuro(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} k€`;
}

function formatMeuro(value: number) {
  return `${(value / 1000).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} M€`;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatPercent(value: number | null) {
  return value !== null
    ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
    : "-";
}

function formatAxisKeuro(value: number) {
  return value >= 1000
    ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`
    : value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatAxisMeuro(value: number) {
  return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
}

function formatAxisRawKeuro(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatTooltipValue(value: unknown) {
  return formatKeuro(toNumber(value));
}

function formatRatio(value: unknown) {
  return toNumber(value).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function isTooltipPayloadItem(value: unknown): value is TooltipPayloadItem {
  return typeof value === "object" && value !== null && "value" in value;
}

function CapexTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: unknown[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const items = payload.filter(isTooltipPayloadItem);
  const item = items[0];

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item?.payload?.color ?? item?.color }}
        />
        <span className="font-semibold text-zinc-950">
          {item?.payload?.name ?? String(item?.name ?? "CAPEX")}
        </span>
      </div>
      <div className="mt-1 font-medium text-zinc-700">
        {formatExactKeuro(toNumber(item?.value))}
      </div>
    </div>
  );
}

export function ProjectFinancialCharts({
  financingData,
  gearingRealisePct,
  cashFlowData,
  capexData,
  dscrData,
  debtRepaymentData,
}: ProjectFinancialChartsProps) {
  const hasFinancingData = financingData.some((item) => item.value > 0);
  const hasCashFlowData = cashFlowData.length > 0;
  const hasDscrData = dscrData.length > 0;
  const hasDebtRepaymentData = debtRepaymentData.length > 0;
  const hasCapexData =
    capexData.length > 0 &&
    capexData.some(
      (item) =>
        item.modulesKeuro +
          item.boSKeuro +
          item.raccordementKeuro +
          item.apportAffaireKeuro +
          item.devFeesKeuro >
        0,
    );
  const capexComponentData = capexData.flatMap((item) => {
    const total =
      item.boSKeuro +
      item.modulesKeuro +
      item.raccordementKeuro +
      item.devFeesKeuro +
      item.apportAffaireKeuro;
    const withLabel = (name: string, valueKeuro: number, color: string) => {
      const share = total > 0 ? valueKeuro / total * 100 : 0;

      return {
        name,
        valueKeuro,
        color,
        label:
          valueKeuro > 0
            ? `${formatMeuro(valueKeuro)} - ${share.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })} %`
            : "",
      };
    };

    return [
      withLabel("BoS", item.boSKeuro, chartColors.bos),
      withLabel("Modules", item.modulesKeuro, chartColors.modules),
      withLabel("Raccordement", item.raccordementKeuro, chartColors.raccordement),
      withLabel("Dev fees", item.devFeesKeuro, chartColors.devFees),
      withLabel("Apport d'affaire", item.apportAffaireKeuro, chartColors.apport),
    ];
  })
    .filter((item) => item.valueKeuro > 0)
    .sort((a, b) => b.valueKeuro - a.valueKeuro);

  if (
    !hasFinancingData &&
    !hasCashFlowData &&
    !hasCapexData &&
    !hasDscrData &&
    !hasDebtRepaymentData
  ) {
    return null;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {hasFinancingData ? (
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">
            Structure de financement
          </h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financingData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="82%"
                  paddingAngle={2}
                >
                  {financingData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-zinc-950 text-lg font-semibold"
                >
                  {`Gearing : ${formatPercent(gearingRealisePct)}`}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasCapexData ? (
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">
            Decomposition du CAPEX
          </h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={capexComponentData}
                layout="vertical"
                margin={{ top: 12, right: 112, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#e4e4e7" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatAxisMeuro}
                  stroke="#71717a"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={12}
                  width={110}
                />
                <Tooltip content={<CapexTooltip />} />
                <Bar dataKey="valueKeuro" name="CAPEX" radius={[0, 4, 4, 0]}>
                  {capexComponentData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <LabelList dataKey="label" position="right" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasDscrData ? (
        <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-950">
            Profil DSCR
          </h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dscrData}
                margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="year" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} width={48} />
                <Tooltip formatter={formatRatio} />
                <Area
                  dataKey="dscrGreenBase"
                  stackId="dscr-green"
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                />
                <Area
                  dataKey="dscrGreenDelta"
                  stackId="dscr-green"
                  name="DSCR > cible"
                  stroke="transparent"
                  fill={chartColors.dscrAbove}
                  fillOpacity={0.16}
                  legendType="none"
                  tooltipType="none"
                />
                <Area
                  dataKey="dscrRedBase"
                  stackId="dscr-red"
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                />
                <Area
                  dataKey="dscrRedDelta"
                  stackId="dscr-red"
                  name="DSCR < cible"
                  stroke="transparent"
                  fill={chartColors.dscrBelow}
                  fillOpacity={0.14}
                  legendType="none"
                  tooltipType="none"
                />
                <Line
                  type="monotone"
                  dataKey="dscrRealized"
                  name="DSCR realise"
                  stroke={chartColors.dscrRealized}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="dscrTarget"
                  name="DSCR cible"
                  stroke={chartColors.dscrTarget}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasDebtRepaymentData ? (
        <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-950">
            Remboursement dette et DSRA
          </h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={debtRepaymentData}
                margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="year" stroke="#71717a" fontSize={12} />
                <YAxis
                  tickFormatter={formatAxisRawKeuro}
                  stroke="#71717a"
                  fontSize={12}
                  width={56}
                  label={{ value: "k€", angle: -90, position: "insideLeft" }}
                />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="debtOutstandingKeuro"
                  stackId="debt"
                  name="Encours dette"
                  stroke={chartColors.debtOutstanding}
                  fill={chartColors.debtOutstanding}
                  fillOpacity={0.28}
                />
                <Area
                  type="monotone"
                  dataKey="dsraBalanceKeuro"
                  stackId="debt"
                  name="Solde DSRA"
                  stroke={chartColors.dsra}
                  fill={chartColors.dsra}
                  fillOpacity={0.28}
                />
                <Line
                  type="monotone"
                  dataKey="debtServiceKeuro"
                  name="Service dette annuel"
                  stroke={chartColors.debtService}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasCashFlowData ? (
        <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-950">
            Revenus et charges sur la duree du projet
          </h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cashFlowData}
                margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="year" stroke="#71717a" fontSize={12} />
                <YAxis
                  tickFormatter={formatAxisKeuro}
                  stroke="#71717a"
                  fontSize={12}
                  width={56}
                />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <Area
                  dataKey="areaBaseKeuro"
                  stackId="spread"
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                />
                <Area
                  dataKey="areaSpreadKeuro"
                  stackId="spread"
                  name="Ecart P50/P90"
                  stroke="transparent"
                  fill={chartColors.spread}
                  fillOpacity={0.28}
                />
                <Line
                  type="monotone"
                  dataKey="revenueP50Keuro"
                  name="CA P50"
                  stroke={chartColors.p50}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="revenueP90Keuro"
                  name="CA P90"
                  stroke={chartColors.p90}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="opexTotalKeuro"
                  name="OPEX"
                  stroke={chartColors.opex}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
