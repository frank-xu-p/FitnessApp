import { describe, it, expect } from "vitest";
import {
  computeProgressionSuggestion,
  suggestNextSetWeight,
  nextTargetWeight,
  defaultRule,
  defaultEquipmentIncrement,
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

  describe("cadence gating (H7)", () => {
    it("holds weight when a weekly progression was already applied within 7 days", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 100,
        lastReps: 12,
        lastRpe: 8,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
        cadenceRate: "weekly",
        lastSessionAt: Date.now() - 2 * 86400 * 1000,
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(false);
      expect(suggestion.suggestedWeightKg).toBe(100);
      expect(suggestion.reason).toContain("Cadence hold");
    });

    it("progresses when the weekly window has fully elapsed", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 100,
        lastReps: 12,
        lastRpe: 8,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
        cadenceRate: "weekly",
        lastSessionAt: Date.now() - 8 * 86400 * 1000,
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
      expect(suggestion.suggestedWeightKg).toBeGreaterThan(100);
    });

    it("does not gate when cadenceRate is 'session'", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 100,
        lastReps: 12,
        lastRpe: 8,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
        cadenceRate: "session",
        lastSessionAt: Date.now() - 1000,
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
    });
  });

  describe("targetRpe-relative thresholds (H8)", () => {
    it("overloads at targetRpe=7 when RPE is 7.5", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 12,
        lastRpe: 7.5,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        targetRpe: 7,
        incrementKg: 2.5,
        model: "double_progression",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(true);
    });

    it("consolidates at targetRpe=7 when RPE is 9", () => {
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 10,
        lastRpe: 9,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        targetRpe: 7,
        incrementKg: 2.5,
        model: "double_progression",
        unit: "kg",
      });

      expect(suggestion.isOverload).toBe(false);
      expect(suggestion.reason).toContain("Consolidate");
    });
  });

  describe("unit-aware increments (H13)", () => {
    it("interprets the default increment in pounds for lb users", () => {
      const inc = defaultEquipmentIncrement("barbell", "lb");
      // 2.5 lb in kg, not 2.5 kg (~5.5 lb jump)
      expect(inc).toBeCloseTo(1.13398, 4);
    });

    it("keeps kg defaults unchanged for kg users", () => {
      expect(defaultEquipmentIncrement("barbell", "kg")).toBe(2.5);
      expect(defaultEquipmentIncrement("dumbbell", "kg")).toBe(2.0);
    });
  });

  describe("suggestNextSetWeight helper", () => {
    it("suggests weight for upcoming set based on last completed set in session", () => {
      const sets = [
        { weightKg: 60, reps: 12, rpe: 8, completedAt: Date.now() },
      ];
      const rule = defaultRule("barbell");
      const nextWeight = suggestNextSetWeight(sets, rule, "kg");
      expect(nextWeight).toBe(62.5);
    });

    it("ignores prefilled-but-uncompleted sets (H9)", () => {
      const sets = [
        { weightKg: 60, reps: 12, rpe: 8, completedAt: null },
      ];
      const rule = defaultRule("barbell");
      expect(suggestNextSetWeight(sets, rule, "kg")).toBeNull();
    });

    it("only uses completed sets when later sets are uncompleted", () => {
      const now = Date.now();
      const sets = [
        { weightKg: 60, reps: 12, rpe: 8, completedAt: now },
        { weightKg: 60, reps: 12, rpe: null, completedAt: null },
      ];
      const rule = defaultRule("barbell");
      expect(suggestNextSetWeight(sets, rule, "kg")).toBe(62.5);
    });

    it("returns null if no sets have been logged yet", () => {
      const nextWeight = suggestNextSetWeight([], defaultRule(), "kg");
      expect(nextWeight).toBeNull();
    });
  });
});
