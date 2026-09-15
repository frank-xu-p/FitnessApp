import { describe, it, expect } from "vitest";
import {
  effectiveWeightKg,
  effectiveReps,
  setVolumeKg,
  isUnilateralSet,
  hasRequiredDataForCompletion,
} from "./unilateral";

describe("unilateral set helpers", () => {
  describe("effectiveWeightKg", () => {
    it("returns bilateral weight when present", () => {
      expect(
        effectiveWeightKg({
          weightKg: 100,
          reps: 8,
          leftWeightKg: 40,
          leftReps: 8,
          rightWeightKg: 42,
          rightReps: 8,
        })
      ).toBe(100);
    });

    it("returns the heavier per-side weight for unilateral sets", () => {
      expect(
        effectiveWeightKg({
          weightKg: null,
          reps: null,
          leftWeightKg: 30,
          leftReps: 10,
          rightWeightKg: 32.5,
          rightReps: 10,
        })
      ).toBe(32.5);
    });

    it("returns null when no weight data exists", () => {
      expect(
        effectiveWeightKg({
          weightKg: null,
          reps: null,
          leftWeightKg: null,
          leftReps: null,
          rightWeightKg: null,
          rightReps: null,
        })
      ).toBeNull();
    });
  });

  describe("effectiveReps", () => {
    it("returns bilateral reps when present", () => {
      expect(
        effectiveReps({
          weightKg: 100,
          reps: 8,
          leftWeightKg: null,
          leftReps: 10,
          rightWeightKg: null,
          rightReps: 12,
        })
      ).toBe(8);
    });

    it("returns the higher per-side rep count", () => {
      expect(
        effectiveReps({
          weightKg: null,
          reps: null,
          leftWeightKg: 30,
          leftReps: 10,
          rightWeightKg: 30,
          rightReps: 12,
        })
      ).toBe(12);
    });
  });

  describe("setVolumeKg", () => {
    it("computes bilateral volume", () => {
      expect(
        setVolumeKg({
          weightKg: 100,
          reps: 8,
          leftWeightKg: null,
          leftReps: null,
          rightWeightKg: null,
          rightReps: null,
        })
      ).toBe(800);
    });

    it("sums both sides for unilateral sets", () => {
      expect(
        setVolumeKg({
          weightKg: null,
          reps: null,
          leftWeightKg: 30,
          leftReps: 10,
          rightWeightKg: 32.5,
          rightReps: 8,
        })
      ).toBe(30 * 10 + 32.5 * 8);
    });

    it("ignores a side with missing reps", () => {
      expect(
        setVolumeKg({
          weightKg: null,
          reps: null,
          leftWeightKg: 30,
          leftReps: null,
          rightWeightKg: 32.5,
          rightReps: 8,
        })
      ).toBe(32.5 * 8);
    });

    it("returns 0 for empty sets", () => {
      expect(
        setVolumeKg({
          weightKg: null,
          reps: null,
          leftWeightKg: null,
          leftReps: null,
          rightWeightKg: null,
          rightReps: null,
        })
      ).toBe(0);
    });
  });

  describe("isUnilateralSet", () => {
    it("detects unilateral sets", () => {
      expect(
        isUnilateralSet({
          weightKg: null,
          reps: null,
          leftWeightKg: 30,
          leftReps: 10,
          rightWeightKg: 30,
          rightReps: 10,
        })
      ).toBe(true);
    });

    it("does not flag bilateral sets", () => {
      expect(
        isUnilateralSet({
          weightKg: 100,
          reps: 8,
          leftWeightKg: null,
          leftReps: null,
          rightWeightKg: null,
          rightReps: null,
        })
      ).toBe(false);
    });
  });

  describe("hasRequiredDataForCompletion", () => {
    it("requires weight+reps for bilateral", () => {
      expect(
        hasRequiredDataForCompletion(
          {
            weightKg: 100,
            reps: null,
            leftWeightKg: null,
            leftReps: null,
            rightWeightKg: null,
            rightReps: null,
          },
          "bilateral"
        )
      ).toBe(false);
      expect(
        hasRequiredDataForCompletion(
          {
            weightKg: 100,
            reps: 8,
            leftWeightKg: null,
            leftReps: null,
            rightWeightKg: null,
            rightReps: null,
          },
          "bilateral"
        )
      ).toBe(true);
    });

    it("requires both sides for unilateral", () => {
      expect(
        hasRequiredDataForCompletion(
          {
            weightKg: null,
            reps: null,
            leftWeightKg: 30,
            leftReps: 10,
            rightWeightKg: null,
            rightReps: null,
          },
          "unilateral"
        )
      ).toBe(false);
      expect(
        hasRequiredDataForCompletion(
          {
            weightKg: null,
            reps: null,
            leftWeightKg: 30,
            leftReps: 10,
            rightWeightKg: 30,
            rightReps: 10,
          },
          "unilateral"
        )
      ).toBe(true);
    });
  });
});
