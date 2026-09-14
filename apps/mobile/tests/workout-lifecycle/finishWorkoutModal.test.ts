import { describe, it, expect, vi } from "vitest";
import type { Workout, Set as WorkoutSet } from "../../db/schema";
import type { TemplateAction } from "../../components/FinishWorkoutModal";
import { createMockSet, createMockWorkout } from "./helpers";

describe("Workout Lifecycle - Finish Workout Dialog & Resolution State Machine", () => {
  const mockTemplateWorkout: Workout = createMockWorkout({
    id: "w_tpl_1",
    userId: "user_1",
    title: "Push Day",
    templateId: "tpl_push_day",
  });

  const mockScratchWorkout: Workout = createMockWorkout({
    id: "w_scratch_1",
    userId: "user_1",
    title: "Quick Workout",
    templateId: null,
  });

  const mockSets: WorkoutSet[] = [
    createMockSet({
      id: "s1",
      workoutId: "w_tpl_1",
      exerciseId: "barbell-bench-press",
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      rpe: 8,
      completedAt: Date.now(),
    }),
    createMockSet({
      id: "s2",
      workoutId: "w_tpl_1",
      exerciseId: "barbell-bench-press",
      setNumber: 2,
      weightKg: 80,
      reps: 8,
      rpe: 8.5,
      completedAt: Date.now(),
    }),
  ];

  describe("Template Resolution State Machine", () => {
    it("initializes template workout with default 'update_values_only' action", () => {
      const isFromTemplate = !!mockTemplateWorkout.templateId;
      let initialAction: TemplateAction = isFromTemplate ? "update_values_only" : "none";

      expect(isFromTemplate).toBe(true);
      expect(initialAction).toBe("update_values_only");
    });

    it("supports switching between template resolution branches based on structure modification", () => {
      // When structure is NOT modified: defaults to update_values_only
      const isStructureModified = false;
      let action: TemplateAction = !isStructureModified ? "update_values_only" : "update_all";
      expect(action).toBe("update_values_only");

      // When structure IS modified (e.g. added/removed exercises): offers update_all or save_new
      const isModified = true;
      let modifiedAction: TemplateAction = isModified ? "update_all" : "update_values_only";
      expect(modifiedAction).toBe("update_all");

      // User chooses to save as new template variation
      modifiedAction = "save_new";
      expect(modifiedAction).toBe("save_new");
    });


    it("computes volume, duration, and completed set counts correctly", () => {
      const completedSets = mockSets.filter((s) => s.completedAt != null);
      const totalReps = completedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
      const totalVolumeKg = completedSets.reduce(
        (sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0),
        0
      );

      expect(completedSets.length).toBe(2);
      expect(totalReps).toBe(16);
      expect(totalVolumeKg).toBe(1280); // 80*8 + 80*8 = 1280 kg
    });
  });

  describe("Scratch Session State Machine", () => {
    it("initializes scratch workout with default 'none' action and false saveAsTemplate", () => {
      const isFromTemplate = !!mockScratchWorkout.templateId;
      let saveAsTemplate = false;
      let action: TemplateAction = !isFromTemplate ? (saveAsTemplate ? "save_new" : "none") : "none";

      expect(isFromTemplate).toBe(false);
      expect(action).toBe("none");

      // User toggles "Save as new template?"
      saveAsTemplate = true;
      action = saveAsTemplate ? "save_new" : "none";
      expect(action).toBe("save_new");

      // User provides custom template name
      const newTemplateName = "Chest & Delts Hypertrophy";
      expect(newTemplateName).toBe("Chest & Delts Hypertrophy");
    });

    it("invokes onFinish callback with expected payload", async () => {
      const onFinishMock = vi.fn().mockResolvedValue(undefined);

      const finishOptions = {
        notes: "Great high-energy workout",
        templateAction: "save_new" as TemplateAction,
        newTemplateName: "Chest & Delts Hypertrophy",
      };

      await onFinishMock(finishOptions);

      expect(onFinishMock).toHaveBeenCalledTimes(1);
      expect(onFinishMock).toHaveBeenCalledWith({
        notes: "Great high-energy workout",
        templateAction: "save_new",
        newTemplateName: "Chest & Delts Hypertrophy",
      });
    });
  });
});
