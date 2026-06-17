const csv = [
  ["Scénario", "CAPEX", "OPEX", "Productible", "Tarif", "Dette", "DSCR", "VAN", "TRI", "LCOE"],
  ["Base", "650", "18", "1450", "79", "70", "1.15", "4.2", "8.5", "52"],
]
  .map((row) => row.join(","))
  .join("\n");

export async function GET() {
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="modelflow-scenarios-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
