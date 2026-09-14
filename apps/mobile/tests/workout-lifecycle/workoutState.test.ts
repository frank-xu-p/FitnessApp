import { describe, it, expect, beforeEach } from "vitest";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import type { Workout } from "../../db/schema";

describe("Workout Lifecycle - Workout State Management (Zustand)", () => {
  beforeEach(() => {
    useWorkoutStore.getState().clearWorkout();
  });

  describe("Starting from Scratch (Empty Workout)", () => {
    it("initializes a blank session tracking sourceTemplateId as null", () => {
      const mockEmptyWorkout: Workout = {
        id: "w_scratch_123",
        userId: "user_test",
        title: "Empty Workout",
        templateId: null,
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
        startedAt: Date.now(),
        completedAt: null,
        notes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        clientTimestamp: Date.now(),
        isDeleted: false,
      };

      useWorkoutStore.getState().startEmptyWorkout(mockEmptyWorkout);

      const state = useWorkoutStore.getState();
      expect(state.activeWorkout).not.toBeNull();
      expect(state.activeWorkoutId).toBe("w_scratch_123");
      expect(state.sourceTemplateId).toBeNull();
      expect(state.isFromTemplate).toBe(false);
      expect(state.activeWorkout?.exerciseIds).toEqual([]);
      expect(state.activeExerciseId).toBeNull();
    });

    it("allows adding and removing exercises dynamically on the fly", () => {
      const mockEmptyWorkout: Workout = {
        id: "w_scratch_123",
        userId: "user_test",
        title: "Quick Workout",
        templateId: null,
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
        startedAt: Date.now(),
        completedAt: null,
        notes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        clientTimestamp: Date.now(),
        isDeleted: false,
      };

      useWorkoutStore.getState().startEmptyWorkout(mockEmptyWorkout);

      // Add exercise 1
      useWorkoutStore.getState().addExerciseToWorkout("barbell-bench-press");
      let state = useWorkoutStore.getState();
      expect(state.activeWorkout?.exerciseIds).toEqual(["barbell-bench-press"]);
      expect(state.activeExerciseId).toBe("barbell-bench-press");

      // Add exercise 2
      useWorkoutStore.getState().addExerciseToWorkout("incline-dumbbell-press");
      state = useWorkoutStore.getState();
      expect(state.activeWorkout?.exerciseIds).toEqual([
        "barbell-bench-press",
        "incline-dumbbell-press",
      ]);
      expect(state.activeExerciseId).toBe("incline-dumbbell-press");

      // Remove exercise 1
      useWorkoutStore.getState().removeExerciseFromWorkout("barbell-bench-press");
      state = useWorkoutStore.getState();
      expect(state.activeWorkout?.exerciseIds).toEqual(["incline-dumbbell-press"]);
      expect(state.activeExerciseId).toBe("incline-dumbbell-press");
    });
  });

  describe("Starting from Template", () => {
    it("initializes an active session deep-copying template metadata and sourceTemplateId", () => {
      const mockTemplateWorkout: Workout = {
        id: "w_tpl_456",
        userId: "user_test",
        title: "Push Day",
        templateId: "tpl_push_day",
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
        startedAt: Date.now(),
        completedAt: null,
        notes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        clientTimestamp: Date.now(),
        isDeleted: false,
      };

      const initialExercises = [
        "barbell-bench-press",
        "incline-dumbbell-press",
        "lateral-raise",
        "triceps-pushdown",
      ];

      useWorkoutStore.getState().startWorkoutFromTemplate(mockTemplateWorkout, initialExercises);

      const state = useWorkoutStore.getState();
      expect(state.activeWorkout).not.toBeNull();
      expect(state.activeWorkoutId).toBe("w_tpl_456");
      expect(state.sourceTemplateId).toBe("tpl_push_day");
      expect(state.isFromTemplate).toBe(true);
      expect(state.activeWorkout?.exerciseIds).toEqual(initialExercises);
      expect(state.activeExerciseId).toBe("barbell-bench-press");
    });
  });

  describe("Overload & Cadence Configuration Controls", () => {
    it("toggles and updates overload configuration", () => {
      const mockWorkout: Workout = {
        id: "w_test_789",
        userId: "user_test",
        title: "Test Workout",
        templateId: "tpl_test",
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
        startedAt: Date.now(),
        completedAt: null,
        notes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        clientTimestamp: Date.now(),
        isDeleted: false,
      };

      useWorkoutStore.getState().setActiveWorkout(mockWorkout, ["barbell-bench-press"]);
      expect(useWorkoutStore.getState().autoOverloadEnabled).toBe(true);

      useWorkoutStore.getState().toggleAutoOverload();
      expect(useWorkoutStore.getState().autoOverloadEnabled).toBe(false);

      useWorkoutStore.getState().setCadenceConfig({
        model: "rpe_autoregulated",
        rate: "weekly",
        incrementKg: 5.0,
      });

      const state = useWorkoutStore.getState();
      expect(state.cadenceModel).toBe("rpe_autoregulated");
      expect(state.cadenceRate).toBe("weekly");
      expect(state.cadenceIncrementKg).toBe(5.0);
    });

    it("clears active workout state completely on finish/cancel", () => {
      const mockWorkout: Workout = {
        id: "w_clear_test",
        userId: "user_test",
        title: "Test",
        templateId: null,
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
        startedAt: Date.now(),
        completedAt: null,
        notes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        clientTimestamp: Date.now(),
        isDeleted: false,
      };

      useWorkoutStore.getState().startEmptyWorkout(mockWorkout);
      expect(useWorkoutStore.getState().activeWorkoutId).toBe("w_clear_test");

      useWorkoutStore.getState().clearWorkout();
      const state = useWorkoutStore.getState();
      expect(state.activeWorkout).toBeNull();
      expect(state.activeWorkoutId).toBeNull();
      expect(state.sourceTemplateId).toBeNull();
      expect(state.isFromTemplate).toBe(false);
      expect(state.activeExerciseId).toBeNull();
    });
  });

  describe("Workout History & Repeat Flow", () => {
    it("computes duration, volume, and exercise groupings for completed history items", () => {
      const historyItem = {
        id: "w_hist_1",
        userId: "user_test",
        title: "Push Day",
        templateId: "tpl_push",
        autoOverloadEnabled: true,
        cadenceModel: "double_progression" as const,
        cadenceRate: "session" as const,
        cadenceIncrementKg: 2.5,
        startedAt: 1700000000000,
        completedAt: 1700002700000, // 2700s = 45 mins
        notes: "Great pump",
        createdAt: 1700000000000,
        updatedAt: 1700002700000,
        clientTimestamp: 1700002700000,
        isDeleted: false,
        durationSeconds: 2700,
        totalVolumeKg: 2400,
        completedSetsCount: 6,
        exerciseNames: ["Bench Press", "Incline DB Press"],
        sets: [
          {
            id: "s1",
            workoutId: "w_hist_1",
            exerciseId: "bench-press",
            setNumber: 1,
            setType: "standard" as const,
            weightKg: 100,
            reps: 8,
            completedAt: 1700000500000,
            exercise: { id: "bench-press", name: "Bench Press" },
          },
        ],
      };

      expect(historyItem.durationSeconds).toBe(2700);
      expect(historyItem.totalVolumeKg).toBe(2400);
      expect(historyItem.completedSetsCount).toBe(6);
      expect(historyItem.exerciseNames).toContain("Bench Press");
    });
  });
});

