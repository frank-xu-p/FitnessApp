import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAR_BY_UNIT,
  DEFAULT_INVENTORY_BY_UNIT,
  calculatePlatesPerSide,
  formatPlateCounts,
} from "./plates";

describe("calculatePlatesPerSide", () => {
  it("loads an exact kg match with standard inventory", () => {
    const result = calculatePlatesPerSide(100, DEFAULT_BAR_BY_UNIT.kg, DEFAULT_INVENTORY_BY_UNIT.kg);
    expect(result.ok).toBe(true);
    expect(result.perSide).toBe(40);
    expect(result.remainder).toBe(0);
    expect(result.plates).toEqual([
      { weight: 25, count: 1 },
      { weight: 10, count: 1 },
      { weight: 5, count: 1 },
    ]);
    expect(formatPlateCounts(result.plates, "kg")).toBe("1× 25 kg + 1× 10 kg + 1× 5 kg");
  });

  it("loads an exact lb match with standard inventory", () => {
    const result = calculatePlatesPerSide(225, DEFAULT_BAR_BY_UNIT.lb, DEFAULT_INVENTORY_BY_UNIT.lb);
    expect(result.ok).toBe(true);
    expect(result.perSide).toBe(90);
    expect(result.plates).toEqual([
      { weight: 45, count: 2 },
    ]);
  });

  it("returns bar only when target equals the barbell", () => {
    const result = calculatePlatesPerSide(45, 45, DEFAULT_INVENTORY_BY_UNIT.lb);
    expect(result.ok).toBe(true);
    expect(result.plates).toEqual([]);
    expect(result.perSide).toBe(0);
  });

  it("reports a remainder when the target cannot be loaded evenly", () => {
    const result = calculatePlatesPerSide(73, 20, DEFAULT_INVENTORY_BY_UNIT.kg);
    expect(result.ok).toBe(false);
    expect(result.perSide).toBe(26.5);
    expect(result.remainder).toBe(1.5);
    expect(result.error).toMatch(/Remainder: 1.5/);
    expect(result.plates).toEqual([
      { weight: 25, count: 1 },
    ]);
  });

  it("errors when the target is lighter than the empty barbell", () => {
    const result = calculatePlatesPerSide(10, DEFAULT_BAR_BY_UNIT.kg, DEFAULT_INVENTORY_BY_UNIT.kg);
    expect(result.ok).toBe(false);
    expect(result.plates).toEqual([]);
    expect(result.error).toBe("Target is lighter than the empty barbell.");
  });

  it("respects limited inventory counts", () => {
    const inventory = [{ id: "only-25", weight: 25, count: 1 }];
    const result = calculatePlatesPerSide(120, 20, inventory);
    expect(result.ok).toBe(false);
    expect(result.plates).toEqual([{ weight: 25, count: 1 }]);
    expect(result.remainder).toBe(25);
  });

  it("toggles between lb and kg defaults without converting plates", () => {
    const kg = calculatePlatesPerSide(60, DEFAULT_BAR_BY_UNIT.kg, DEFAULT_INVENTORY_BY_UNIT.kg);
    const lb = calculatePlatesPerSide(135, DEFAULT_BAR_BY_UNIT.lb, DEFAULT_INVENTORY_BY_UNIT.lb);

    expect(kg.ok).toBe(true);
    expect(kg.plates).toEqual([{ weight: 20, count: 1 }]);

    expect(lb.ok).toBe(true);
    expect(lb.plates).toEqual([{ weight: 45, count: 1 }]);
    expect(DEFAULT_INVENTORY_BY_UNIT.lb.map((p) => p.weight)).toEqual([45, 25, 10, 5, 2.5]);
    expect(DEFAULT_INVENTORY_BY_UNIT.kg.map((p) => p.weight)).toEqual([25, 20, 10, 5, 2.5]);
  });
});
