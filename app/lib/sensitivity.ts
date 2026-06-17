export type SensitivityVariable = "tariff" | "capex";

export type SensitivityScenario = {
  capex: number;
  tariff: number;
  npv: number;
  irr: number;
};

export type SensitivityRow = {
  label: string;
  variation: number;
  value: number;
  npv: number;
  irr: number;
};

const variations = [-0.1, -0.05, 0, 0.05, 0.1] as const;

function variableLabel(variable: SensitivityVariable) {
  return variable === "tariff" ? "Tarif" : "CAPEX";
}

function variationLabel(variation: number) {
  if (variation === 0) {
    return "Base";
  }

  return `${variation > 0 ? "+" : ""}${variation * 100}%`;
}

export function generateSensitivityRows(
  scenario: SensitivityScenario,
  variable: SensitivityVariable,
): SensitivityRow[] {
  const baseValue = scenario[variable];

  return variations.map((variation) => ({
    label: `${variableLabel(variable)} ${variationLabel(variation)}`,
    variation,
    value: baseValue * (1 + variation),
    npv: scenario.npv,
    irr: scenario.irr,
  }));
}
