import { describe, it, expect } from "vitest";
import {
  computeProgressionSuggestion,
  suggestNextSetWeight,
  nextTargetWeight,
  defaultRule,
  rirToRpe,
  rpeToRir,
} from "./progression";

describe("progression engine", () => {
  it("converts RPE and RIR bidirectionally", () => {
    expect(rirToRpe(2)).toBe(8);
    expect(rirToRpe(0)).toBe(10);
    expect(rpeToRir(8)).toBe(2);
    expect(rpeToRir(9.5)).toBe(0.5);
  });

  describe("double progression model", () => {
    it("triggers weight overload and resets reps when max reps hit with good RPE", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 12,
        lastRpe: 8,
        minReps: 8,
        maxReps: 12,
        targetReps: 8,
        incrementKg: 2.5,
        model: "double_progression",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
      expect(suggestion.suggestedWeightKg).toBe(82.5);
      expect(suggestion.suggestedReps).toBe(8);
      expect(suggestion.reason).toContain("Overload weight");
    });

    it("increases target reps when within rep range and RPE is manageable", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 9,
        lastRpe: 7.5,
        minReps: 8,
        maxReps: 12,
        targetReps: 8,
        incrementKg: 2.5,
        model: "double_progression",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(false);
      expect(suggestion.suggestedWeightKg).toBe(80);
      expect(suggestion.suggestedReps).toBe(10);
      expect(suggestion.reason).toContain("Progressive rep target");
    });

    it("holds weight and consolidates if RPE is very high", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 12,
        lastRpe: 10,
        minReps: 8,
        maxReps: 12,
        targetReps: 8,
        incrementKg: 2.5,
        model: "double_progression",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(false);
      expect(suggestion.suggestedWeightKg).toBe(80);
      expect(suggestion.reason).toContain("Consolidate");
    });
  });

  describe("rpe autoregulated model", () => {
    it("accelerates overload on easy sets (RPE <= 7)", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 100,
        lastReps: 8,
        lastRpe: 6.5,
        targetReps: 8,
        incrementKg: 2.5,
        model: "rpe_autoregulated",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
      // 100 + 2.5 * 1.5 = 103.75 -> rounded to plate (0.5 step) = 104
      expect(suggestion.suggestedWeightKg).toBeGreaterThanOrEqual(103.5);
      expect(suggestion.reason).toContain("Accelerated jump");
    });

    it("holds weight when RPE is at failure (RPE 9.5+)", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 100,
        lastReps: 7,
        lastRpe: 10,
        targetReps: 8,
        incrementKg: 2.5,
        model: "rpe_autoregulated",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(false);
      expect(suggestion.suggestedWeightKg).toBe(100);
      expect(suggestion.reason).toContain("High RPE");
    });
  });

  describe("linear cadence model", () => {
    it("increases by fixed increment per cadence step", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 50,
        lastReps: 10,
        incrementKg: 2.5,
        model: "linear",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
      expect(suggestion.suggestedWeightKg).toBe(52.5);
    });
  });

  describe("suggestNextSetWeight helper", () => {
    it("suggests weight for upcoming set based on last completed set in session", () => {
      const sets = [
        { weightKg: 60, reps: 12, rpe: 8 },
      ];
      const rule = defaultRule("barbell");
      const nextWeight = suggestNextSetWeight(sets, rule, "kg");
      expect(nextWeight).toBe(62.5);
    });

    it("returns null if no sets have been logged yet", () => {
      const nextWeight = suggestNextSetWeight([], defaultRule(), "kg");
      expect(nextWeight).toBeNull();
    });
  });
});
