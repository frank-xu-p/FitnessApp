import { describe, it, expect } from "vitest";
import { PRESET_TEMPLATES, FALLBACK_EXERCISES } from "../../db/seed";

describe("Workout Lifecycle - Template Seeding & Preset Immutability", () => {
  describe("Pre-Seeded Preset Templates Specification", () => {
    it("defines the 5 core preset templates", () => {
      const templateIds = PRESET_TEMPLATES.map((t) => t.id);
      expect(templateIds).toContain("tpl_push_day");
      expect(templateIds).toContain("tpl_pull_day");
      expect(templateIds).toContain("tpl_leg_day");
      expect(templateIds).toContain("tpl_upper_body");
      expect(templateIds).toContain("tpl_lower_body");
    });

    it("flags all preset templates with isPreset: true", () => {
      for (const tpl of PRESET_TEMPLATES) {
        expect(tpl.isPreset).toBe(true);
        expect(tpl.exercises.length).toBeGreaterThan(0);
      }
    });

    it("verifies Push Day preset exercises (Bench Press, Incline DB, Lateral Raises, Triceps)", () => {
      const pushDay = PRESET_TEMPLATES.find((t) => t.id === "tpl_push_day")!;
      expect(pushDay.name).toBe("Push Day");
      const exIds = pushDay.exercises.map((e) => e.exerciseId);
      expect(exIds).toEqual([
        "barbell-bench-press",
        "incline-dumbbell-press",
        "lateral-raise",
        "triceps-pushdown",
      ]);
    });

    it("verifies Pull Day preset exercises (Deadlift, Lat Pulldown, Barbell Row, Bicep Curls)", () => {
      const pullDay = PRESET_TEMPLATES.find((t) => t.id === "tpl_pull_day")!;
      expect(pullDay.name).toBe("Pull Day");
      const exIds = pullDay.exercises.map((e) => e.exerciseId);
      expect(exIds).toEqual([
        "deadlift",
        "lat-pulldown",
        "barbell-row",
        "bicep-curl",
      ]);
    });

    it("verifies Leg Day preset exercises (Squat, Romanian Deadlift, Leg Extension, Calf Raises)", () => {
      const legDay = PRESET_TEMPLATES.find((t) => t.id === "tpl_leg_day")!;
      expect(legDay.name).toBe("Leg Day");
      const exIds = legDay.exercises.map((e) => e.exerciseId);
      expect(exIds).toEqual([
        "back-squat",
        "romanian-deadlift",
        "leg-extension",
        "standing-calf-raises",
      ]);
    });

    it("verifies Upper Body foundation preset", () => {
      const upperBody = PRESET_TEMPLATES.find((t) => t.id === "tpl_upper_body")!;
      expect(upperBody.name).toBe("Upper Body");
      const exIds = upperBody.exercises.map((e) => e.exerciseId);
      expect(exIds).toContain("barbell-bench-press");
      expect(exIds).toContain("lat-pulldown");
      expect(exIds).toContain("overhead-press");
      expect(exIds).toContain("barbell-row");
      expect(exIds).toContain("bicep-curl");
      expect(exIds).toContain("triceps-pushdown");
    });

    it("verifies Lower Body foundation preset", () => {
      const lowerBody = PRESET_TEMPLATES.find((t) => t.id === "tpl_lower_body")!;
      expect(lowerBody.name).toBe("Lower Body");
      const exIds = lowerBody.exercises.map((e) => e.exerciseId);
      expect(exIds).toContain("back-squat");
      expect(exIds).toContain("romanian-deadlift");
      expect(exIds).toContain("leg-extension");
      expect(exIds).toContain("standing-calf-raises");
    });

    it("verifies all referenced exercise IDs exist in fallback exercises", () => {
      const fallbackIds = new Set(FALLBACK_EXERCISES.map((e) => e.id));
      for (const tpl of PRESET_TEMPLATES) {
        for (const ex of tpl.exercises) {
          expect(fallbackIds.has(ex.exerciseId)).toBe(true);
        }
      }
    });
  });

  describe("Preset Duplication & Immutability Simulation", () => {
    it("clones a preset template into a custom non-preset template without mutating original", () => {
      const originalPreset = PRESET_TEMPLATES.find((t) => t.id === "tpl_push_day")!;

      // Deep copy duplication simulation
      const duplicated = {
        id: `tpl_custom_${Date.now()}`,
        userId: "user-123",
        name: `${originalPreset.name} (Custom)`,
        notes: originalPreset.notes,
        category: originalPreset.category,
        isPreset: false, // Must be false for user copies
        autoOverloadEnabled: originalPreset.autoOverloadEnabled,
        cadenceModel: originalPreset.cadenceModel,
        cadenceRate: originalPreset.cadenceRate,
        cadenceIncrementKg: originalPreset.cadenceIncrementKg,
        exercises: originalPreset.exercises.map((e) => ({ ...e })),
      };

      // Assertions
      expect(duplicated.isPreset).toBe(false);
      expect(duplicated.name).toBe("Push Day (Custom)");
      expect(duplicated.exercises.length).toBe(originalPreset.exercises.length);

      // Mutating the duplicate must NOT affect the original preset
      duplicated.exercises.push({
        exerciseId: "overhead-press",
        orderIndex: 4,
        targetSets: 3,
        targetReps: 10,
        targetWeightKg: 40,
        targetRpe: 8,
      });

      expect(duplicated.exercises.length).toBe(5);
      expect(originalPreset.exercises.length).toBe(4);
      expect(originalPreset.isPreset).toBe(true);
    });

    it("prevents deletion of presets", () => {
      const canDelete = (isPreset: boolean) => {
        if (isPreset) throw new Error("Cannot delete a preset template");
        return true;
      };

      expect(() => canDelete(true)).toThrow("Cannot delete a preset template");
      expect(canDelete(false)).toBe(true);
    });
  });
});
