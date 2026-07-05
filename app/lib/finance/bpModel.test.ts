import { describe, expect, it } from "vitest";
import type { Project, Scenario } from "@/app/generated/prisma/client";
import { buildBpModel } from "@/app/lib/bpModel";
import { buildFinanceInput, type ProjectFinanceFields } from "@/app/lib/scenarioMetrics";
import { calculateAnnualCashFlows, calculateScenarioMetrics } from "@/app/lib/finance/engine";

// Projet + scénario synthétiques minimaux (mêmes ordres de grandeur que sizingResult.test).
// `as unknown as` évite d'énumérer les ~80 colonnes Prisma sans recourir à `any`.
function makeProject(): ProjectFinanceFields & { name: string } {
  return {
    name: "Projet Test BP",
    technology: "Fixed",
    capacityMw: 10,
    commissioningYear: 2029,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    investorCurveW: 1,
  } as unknown as Project;
}

function makeScenario(): Scenario {
  return {
    name: "Base Case",
    isReference: true,
    capex: 650,
    opex: 10,
    yieldMwh: 1850,
    yieldP90Mwh: 1700,
    tariff: 105,
    debtRate: 60,
    projectLifeYears: 25,
    degradationRate: 0.3,
    discountRate: 6,
    debtInterestRate: 4,
    debtMaturityYears: 12,
    tariffInflationRate: 0,
    opexInflationRate: 1,
    tauxIS: 25,
    debtTenorYears: 12,
    dscrSchedule: JSON.stringify([{ yearFrom: 1, yearTo: 12, dscrValue: 1.25 }]),
    gearingMaxPct: 70,
    constructionYears: 1,
    opexEngagementsKeuroByYear: null,
    margeFactFigeeKeuro: null,
  } as unknown as Scenario;
}

describe("buildBpModel", () => {
  it("produit des sections alignées sur les années et des scalaires à une valeur", () => {
    const project = makeProject();
    const scenario = makeScenario();
    const model = buildBpModel(project, scenario);

    // En-tête et méta.
    expect(model.projectName).toBe("Projet Test BP");
    expect(model.scenarioName).toBe("Base Case");
    expect(model.years.length).toBeGreaterThan(0);
    // Années de construction (an-1, an0) + 25 ans d'exploitation.
    expect(model.years).toContain(1);
    expect(model.years.filter((y) => y <= 0).length).toBe(2);
    expect(model.years.filter((y) => y >= 1).length).toBe(25);

    // Toutes les sections attendues sont présentes.
    const titles = model.sections.map((s) => s.title);
    for (const t of [
      "Hypothèses clés (rappel)",
      "Production",
      "Revenus",
      "OPEX par poste (P50)",
      "EBITDA",
      "Compte de résultat",
      "CFADS",
      "Service de la dette",
      "Waterfall SHL (CCA)",
      "Distribution actionnaire",
      "Outputs (synthèse)",
    ]) {
      expect(titles).toContain(t);
    }

    // Lignes annuelles : longueur === nombre d'années. Lignes scalaires : longueur 1.
    for (const section of model.sections) {
      for (const line of section.lines) {
        if (line.scalar) {
          expect(line.valeurs.length).toBe(1);
        } else {
          expect(line.valeurs.length).toBe(model.years.length);
        }
      }
    }
  });

  it("mappe fidèlement les champs moteur (OPEX total, EBITDA, TRI investisseur)", () => {
    const project = makeProject();
    const scenario = makeScenario();
    const model = buildBpModel(project, scenario);

    const input = buildFinanceInput(project, scenario);
    const flows = calculateAnnualCashFlows(input);
    const metrics = calculateScenarioMetrics(input);
    const idxAn1 = model.years.indexOf(1);
    expect(idxAn1).toBeGreaterThanOrEqual(0);
    const rowAn1 = flows.find((r) => r.year === 1)!;

    const findLine = (sectionTitle: string, label: string) =>
      model.sections.find((s) => s.title === sectionTitle)!.lines.find((l) => l.label === label)!;

    // Total OPEX an1 == opex moteur an1 (source autoritaire).
    const totalOpex = findLine("OPEX par poste (P50)", "Total OPEX");
    expect(totalOpex.valeurs[idxAn1]).toBeCloseTo(rowAn1.opexKeuro, 6);

    // EBITDA P50 an1 == revenus P50 − OPEX (identité comptable du moteur).
    const ebitda = findLine("EBITDA", "EBITDA P50");
    expect(ebitda.valeurs[idxAn1]).toBeCloseTo(rowAn1.revenueP50Keuro - rowAn1.opexKeuro, 6);

    // Somme des postes OPEX + Engagements == Total OPEX (aucun poste perdu).
    const opexSection = model.sections.find((s) => s.title === "OPEX par poste (P50)")!;
    const sommePostes = opexSection.lines
      .filter((l) => l.label !== "Total OPEX")
      .reduce((acc, l) => acc + l.valeurs[idxAn1], 0);
    expect(sommePostes).toBeCloseTo(rowAn1.opexKeuro, 4);

    // Le scalaire TRI investisseur == métrique moteur.
    const triInv = findLine("Outputs (synthèse)", "TRI investisseur");
    expect(triInv.valeurs[0]).toBeCloseTo(metrics.investorIrr, 6);
  });
});
