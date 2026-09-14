import { describe, it, expect } from "vitest";
import { SET_TYPE_CONFIG, type SetType } from "../../lib/set-types";
import { createMockSet, createMockWorkout } from "./helpers";
import type { Set as WorkoutSet } from "../../db/schema";

describe("Workout Lifecycle - Advanced Set Tracking & Types", () => {
  describe("Set Types & Badges", () => {
    it("provides correct badge and color for drop sets", () => {
      const dropCfg = SET_TYPE_CONFIG.drop;
      expect(dropCfg.badge).toBe("D");
      expect(dropCfg.color).toBe("#A855F7");
      expect(dropCfg.label).toBe("Drop Set");
    });

    it("provides correct badge and color for failure sets", () => {
      const failureCfg = SET_TYPE_CONFIG.failure;
      expect(failureCfg.badge).toBe("F");
      expect(failureCfg.color).toBe("#EF4444");
      expect(failureCfg.label).toBe("Failure Set");
    });

    it("provides correct badge and color for warmup sets", () => {
      const warmupCfg = SET_TYPE_CONFIG.warmup;
      expect(warmupCfg.badge).toBe("W");
      expect(warmupCfg.color).toBe("#F97316");
      expect(warmupCfg.label).toBe("Warmup Set");
    });

    it("provides correct badge and color for rest-pause sets", () => {
      const rpCfg = SET_TYPE_CONFIG.rest_pause;
      expect(rpCfg.badge).toBe("RP");
      expect(rpCfg.color).toBe("#06B6D4");
      expect(rpCfg.label).toBe("Rest-Pause");
    });
  });

  describe("Isolateral (Unilateral) Set Tracking", () => {
    it("correctly stores and computes volume for independent left and right sides", () => {
      const isolateralSet: WorkoutSet = createMockSet({
        id: "iso_set_1",
        workoutId: "w_iso",
        exerciseId: "single-arm-cable-pulldown",
        setNumber: 1,
        setType: "standard",
        leftWeightKg: 40,
        leftReps: 10,
        rightWeightKg: 40,
        rightReps: 10,
        completedAt: Date.now(),
      });

      expect(isolateralSet.leftWeightKg).toBe(40);
      expect(isolateralSet.leftReps).toBe(10);
      expect(isolateralSet.rightWeightKg).toBe(40);
      expect(isolateralSet.rightReps).toBe(10);

      const totalLeftVol = (isolateralSet.leftWeightKg ?? 0) * (isolateralSet.leftReps ?? 0);
      const totalRightVol = (isolateralSet.rightWeightKg ?? 0) * (isolateralSet.rightReps ?? 0);
      const totalSetVolume = totalLeftVol + totalRightVol;

      expect(totalLeftVol).toBe(400);
      expect(totalRightVol).toBe(400);
      expect(totalSetVolume).toBe(800);
    });

    it("supports drop set with unilateral weights", () => {
      const unilateralDropSet: WorkoutSet = createMockSet({
        id: "iso_drop_1",
        workoutId: "w_iso",
        exerciseId: "single-arm-cable-pulldown",
        setNumber: 2,
        setType: "drop",
        leftWeightKg: 30,
        leftReps: 8,
        rightWeightKg: 30,
        rightReps: 8,
        completedAt: Date.now(),
      });

      expect(unilateralDropSet.setType).toBe("drop");
      expect(unilateralDropSet.leftWeightKg).toBe(30);
      expect(unilateralDropSet.rightWeightKg).toBe(30);
    });
  });

  describe("Multi-Exercise Feed Structure", () => {
    it("groups multiple sets across different exercises within the same workout session", () => {
      const workoutId = "w_session_multi";
      const sets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId,
          exerciseId: "single-arm-45-pulldown",
          setNumber: 1,
          setType: "drop",
          weightKg: 40,
          reps: 10,
        }),
        createMockSet({
          id: "s2",
          workoutId,
          exerciseId: "single-arm-45-pulldown",
          setNumber: 2,
          setType: "standard",
          weightKg: 36,
          reps: 5,
        }),
        createMockSet({
          id: "s3",
          workoutId,
          exerciseId: "pullover-cable",
          setNumber: 1,
          setType: "standard",
          weightKg: 32,
          reps: 12,
        }),
        createMockSet({
          id: "s4",
          workoutId,
          exerciseId: "pullover-cable",
          setNumber: 2,
          setType: "drop",
          weightKg: 32,
          reps: 10,
        }),
      ];

      const ex1Sets = sets.filter((s) => s.exerciseId === "single-arm-45-pulldown");
      const ex2Sets = sets.filter((s) => s.exerciseId === "pullover-cable");

      expect(ex1Sets.length).toBe(2);
      expect(ex1Sets[0].setType).toBe("drop");
      expect(ex1Sets[1].setType).toBe("standard");

      expect(ex2Sets.length).toBe(2);
      expect(ex2Sets[0].setType).toBe("standard");
      expect(ex2Sets[1].setType).toBe("drop");
    });
  });

  describe("Proximity to Failure (RIR / RPE) Rating", () => {
    it("records 0 RIR as absolute failure with RPE 10", () => {
      const failureSet: WorkoutSet = createMockSet({
        id: "s_fail",
        workoutId: "w_fail",
        exerciseId: "bench-press",
        setNumber: 1,
        weightKg: 100,
        reps: 8,
        rir: 0,
        rpe: 10,
        completedAt: Date.now(),
      });

      expect(failureSet.rir).toBe(0);
      expect(failureSet.rpe).toBe(10);
      expect(failureSet.completedAt).toBeDefined();
    });

    it("records 2 RIR with RPE 8 for heavy working set", () => {
      const submaximalSet: WorkoutSet = createMockSet({
        id: "s_submax",
        workoutId: "w_submax",
        exerciseId: "bench-press",
        setNumber: 2,
        weightKg: 95,
        reps: 8,
        rir: 2,
        rpe: 8,
        completedAt: Date.now(),
      });

      expect(submaximalSet.rir).toBe(2);
      expect(submaximalSet.rpe).toBe(8);
    });
  });
});

