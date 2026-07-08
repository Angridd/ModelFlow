"use client";

import { useCountUp } from "@/app/hooks/useCountUp";

type AnimatedKpiCard = {
  label: string;
  value: number | null;
  suffix?: string;
  scale?: number;
  decimals?: number;
  tone?: "default" | "positive" | "negative";
};

type AnimatedKpiCardsProps = {
  cards: AnimatedKpiCard[];
};

function formatAnimatedNumber(value: number, decimals: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function displayLabel(label: string) {
  // Indicateurs éco additionnels (calés BP) : libellés passés tels quels, AVANT les règles génériques
  // VAN/TRI ci-dessous (qui réécriraient "VAN brute/MWc" et "TRI projet brut").
  if (label.startsWith("VAN brute/MWc")) return "VAN brute/MWc";
  if (label.startsWith("TRI projet")) return label;
  if (label.startsWith("VAN")) return label.includes("Meilleure") ? "Meilleure VAN" : "VAN nette reference";
  if (label.startsWith("TRI")) return label.includes("Meilleur ") ? "Meilleur TRI" : "TRI investisseur";
  if (label.startsWith("DSCR")) return label.includes("minimum") ? "DSCR minimum" : "DSCR reference";
  if (label.startsWith("LCOE")) return label.includes("minimum") ? "LCOE minimum" : "LCOE reference";

  return label;
}

function displaySuffix(suffix: string | undefined) {
  if (!suffix) return "";
  if (suffix.includes("MWh")) return " EUR/MWh";
  if (suffix.includes("MWc")) return " kEUR/MWc"; // AVANT le test générique "M" (MWc contient "M")
  if (suffix.includes("M")) return " MEUR";

  return suffix;
}

function AnimatedKpiValue({ card }: { card: AnimatedKpiCard }) {
  const decimals = card.decimals ?? 2;
  const scale = card.scale ?? 1;
  const target = card.value !== null ? card.value / scale : 0;
  const animatedValue = useCountUp(target, 1200, decimals);

  if (card.value === null) {
    return <span className="kpi-value">-</span>;
  }

  return (
    <span className={`kpi-value kpi-value-animated ${card.tone ?? ""}`}>
      {formatAnimatedNumber(animatedValue, decimals)}
      {displaySuffix(card.suffix)}
    </span>
  );
}

export function AnimatedKpiCards({ cards }: AnimatedKpiCardsProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      style={{ marginTop: "-3rem", position: "relative", zIndex: 10 }}
    >
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={`kpi-card fade-up delay-${Math.min(index + 1, 6)}`}
        >
          <span className="kpi-label">{displayLabel(card.label)}</span>
          <AnimatedKpiValue card={card} />
        </div>
      ))}
    </div>
  );
}
