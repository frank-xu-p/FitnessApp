import { create } from "zustand";
import type { Workout, Exercise, Set } from "../db/schema";

type WorkoutState = {
  activeWorkout: (Workout & { exerciseIds: string[] }) | null;
  activeExerciseId: string | null;
  setActiveWorkout: (workout: Workout | null) => void;
  setActiveExerciseId: (id: string | null) => void;
  addExerciseToWorkout: (exerciseId: string) => void;
};

export const useWorkoutStore = create<WorkoutState>()((set) => ({
  activeWorkout: null,
  activeExerciseId: null,
  setActiveWorkout: (workout) =>
    set({
      activeWorkout: workout
        ? { ...workout, exerciseIds: [] }
        : null,
    }),
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
}));
