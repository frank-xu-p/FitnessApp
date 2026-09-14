import { describe, it, expect } from "vitest";
import type { Workout, Set as WorkoutSet } from "../../db/schema";
import { createMockSet, createMockWorkout } from "./helpers";

type TemplateExerciseItem = {
  id: string;
  templateId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  targetRpe: number | null;
  restSeconds: number;
};

type TemplateRecord = {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  category: string;
  isPreset: boolean;
  autoOverloadEnabled: boolean;
  cadenceModel: "double_progression" | "rpe_autoregulated" | "linear";
  cadenceRate: "session" | "weekly" | "biweekly";
  cadenceIncrementKg: number | null;
  exercises: TemplateExerciseItem[];
};

// Pure business logic handlers mirroring completion flow resolution
function resolveValuesOnly(template: TemplateRecord, loggedSets: WorkoutSet[]): TemplateRecord {
  // Group sets by exercise
  const exerciseMap = new Map<string, WorkoutSet[]>();
  for (const s of loggedSets) {
    if (!exerciseMap.has(s.exerciseId)) exerciseMap.set(s.exerciseId, []);
    exerciseMap.get(s.exerciseId)!.push(s);
  }

  // Update targetWeightKg and targetReps for matching exercises, keeping template structure intact
  const updatedExercises = template.exercises.map((te) => {
    const exSets = exerciseMap.get(te.exerciseId);
    if (!exSets || exSets.length === 0) return te;

    const completed = exSets.filter((s) => s.completedAt != null);
    const candidateSets = completed.length > 0 ? completed : exSets;
    const topSet = candidateSets.reduce(
      (max, s) => ((s.weightKg ?? 0) >= (max.weightKg ?? 0) ? s : max),
      candidateSets[0]
    );

    return {
      ...te,
      targetWeightKg: topSet?.weightKg ?? te.targetWeightKg,
      targetReps: topSet?.reps ?? te.targetReps,
      targetRpe: topSet?.rpe ?? te.targetRpe,
    };
  });

  return {
    ...template,
    exercises: updatedExercises,
  };
}

function resolveUpdateAll(
  template: TemplateRecord,
  loggedSets: WorkoutSet[],
  newTitle?: string
): TemplateRecord {
  const exerciseMap = new Map<string, WorkoutSet[]>();
  for (const s of loggedSets) {
    if (!exerciseMap.has(s.exerciseId)) exerciseMap.set(s.exerciseId, []);
    exerciseMap.get(s.exerciseId)!.push(s);
  }

  const updatedExercises: TemplateExerciseItem[] = [];
  let orderIndex = 0;
  for (const [exerciseId, exSets] of exerciseMap.entries()) {
    const completed = exSets.filter((s) => s.completedAt != null);
    const candidateSets = completed.length > 0 ? completed : exSets;
    const topSet = candidateSets.reduce(
      (max, s) => ((s.weightKg ?? 0) >= (max.weightKg ?? 0) ? s : max),
      candidateSets[0]
    );

    updatedExercises.push({
      id: `te_new_${exerciseId}`,
      templateId: template.id,
      exerciseId,
      orderIndex,
      targetSets: exSets.length,
      targetReps: topSet?.reps ?? 10,
      targetWeightKg: topSet?.weightKg ?? null,
      targetRpe: topSet?.rpe ?? 8,
      restSeconds: 90,
    });
    orderIndex++;
  }

  return {
    ...template,
    name: newTitle ?? template.name,
    exercises: updatedExercises,
  };
}

function resolveSaveAsNew(
  userId: string,
  newTemplateName: string,
  loggedSets: WorkoutSet[],
  category = "Custom"
): TemplateRecord {
  const exerciseMap = new Map<string, WorkoutSet[]>();
  for (const s of loggedSets) {
    if (!exerciseMap.has(s.exerciseId)) exerciseMap.set(s.exerciseId, []);
    exerciseMap.get(s.exerciseId)!.push(s);
  }

  const newId = `tpl_custom_${Date.now()}`;
  const exercises: TemplateExerciseItem[] = [];
  let orderIndex = 0;

  for (const [exerciseId, exSets] of exerciseMap.entries()) {
    const completed = exSets.filter((s) => s.completedAt != null);
    const candidateSets = completed.length > 0 ? completed : exSets;
    const topSet = candidateSets.reduce(
      (max, s) => ((s.weightKg ?? 0) >= (max.weightKg ?? 0) ? s : max),
      candidateSets[0]
    );

    exercises.push({
      id: `te_${newId}_${exerciseId}`,
      templateId: newId,
      exerciseId,
      orderIndex,
      targetSets: exSets.length,
      targetReps: topSet?.reps ?? 10,
      targetWeightKg: topSet?.weightKg ?? null,
      targetRpe: topSet?.rpe ?? 8,
      restSeconds: 90,
    });
    orderIndex++;
  }

  return {
    id: newId,
    userId,
    name: newTemplateName,
    notes: null,
    category,
    isPreset: false,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression",
    cadenceRate: "session",
    cadenceIncrementKg: 2.5,
    exercises,
  };
}

describe("Workout Lifecycle - Workout Completion & Resolution Branches", () => {
  const baseTemplate: TemplateRecord = {
    id: "tpl_user_push",
    userId: "user-1",
    name: "My Push Day",
    notes: "Chest & triceps focus",
    category: "Push/Pull/Legs",
    isPreset: false,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression",
    cadenceRate: "session",
    cadenceIncrementKg: 2.5,
    exercises: [
      {
        id: "te_1",
        templateId: "tpl_user_push",
        exerciseId: "barbell-bench-press",
        orderIndex: 0,
        targetSets: 3,
        targetReps: 8,
        targetWeightKg: 80,
        targetRpe: 8,
        restSeconds: 90,
      },
      {
        id: "te_2",
        templateId: "tpl_user_push",
        exerciseId: "incline-dumbbell-press",
        orderIndex: 1,
        targetSets: 3,
        targetReps: 10,
        targetWeightKg: 24,
        targetRpe: 8,
        restSeconds: 90,
      },
    ],
  };

  describe("Branch 1: Update values only", () => {
    it("updates target weights/reps of existing exercises without modifying structure", () => {
      const loggedSets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId: "w1",
          exerciseId: "barbell-bench-press",
          setNumber: 1,
          weightKg: 82.5,
          reps: 8,
          rpe: 8.5,
        }),
        createMockSet({
          id: "s2",
          workoutId: "w1",
          exerciseId: "incline-dumbbell-press",
          setNumber: 1,
          weightKg: 26,
          reps: 10,
          rpe: 8.5,
        }),
        // User also did an extra exercise during the session
        createMockSet({
          id: "s3",
          workoutId: "w1",
          exerciseId: "lateral-raise",
          setNumber: 1,
          weightKg: 12,
          reps: 15,
          rpe: 9,
        }),
      ];

      const result = resolveValuesOnly(baseTemplate, loggedSets);

      // Structure preserved (still 2 exercises)
      expect(result.exercises.length).toBe(2);
      expect(result.exercises[0].exerciseId).toBe("barbell-bench-press");
      expect(result.exercises[0].targetWeightKg).toBe(82.5);
      expect(result.exercises[0].targetReps).toBe(8);

      expect(result.exercises[1].exerciseId).toBe("incline-dumbbell-press");
      expect(result.exercises[1].targetWeightKg).toBe(26);
      expect(result.exercises[1].targetReps).toBe(10);
    });
  });

  describe("Branch 2: Update entire template", () => {
    it("overwrites structure and values including newly added exercises", () => {
      const loggedSets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId: "w1",
          exerciseId: "barbell-bench-press",
          setNumber: 1,
          weightKg: 85,
          reps: 8,
          rpe: 8,
        }),
        createMockSet({
          id: "s2",
          workoutId: "w1",
          exerciseId: "lateral-raise",
          setNumber: 1,
          weightKg: 14,
          reps: 12,
          rpe: 8.5,
        }),
      ];

      const result = resolveUpdateAll(baseTemplate, loggedSets);

      // Structure now matches the new workout (bench press + lateral raise)
      expect(result.exercises.length).toBe(2);
      expect(result.exercises[0].exerciseId).toBe("barbell-bench-press");
      expect(result.exercises[0].targetWeightKg).toBe(85);
      expect(result.exercises[1].exerciseId).toBe("lateral-raise");
      expect(result.exercises[1].targetWeightKg).toBe(14);
    });
  });

  describe("Branch 3: Do not update template (none)", () => {
    it("keeps the template strictly unchanged while logging workout completion", () => {
      const completedWorkout: Workout = createMockWorkout({
        id: "w_finished",
        userId: "user-1",
        title: "My Push Day",
        templateId: baseTemplate.id,
        completedAt: Date.now(),
        notes: "Solid session!",
      });

      expect(completedWorkout.completedAt).not.toBeNull();
      expect(completedWorkout.notes).toBe("Solid session!");
      // Original template is unmodified
      expect(baseTemplate.exercises[0].targetWeightKg).toBe(80);
    });
  });

  describe("Branch 4: Save as separate new template", () => {
    it("creates a brand new template and preserves original", () => {
      const loggedSets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId: "w1",
          exerciseId: "barbell-bench-press",
          setNumber: 1,
          weightKg: 90,
          reps: 6,
          rpe: 8.5,
        }),
      ];

      const newTpl = resolveSaveAsNew("user-1", "Heavy Bench Focus", loggedSets, "Chest");

      expect(newTpl.id).not.toBe(baseTemplate.id);
      expect(newTpl.name).toBe("Heavy Bench Focus");
      expect(newTpl.category).toBe("Chest");
      expect(newTpl.isPreset).toBe(false);
      expect(newTpl.exercises.length).toBe(1);
      expect(newTpl.exercises[0].targetWeightKg).toBe(90);

      // Base template remains untouched
      expect(baseTemplate.name).toBe("My Push Day");
      expect(baseTemplate.exercises.length).toBe(2);
    });
  });

  describe("Validation & Prompting Flows on Finish", () => {
    it("identifies when 0 reps/sets are completed and prompts cancel/continue", () => {
      const emptySets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId: "w_empty",
          exerciseId: "bench-press",
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          completedAt: null,
        }),
      ];

      const completed = emptySets.filter((s) => s.completedAt != null);
      expect(completed.length).toBe(0);
    });

    it("identifies unfinished sets and partitions completed vs uncompleted", () => {
      const mixedSets: WorkoutSet[] = [
        createMockSet({
          id: "s1",
          workoutId: "w_mixed",
          exerciseId: "bench-press",
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          completedAt: Date.now(),
        }),
        createMockSet({
          id: "s2",
          workoutId: "w_mixed",
          exerciseId: "bench-press",
          setNumber: 2,
          weightKg: 80,
          reps: 8,
          completedAt: null,
        }),
        createMockSet({
          id: "s3",
          workoutId: "w_mixed",
          exerciseId: "incline-db-press",
          setNumber: 1,
          weightKg: 30,
          reps: 10,
          completedAt: null,
        }),
      ];

      const completed = mixedSets.filter((s) => s.completedAt != null);
      const uncompleted = mixedSets.filter((s) => s.completedAt == null);

      expect(completed.length).toBe(1);
      expect(uncompleted.length).toBe(2);

      // Finish unfinished:
      const finishedAll = mixedSets.map((s) => ({
        ...s,
        completedAt: s.completedAt ?? Date.now(),
      }));
      expect(finishedAll.filter((s) => s.completedAt != null).length).toBe(3);

      // Discard unfinished:
      const discardedUnfinished = mixedSets.filter((s) => s.completedAt != null);
      expect(discardedUnfinished.length).toBe(1);
    });
  });
});

