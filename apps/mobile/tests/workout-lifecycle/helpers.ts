import type { Workout, Set as WorkoutSet } from "../../db/schema";

export function createMockSet(overrides?: Partial<WorkoutSet>): WorkoutSet {
  const now = Date.now();
  return {
    id: `s_${Math.random().toString(36).slice(2, 9)}`,
    workoutId: "w_mock",
    exerciseId: "barbell-bench-press",
    setNumber: 1,
    setType: "standard",
    weightKg: 80,
    reps: 8,
    leftWeightKg: null,
    leftReps: null,
    rightWeightKg: null,
    rightReps: null,
    rpe: 8,
    rir: 2,
    durationSeconds: null,
    restSeconds: 90,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    deviceId: "device_test",
    isDeleted: false,
    ...overrides,
  };
}

export function createMockWorkout(overrides?: Partial<Workout>): Workout {
  const now = Date.now();
  return {
    id: `w_${Math.random().toString(36).slice(2, 9)}`,
    userId: "user_test",
    title: "Workout",
    templateId: null,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression",
    cadenceRate: "session",
    cadenceIncrementKg: 2.5,
    startedAt: now - 3600000,
    completedAt: null,
    notes: null,
    createdAt: now - 3600000,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
    ...overrides,
  };
}
