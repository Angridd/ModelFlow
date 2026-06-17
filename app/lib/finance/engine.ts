const PROJECT_YEARS = 30;
const ANNUAL_DEGRADATION_RATE = 0.003;
const DISCOUNT_RATE = 0.06;
const IRR_MIN_RATE = -0.9999;
const IRR_MAX_RATE = 10;

export type FinanceEngineInput = {
  capacityMw: number;
  capex: number;
  opex: number;
  yieldMwh: number;
  tariff: number;
};

export type FinanceEngineResult = {
  npv: number;
  irr: number;
  lcoe: number;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function discounted(value: number, year: number, rate: number) {
  return value / (1 + rate) ** year;
}

function calculateNpvAtRate(initialInvestment: number, cashFlows: number[], rate: number) {
  return cashFlows.reduce(
    (total, cashFlow, index) => total + discounted(cashFlow, index + 1, rate),
    -initialInvestment,
  );
}

function calculateIrr(initialInvestment: number, cashFlows: number[]) {
  let low = IRR_MIN_RATE;
  let high = 1;
  let lowNpv = calculateNpvAtRate(initialInvestment, cashFlows, low);
  let highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);

  while (highNpv > 0 && high < IRR_MAX_RATE) {
    high *= 2;
    highNpv = calculateNpvAtRate(initialInvestment, cashFlows, high);
  }

  if (lowNpv * highNpv > 0) {
    return 0;
  }

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const midNpv = calculateNpvAtRate(initialInvestment, cashFlows, mid);

    if (Math.abs(midNpv) < 0.000001) {
      return mid;
    }

    if (lowNpv * midNpv <= 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }

  return (low + high) / 2;
}

export function calculateScenarioMetrics(input: FinanceEngineInput): FinanceEngineResult {
  const initialInvestment = input.capex * input.capacityMw;
  const annualOpex = input.opex * input.capacityMw;
  const cashFlows: number[] = [];
  let discountedCashFlows = 0;
  let discountedOpex = 0;
  let discountedProduction = 0;

  for (let year = 1; year <= PROJECT_YEARS; year += 1) {
    const degradationFactor = (1 - ANNUAL_DEGRADATION_RATE) ** (year - 1);

    // Production N = productible MWh/MW/an * MW * degradation annuelle.
    const production = input.yieldMwh * input.capacityMw * degradationFactor;

    // Chiffre d'affaires k€ = production MWh * tarif €/MWh / 1000.
    const revenue = (production * input.tariff) / 1000;

    // Cash-flow k€ = chiffre d'affaires k€ - OPEX k€/MW/an * MW.
    const cashFlow = revenue - annualOpex;

    cashFlows.push(cashFlow);
    discountedCashFlows += discounted(cashFlow, year, DISCOUNT_RATE);
    discountedOpex += discounted(annualOpex, year, DISCOUNT_RATE);
    discountedProduction += discounted(production, year, DISCOUNT_RATE);
  }

  // VAN k€ = somme des cash-flows actualises - investissement initial.
  const npv = discountedCashFlows - initialInvestment;

  // TRI % = taux qui annule la VAN sur le flux initial puis les flux annuels.
  const irr = calculateIrr(initialInvestment, cashFlows) * 100;

  // LCOE €/MWh = cout total actualise k€ / production actualisee MWh * 1000.
  const lcoe =
    discountedProduction > 0
      ? ((initialInvestment + discountedOpex) / discountedProduction) * 1000
      : 0;

  return {
    npv: round(npv),
    irr: round(irr),
    lcoe: round(lcoe),
  };
}
