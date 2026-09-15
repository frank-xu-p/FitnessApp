import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Workout, Exercise, Set } from "../db/schema";
import type { ProgressionModel, CadenceRate } from "../lib/progression";
// NOTE: db/queries is imported dynamically inside hydrateActiveWorkout.
// expo-sqlite's build uses syntax this repo's Vitest/Vite toolchain cannot
// parse in Node, so a static import would break the store's test suite.

/**
 * Persisted across cold starts so an unfinished workout can be offered
 * for resume (B3). Only the workout id is stored; the row itself is
 * re-validated from SQLite on boot (never restores completed/deleted).
 */
const ACTIVE_WORKOUT_STORAGE_KEY = "@fitnessapp:active_workout_id";

async function persistActiveWorkoutId(id: string | null) {
  try {
    if (id) {
      await AsyncStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to persist active workout id", err);
  }
}

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
  /**
   * Cold-start recovery (B3): restores the persisted active workout if it
   * still exists and is unfinished in SQLite. Returns the workout id when
   * resumed, null otherwise.
   */
  hydrateActiveWorkout: () => Promise<string | null>;
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

  setActiveWorkout: (workout, initialExerciseIds = []) => {
    void persistActiveWorkoutId(workout?.id ?? null);
    return set((state) => {
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
    });
  },

  startEmptyWorkout: (workout) => {
    void persistActiveWorkoutId(workout.id);
    return set(() => ({
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
    }));
  },

  startWorkoutFromTemplate: (workout, initialExerciseIds) => {
    const exIds = Array.from(new Set(initialExerciseIds));
    void persistActiveWorkoutId(workout.id);
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

  hydrateActiveWorkout: async () => {
    try {
      const storedId = await AsyncStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
      if (!storedId) return null;
      // Dynamic import: keeps expo-sqlite out of the store's static module
      // graph so the Zustand unit tests can run under Vitest/Node.
      const { getWorkout, getSetsForWorkout } = await import("../db/queries");
      // getWorkout filters deleted rows; also refuse completed ones.
      const workout = await getWorkout(storedId);
      if (!workout || workout.completedAt != null) {
        await AsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
        return null;
      }
      const rows = await getSetsForWorkout(workout.id);
      const exIds = Array.from(new Set(rows.map((s) => s.exerciseId)));
      get().setActiveWorkout(workout, exIds);
      return workout.id;
    } catch (err) {
      console.warn("Failed to hydrate active workout", err);
      return null;
    }
  },

  clearWorkout: () => {
    void persistActiveWorkoutId(null);
    return set({
      activeWorkout: null,
      activeWorkoutId: null,
      sourceTemplateId: null,
      isFromTemplate: false,
      activeExerciseId: null,
    });
  },
}));
