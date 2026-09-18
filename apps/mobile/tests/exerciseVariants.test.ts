import { describe, it, expect } from "vitest";
import {
  normalizeMovementName,
  findMovementGroup,
  deriveVariantLabel,
  getExerciseDisplayName,
  groupExercises,
  MOVEMENT_GROUPS,
} from "../lib/exerciseVariants";

describe("exerciseVariants", () => {
  describe("findMovementGroup", () => {
    it("detects the movement regardless of equipment/attachment wording", () => {
      expect(findMovementGroup("Triceps Pushdown")).toBe("triceps-pushdown");
      expect(findMovementGroup("Cable Rope Triceps Pushdown")).toBe("triceps-pushdown");
      expect(findMovementGroup("Triceps Pushdown (Rope)")).toBe("triceps-pushdown");
      expect(findMovementGroup("Triceps Pushdown (Cable-Rope)")).toBe("triceps-pushdown");
      expect(findMovementGroup("Triceps Pushdown - Rope Attachment")).toBe("triceps-pushdown");
      expect(findMovementGroup("Triceps Pushdown - V-Bar Attachment")).toBe("triceps-pushdown");
      expect(findMovementGroup("Triceps Extension (Rope)")).toBe("triceps-extension");
      expect(findMovementGroup("Seated Cable Chest Press")).toBe("chest-press");
      expect(findMovementGroup("Dumbbell Bicep Curl")).toBe("biceps-curl");
    });

    it("never collapses distinct movements into a group", () => {
      expect(findMovementGroup("Hack Squat")).toBeNull();
      expect(findMovementGroup("Front Squat")).toBeNull();
      expect(findMovementGroup("Overhead Triceps")).toBeNull();
      expect(findMovementGroup("Upper Back Row")).toBeNull();
      expect(findMovementGroup("Cable Wrist Curl")).toBeNull();
      expect(findMovementGroup("Quantum Flux Capacitor Lift")).toBeNull();
    });

    it("keeps pushdown and extension as separate movements", () => {
      expect(findMovementGroup("Triceps Pushdown (Rope)")).toBe("triceps-pushdown");
      expect(findMovementGroup("Rope Triceps Extension")).toBe("triceps-extension");
    });
  });

  describe("normalizeMovementName", () => {
    it("strips equipment, attachments and positions", () => {
      expect(normalizeMovementName("Cable Rope Triceps Pushdown")).toBe("triceps pushdown");
      expect(normalizeMovementName("Seated Dumbbell Shoulder Press")).toBe("shoulder press");
    });
  });

  describe("deriveVariantLabel", () => {
    it("extracts the attachment", () => {
      expect(deriveVariantLabel("Cable Rope Triceps Pushdown", "cable", "triceps-pushdown")).toBe("Rope");
      expect(deriveVariantLabel("Triceps Pushdown - Rope Attachment", "cable", "triceps-pushdown")).toBe("Rope");
      expect(deriveVariantLabel("Triceps Pushdown - V-Bar Attachment", "cable", "triceps-pushdown")).toBe("V Bar");
    });

    it("canonicalizes Strong's Cable- prefixed attachments to catalog labels", () => {
      // Strong exports "(Cable-Rope)" / "(Cable-Straight Bar)"; the catalog
      // labels are "Rope" / "Straight Bar" — they must resolve to the same.
      expect(deriveVariantLabel("Triceps Pushdown (Cable-Rope)", "cable", "triceps-pushdown")).toBe("Rope");
      expect(deriveVariantLabel("Triceps Pushdown (Cable-Straight Bar)", "cable", "triceps-pushdown")).toBe("Straight Bar");
      expect(deriveVariantLabel("Overhead Triceps Extension (Cable-Straight Bar)", "cable", "triceps-extension")).toBe("Straight Bar");
    });

    it("defaults a bare cable pushdown to Straight Bar", () => {
      expect(deriveVariantLabel("Triceps Pushdown", "cable", "triceps-pushdown")).toBe("Straight Bar");
      expect(deriveVariantLabel("Cable Triceps Pushdown", "cable", "triceps-pushdown")).toBe("Straight Bar");
    });

    it("falls back to equipment when nothing distinguishes the variant", () => {
      expect(deriveVariantLabel("Barbell Shoulder Press", "barbell", "shoulder-press")).toBe("Barbell");
      expect(deriveVariantLabel("Machine Bench Press", "machine", "bench-press")).toBe("Machine");
    });

    it("keeps positions and grips as labels", () => {
      expect(deriveVariantLabel("Incline Cable Chest Press", "cable", "chest-press")).toBe("Incline");
      expect(deriveVariantLabel("Close-Grip Barbell Bench Press", "barbell", "bench-press")).toBe("Close Grip");
    });
  });

  describe("getExerciseDisplayName", () => {
    it("renders movement + variant", () => {
      expect(
        getExerciseDisplayName({
          id: "x",
          name: "Cable Rope Triceps Pushdown",
          movementGroup: "triceps-pushdown",
          variantLabel: "Rope",
        })
      ).toBe("Triceps Pushdown · Rope");
    });

    it("renders the bare movement for the base variant", () => {
      expect(
        getExerciseDisplayName({
          id: "x",
          name: "Triceps Pushdown",
          movementGroup: "triceps-pushdown",
          variantLabel: null,
        })
      ).toBe("Triceps Pushdown");
    });

    it("falls back to the raw name when ungrouped", () => {
      expect(
        getExerciseDisplayName({ id: "x", name: "Face Pull", movementGroup: null, variantLabel: null })
      ).toBe("Face Pull");
    });
  });

  describe("groupExercises", () => {
    it("groups by movement and leaves the rest ungrouped", () => {
      const list = [
        { id: "1", name: "Triceps Pushdown", movementGroup: "triceps-pushdown", variantLabel: "Straight Bar" },
        { id: "2", name: "Cable Rope Triceps Pushdown", movementGroup: "triceps-pushdown", variantLabel: "Rope" },
        { id: "3", name: "Face Pull", movementGroup: null, variantLabel: null },
      ];
      const groups = groupExercises(list);
      expect(groups.length).toBe(2);
      expect(groups[0].groupKey).toBe("triceps-pushdown");
      expect(groups[0].items.length).toBe(2);
      expect(groups[1].groupKey).toBeNull();
    });
  });

  describe("catalog sanity", () => {
    it("defines a display name for every group", () => {
      for (const key of Object.keys(MOVEMENT_GROUPS)) {
        expect(MOVEMENT_GROUPS[key].length).toBeGreaterThan(0);
      }
    });
  });
});
