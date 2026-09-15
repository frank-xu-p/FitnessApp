import { describe, it, expect } from "vitest";
import {
  computeProgressionSuggestion,
  suggestNextSetWeight,
  defaultRule,
  defaultEquipmentIncrement,
} from "./progression";
import { toDisplay, toCanonical, formatWeight, roundToPlate } from "./units";

describe("Workout Log & Auto Progressive Overload Full Simulation", () => {
  describe("Multi-Session Double Progression Lifecycle", () => {
    it("simulates a 4-week double progression cycle on Barbell Bench Press", () => {
      // Week 1: Starting at 80 kg, target 8 reps. User performs 8, 8, 8 reps @ RPE 7.5.
      const w1 = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 8,
        lastRpe: 7.5,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
      });
      // Should progress reps within range
      expect(w1.isOverload).toBe(false);
      expect(w1.suggestedWeightKg).toBe(80);
      expect(w1.suggestedReps).toBe(9);

      // Week 2: User performs 10, 10, 10 reps @ RPE 8.
      const w2 = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 10,
        lastRpe: 8,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
      });
      expect(w2.isOverload).toBe(false);
      expect(w2.suggestedWeightKg).toBe(80);
      expect(w2.suggestedReps).toBe(11);

      // Week 3: User hits top of rep range: 12, 12, 12 reps @ RPE 8.0!
      const w3 = computeProgressionSuggestion({
        lastWeightKg: 80,
        lastReps: 12,
        lastRpe: 8.0,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
      });
      // Overload should trigger: +2.5 kg weight increase and reset to minReps (8 reps)
      expect(w3.isOverload).toBe(true);
      expect(w3.suggestedWeightKg).toBe(82.5);
      expect(w3.suggestedReps).toBe(8);
      expect(w3.deltaKg).toBe(2.5);

      // Week 4: Training with new weight: 82.5 kg, user performs 8 reps @ RPE 9.5 (tough day).
      const w4 = computeProgressionSuggestion({
        lastWeightKg: 82.5,
        lastReps: 8,
        lastRpe: 9.5,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: 2.5,
        model: "double_progression",
      });
      // Should hold and consolidate weight
      expect(w4.isOverload).toBe(false);
      expect(w4.suggestedWeightKg).toBe(82.5);
      expect(w4.reason).toContain("Consolidate");
    });
  });

  describe("Equipment-Specific Microloading Jumps", () => {
    it("assigns appropriate increment step per equipment type", () => {
      expect(defaultEquipmentIncrement("barbell")).toBe(2.5);
      expect(defaultEquipmentIncrement("dumbbell")).toBe(2.0);
      expect(defaultEquipmentIncrement("cable")).toBe(2.5);
      expect(defaultEquipmentIncrement("bodyweight")).toBe(1.25);
    });

    it("handles dumbbell microloading in double progression", () => {
      const dbSuggestion = computeProgressionSuggestion({
        lastWeightKg: 24, // 24 kg dumbbells
        lastReps: 12,
        lastRpe: 8,
        equipment: "dumbbell",
        model: "double_progression",
      });
      expect(dbSuggestion.isOverload).toBe(true);
      expect(dbSuggestion.suggestedWeightKg).toBe(26); // +2 kg
      expect(dbSuggestion.suggestedReps).toBe(6); // minReps
    });
  });

  describe("Pounds (lb) Unit Display & Overload Rounding", () => {
    it("accurately handles 5 lb jumps in pound mode", () => {
      // 185 lb = ~83.9146 kg
      const weightKg = toCanonical(185, "lb")!;
      const suggestion = computeProgressionSuggestion({
        lastWeightKg: weightKg,
        lastReps: 12,
        lastRpe: 8,
        targetReps: 8,
        minReps: 8,
        maxReps: 12,
        incrementKg: toCanonical(5, "lb")!, // 5 lb increment
        unit: "lb",
        model: "double_progression",
      });

      expect(suggestion.isOverload).toBe(true);
      const displaySuggested = toDisplay(suggestion.suggestedWeightKg, "lb");
      expect(Math.round(displaySuggested!)).toBe(190); // 185 lb + 5 lb = 190 lb
    });
  });

  describe("Dynamic In-Session Set Prediction", () => {
    it("suggests the same or overloaded weight for set 2 based on set 1 performance", () => {
      const set1 = { weightKg: 100, reps: 12, rpe: 7.5, completedAt: 1 };
      const nextWeight = suggestNextSetWeight(
        [set1],
        {
          targetReps: 8,
          minReps: 8,
          maxReps: 12,
          incrementKg: 2.5,
          model: "double_progression",
        },
        "kg"
      );
      expect(nextWeight).toBe(102.5);
    });

    it("maintains current weight if set 1 was within working range", () => {
      const set1 = { weightKg: 100, reps: 9, rpe: 8.0, completedAt: 1 };
      const nextWeight = suggestNextSetWeight(
        [set1],
        {
          targetReps: 8,
          minReps: 8,
          maxReps: 12,
          incrementKg: 2.5,
          model: "double_progression",
        },
        "kg"
      );
      expect(nextWeight).toBe(100);
    });
  });
});
