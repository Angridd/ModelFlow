import { describe, expect, it } from "vitest";
import { sizingResult } from "@/app/lib/finance/engine";

describe("sizingResult", () => {
  it("DSCR contraint — debtSculpted < debtGearingMax", () => {
    // debtSculpted = 5 000, capex = 10 000, gearingMax = 70 % → gearingMax = 7 000
    // headroom = 7 000 - 5 000 = 2 000
    // structuringFee = 2 000 × 1,5 = 3 000
    const result = sizingResult(5000, 10000, 70, 1.5);

    expect(result.bindingConstraint).toBe("dscr");
    expect(result.debtGearingMaxKeuro).toBeCloseTo(7000);
    expect(result.debtRetenuKeuro).toBeCloseTo(5000);
    expect(result.headroomKeuro).toBeCloseTo(2000);
    expect(result.structuringFeeKeuro).toBeCloseTo(3000);
    expect(result.structuringFeeRate).toBe(1.5);
  });

  it("Gearing contraint — debtSculpted > debtGearingMax", () => {
    // debtSculpted = 8 000, gearingMax cap = 7 000 → gearing binds
    // headroom = 0 → structuringFee = 0
    const result = sizingResult(8000, 10000, 70, 1.5);

    expect(result.bindingConstraint).toBe("gearing");
    expect(result.debtGearingMaxKeuro).toBeCloseTo(7000);
    expect(result.debtRetenuKeuro).toBeCloseTo(7000);
    expect(result.headroomKeuro).toBeCloseTo(0);
    expect(result.structuringFeeKeuro).toBeCloseTo(0);
  });

  it("Contraintes égales — debtSculpted === debtGearingMax", () => {
    // debtSculpted = 7 000, gearingMax cap = 7 000 → equal
    const result = sizingResult(7000, 10000, 70, 1.5);

    expect(result.bindingConstraint).toBe("equal");
    expect(result.debtRetenuKeuro).toBeCloseTo(7000);
    expect(result.headroomKeuro).toBeCloseTo(0);
    expect(result.structuringFeeKeuro).toBeCloseTo(0);
  });

  it("gearingMax null — pas de contrainte gearing", () => {
    // No bank cap: debtRetenu = debtSculpted, headroom = 0, no fee.
    const result = sizingResult(5000, 10000, null, 1.5);

    expect(result.debtGearingMaxKeuro).toBeNull();
    expect(result.bindingConstraint).toBe("dscr");
    expect(result.debtRetenuKeuro).toBeCloseTo(5000);
    expect(result.headroomKeuro).toBeCloseTo(0);
    expect(result.structuringFeeKeuro).toBeCloseTo(0);
  });

  it("structuringFeeRate = 0 → structuringFeeKeuro = 0 même avec headroom", () => {
    // headroom = 2 000 but feeRate = 0 → no fee revenue
    const result = sizingResult(5000, 10000, 70, 0);

    expect(result.bindingConstraint).toBe("dscr");
    expect(result.headroomKeuro).toBeCloseTo(2000);
    expect(result.structuringFeeKeuro).toBeCloseTo(0);
  });
});
