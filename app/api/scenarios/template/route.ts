const csv = [
  [
    "Scenario",
    "CAPEX",
    "OPEX",
    "Productible",
    "Productible P90",
    "Tarif",
    "Dette",
    "Duree projet",
    "Degradation",
    "Taux actualisation",
    "Taux dette",
    "Maturite dette",
    "Inflation tarif",
    "Inflation OPEX",
    "DSCR",
    "VAN",
    "TRI",
    "LCOE",
  ],
  [
    "Base",
    "650",
    "18",
    "1450",
    "1305",
    "79",
    "70",
    "30",
    "0.3",
    "6",
    "4",
    "20",
    "0",
    "2",
    "1.15",
    "4.2",
    "8.5",
    "52",
  ],
]
  .map((row) => row.join(","))
  .join("\n");

export async function GET() {
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="modelflow-scenarios-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
