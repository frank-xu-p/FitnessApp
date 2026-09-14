import { create } from "zustand";
import type { Workout, Exercise, Set } from "../db/schema";
import type { ProgressionModel, CadenceRate } from "../lib/progression";

export type ActiveWorkoutState = Workout & {
  exerciseIds: string[];
  sourceTemplateId: string | null;
};

type WorkoutStore = {
  activeWorkout: ActiveWorkoutState | null;
  activeExerciseId: string | null;
  autoOverloadEnabled: boolean;
  cadenceModel: ProgressionModel;
  cadenceRate: CadenceRate;
  cadenceIncrementKg: number | null;

  // Selectors / Helpers
  activeWorkoutId: string | null;
  sourceTemplateId: string | null;
  isFromTemplate: boolean;

  setActiveWorkout: (workout: Workout | null, initialExerciseIds?: string[]) => void;
  startEmptyWorkout: (workout: Workout) => void;
  startWorkoutFromTemplate: (workout: Workout, initialExerciseIds: string[]) => void;
  setActiveExerciseId: (id: string | null) => void;
  addExerciseToWorkout: (exerciseId: string) => void;
  removeExerciseFromWorkout: (exerciseId: string) => void;
  toggleAutoOverload: () => void;
  setAutoOverload: (enabled: boolean) => void;
  setCadenceConfig: (config: {
    model?: ProgressionModel;
    rate?: CadenceRate;
    incrementKg?: number | null;
  }) => void;
  clearWorkout: () => void;
};

export const useWorkoutStore = create<WorkoutStore>()((set, get) => ({
  activeWorkout: null,
  activeExerciseId: null,
  autoOverloadEnabled: true,
  cadenceModel: "double_progression",
  cadenceRate: "session",
  cadenceIncrementKg: 2.5,

  activeWorkoutId: null,
  sourceTemplateId: null,
  isFromTemplate: false,

  setActiveWorkout: (workout, initialExerciseIds = []) =>
    set((state) => {
      const activeState: ActiveWorkoutState | null = workout
        ? {
            ...workout,
            sourceTemplateId: workout.templateId ?? null,
            exerciseIds:
              initialExerciseIds.length > 0
                ? Array.from(new Set(initialExerciseIds))
                : state.activeWorkout?.id === workout.id
                ? state.activeWorkout.exerciseIds
                : [],
          }
        : null;

      return {
        activeWorkout: activeState,
        activeWorkoutId: workout?.id ?? null,
        sourceTemplateId: workout?.templateId ?? null,
        isFromTemplate: !!workout?.templateId,
        autoOverloadEnabled: workout ? (workout.autoOverloadEnabled ?? true) : true,
        cadenceModel: workout ? (workout.cadenceModel ?? "double_progression") : "double_progression",
        cadenceRate: workout ? (workout.cadenceRate ?? "session") : "session",
        cadenceIncrementKg: workout ? (workout.cadenceIncrementKg ?? 2.5) : 2.5,
      };
    }),

  startEmptyWorkout: (workout) =>
    set(() => ({
      activeWorkout: {
        ...workout,
        sourceTemplateId: null,
        exerciseIds: [],
      },
      activeWorkoutId: workout.id,
      sourceTemplateId: null,
      isFromTemplate: false,
      activeExerciseId: null,
      autoOverloadEnabled: workout.autoOverloadEnabled ?? true,
      cadenceModel: workout.cadenceModel ?? "double_progression",
      cadenceRate: workout.cadenceRate ?? "session",
      cadenceIncrementKg: workout.cadenceIncrementKg ?? 2.5,
    })),

  startWorkoutFromTemplate: (workout, initialExerciseIds) => {
    const exIds = Array.from(new Set(initialExerciseIds));
    set(() => ({
      activeWorkout: {
        ...workout,
        sourceTemplateId: workout.templateId ?? null,
        exerciseIds: exIds,
      },
      activeWorkoutId: workout.id,
      sourceTemplateId: workout.templateId ?? null,
      isFromTemplate: !!workout.templateId,
      activeExerciseId: exIds[0] ?? null,
      autoOverloadEnabled: workout.autoOverloadEnabled ?? true,
      cadenceModel: workout.cadenceModel ?? "double_progression",
      cadenceRate: workout.cadenceRate ?? "session",
      cadenceIncrementKg: workout.cadenceIncrementKg ?? 2.5,
    }));
  },

  setActiveExerciseId: (activeExerciseId) => set({ activeExerciseId }),

  addExerciseToWorkout: (exerciseId) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const ids = new Set(state.activeWorkout.exerciseIds);
      ids.add(exerciseId);
      return {
        activeWorkout: { ...state.activeWorkout, exerciseIds: Array.from(ids) },
        activeExerciseId: exerciseId,
      };
    }),

  removeExerciseFromWorkout: (exerciseId) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const filtered = state.activeWorkout.exerciseIds.filter((id) => id !== exerciseId);
      return {
        activeWorkout: { ...state.activeWorkout, exerciseIds: filtered },
        activeExerciseId:
          state.activeExerciseId === exerciseId ? filtered[0] ?? null : state.activeExerciseId,
      };
    }),

  toggleAutoOverload: () =>
    set((state) => ({
      autoOverloadEnabled: !state.autoOverloadEnabled,
    })),

  setAutoOverload: (enabled) =>
    set({
      autoOverloadEnabled: enabled,
    }),

  setCadenceConfig: (config) =>
    set((state) => ({
      cadenceModel: config.model ?? state.cadenceModel,
      cadenceRate: config.rate ?? state.cadenceRate,
      cadenceIncrementKg:
        config.incrementKg !== undefined ? config.incrementKg : state.cadenceIncrementKg,
    })),

  clearWorkout: () =>
    set({
      activeWorkout: null,
      activeWorkoutId: null,
      sourceTemplateId: null,
      isFromTemplate: false,
      activeExerciseId: null,
    }),
}));
