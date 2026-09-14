import { sql } from "drizzle-orm";
import { exercises, workoutTemplates, templateExercises } from "./schema";

type SourceExercise = {
  id?: string;
  name: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
};

export const FALLBACK_EXERCISES: SourceExercise[] = [
  {
    id: "barbell-bench-press",
    name: "Barbell Bench Press",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: ["Lie on a bench", "Lower the bar to mid-chest", "Press to lockout"],
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    equipment: "dumbbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: ["Set incline to 30-45 degrees", "Press dumbbells up with control", "Lower to chest level"],
  },
  {
    id: "lateral-raise",
    name: "Dumbbell Lateral Raise",
    equipment: "dumbbell",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["traps"],
    instructions: ["Stand with dumbbells at sides", "Raise arms laterally to shoulder height", "Lower slowly"],
  },
  {
    id: "triceps-pushdown",
    name: "Triceps Pushdown",
    equipment: "cable",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    instructions: ["Grip rope or bar attachment", "Extend elbows downward", "Squeeze triceps at lockout"],
  },
  {
    id: "deadlift",
    name: "Deadlift",
    equipment: "barbell",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["glutes", "back"],
    instructions: ["Hinge and grip the bar", "Push the floor away", "Stand tall"],
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    equipment: "cable",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps"],
    instructions: ["Grip the bar wide", "Pull to upper chest", "Control the return"],
  },
  {
    id: "barbell-row",
    name: "Barbell Row",
    equipment: "barbell",
    primaryMuscles: ["lats", "back"],
    secondaryMuscles: ["biceps", "posterior delts"],
    instructions: ["Hinge forward at 45 degrees", "Pull bar into lower ribcage", "Lower under control"],
  },
  {
    id: "bicep-curl",
    name: "Dumbbell Bicep Curl",
    equipment: "dumbbell",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    instructions: ["Stand tall with dumbbells", "Curl weights towards shoulders", "Lower slowly"],
  },
  {
    id: "back-squat",
    name: "Barbell Squat",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Bar on upper back", "Sit down between your hips", "Stand up"],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    equipment: "barbell",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["lower back"],
    instructions: ["Hold barbell at hips", "Push hips backward keeping slight knee bend", "Drive hips forward to stand"],
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    equipment: "machine",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: [],
    instructions: ["Sit in machine with pad against shins", "Extend legs until straight", "Lower slowly"],
  },
  {
    id: "standing-calf-raises",
    name: "Standing Calf Raise",
    equipment: "machine",
    primaryMuscles: ["calves"],
    secondaryMuscles: [],
    instructions: ["Balls of feet on step", "Raise heels up onto toes", "Lower heels below step for stretch"],
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    equipment: "barbell",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps"],
    instructions: ["Bar at shoulder height", "Press overhead", "Lock out"],
  },
];

function loadExercises(): SourceExercise[] {
  try {
    const data = require("../assets/data/exercises.json");
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (err) {
    try {
      const data2 = require("../../packages/db-schema/data/exercises.json");
      if (Array.isArray(data2) && data2.length > 0) return data2;
    } catch {
      // Dataset is missing; fall back to core list.
    }
  }
  return FALLBACK_EXERCISES;
}

export async function seedBaseExercises(database: any) {
  const existing = await database
    .select({ count: sql<number>`count(*)` })
    .from(exercises);
  if ((existing[0]?.count ?? 0) >= 800) return;

  const now = Date.now();
  const dataset = loadExercises();
  const rows = dataset.map((ex, idx) => {
    const primaryImg = (ex.images ?? [])[0];
    return {
      id: String(ex.id ?? `ex_${idx}_${generateId()}`),
      name: ex.name,
      equipment: ex.equipment ?? null,
      primaryMuscles: ex.primaryMuscles ?? [],
      secondaryMuscles: ex.secondaryMuscles ?? [],
      cues: ex.instructions ?? [],
      imageUrl: primaryImg
        ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${primaryImg}`
        : null,
      trackingMode: "bilateral" as const,
      source: "base" as const,
      visibility: "global" as const,
      reviewStatus: "approved" as const,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      clientTimestamp: now,
      isDeleted: false,
    };
  });

  // Ensure standard fallback IDs exist for preset templates
  for (const fb of FALLBACK_EXERCISES) {
    if (fb.id && !rows.some((r) => r.id === fb.id)) {
      rows.unshift({
        id: fb.id,
        name: fb.name,
        equipment: fb.equipment ?? null,
        primaryMuscles: fb.primaryMuscles ?? [],
        secondaryMuscles: fb.secondaryMuscles ?? [],
        cues: fb.instructions ?? [],
        imageUrl: null,
        trackingMode: "bilateral" as const,
        source: "base" as const,
        visibility: "global" as const,
        reviewStatus: "approved" as const,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        clientTimestamp: now,
        isDeleted: false,
      });
    }
  }

  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    await database
      .insert(exercises)
      .values(rows.slice(i, i + batchSize))
      .onConflictDoNothing();
  }
}


export const PRESET_TEMPLATES = [
  {
    id: "tpl_push_day",
    userId: "local",
    name: "Push Day",
    notes: "Focus on chest, front/side delts, and triceps.",
    category: "Push/Pull/Legs",
    isPreset: true,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression" as const,
    cadenceRate: "session" as const,
    cadenceIncrementKg: 2.5,
    exercises: [
      { exerciseId: "barbell-bench-press", orderIndex: 0, targetSets: 3, targetReps: 8, targetWeightKg: 60, targetRpe: 8 },
      { exerciseId: "incline-dumbbell-press", orderIndex: 1, targetSets: 3, targetReps: 10, targetWeightKg: 22, targetRpe: 8 },
      { exerciseId: "lateral-raise", orderIndex: 2, targetSets: 3, targetReps: 12, targetWeightKg: 10, targetRpe: 8.5 },
      { exerciseId: "triceps-pushdown", orderIndex: 3, targetSets: 3, targetReps: 12, targetWeightKg: 25, targetRpe: 8.5 },
    ],
  },
  {
    id: "tpl_pull_day",
    userId: "local",
    name: "Pull Day",
    notes: "Focus on upper back, lats, posterior chain, and biceps.",
    category: "Push/Pull/Legs",
    isPreset: true,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression" as const,
    cadenceRate: "session" as const,
    cadenceIncrementKg: 2.5,
    exercises: [
      { exerciseId: "deadlift", orderIndex: 0, targetSets: 3, targetReps: 5, targetWeightKg: 100, targetRpe: 8 },
      { exerciseId: "lat-pulldown", orderIndex: 1, targetSets: 3, targetReps: 10, targetWeightKg: 50, targetRpe: 8 },
      { exerciseId: "barbell-row", orderIndex: 2, targetSets: 3, targetReps: 8, targetWeightKg: 55, targetRpe: 8 },
      { exerciseId: "bicep-curl", orderIndex: 3, targetSets: 3, targetReps: 12, targetWeightKg: 14, targetRpe: 8.5 },
    ],
  },
  {
    id: "tpl_leg_day",
    userId: "local",
    name: "Leg Day",
    notes: "Lower body strength and hypertrophy targeting quads, hamstrings, glutes, and calves.",
    category: "Push/Pull/Legs",
    isPreset: true,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression" as const,
    cadenceRate: "session" as const,
    cadenceIncrementKg: 2.5,
    exercises: [
      { exerciseId: "back-squat", orderIndex: 0, targetSets: 4, targetReps: 8, targetWeightKg: 80, targetRpe: 8 },
      { exerciseId: "romanian-deadlift", orderIndex: 1, targetSets: 3, targetReps: 10, targetWeightKg: 70, targetRpe: 8 },
      { exerciseId: "leg-extension", orderIndex: 2, targetSets: 3, targetReps: 12, targetWeightKg: 40, targetRpe: 8.5 },
      { exerciseId: "standing-calf-raises", orderIndex: 3, targetSets: 4, targetReps: 15, targetWeightKg: 50, targetRpe: 8.5 },
    ],
  },
  {
    id: "tpl_upper_body",
    userId: "local",
    name: "Upper Body",
    notes: "Complete upper body strength and hypertrophy foundation.",
    category: "Upper/Lower",
    isPreset: true,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression" as const,
    cadenceRate: "session" as const,
    cadenceIncrementKg: 2.5,
    exercises: [
      { exerciseId: "barbell-bench-press", orderIndex: 0, targetSets: 3, targetReps: 8, targetWeightKg: 60, targetRpe: 8 },
      { exerciseId: "lat-pulldown", orderIndex: 1, targetSets: 3, targetReps: 10, targetWeightKg: 50, targetRpe: 8 },
      { exerciseId: "overhead-press", orderIndex: 2, targetSets: 3, targetReps: 8, targetWeightKg: 40, targetRpe: 8 },
      { exerciseId: "barbell-row", orderIndex: 3, targetSets: 3, targetReps: 8, targetWeightKg: 50, targetRpe: 8 },
      { exerciseId: "bicep-curl", orderIndex: 4, targetSets: 3, targetReps: 12, targetWeightKg: 12, targetRpe: 8 },
      { exerciseId: "triceps-pushdown", orderIndex: 5, targetSets: 3, targetReps: 12, targetWeightKg: 20, targetRpe: 8 },
    ],
  },
  {
    id: "tpl_lower_body",
    userId: "local",
    name: "Lower Body",
    notes: "Complete lower body strength and hypertrophy foundation.",
    category: "Upper/Lower",
    isPreset: true,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression" as const,
    cadenceRate: "weekly" as const,
    cadenceIncrementKg: 2.5,
    exercises: [
      { exerciseId: "back-squat", orderIndex: 0, targetSets: 3, targetReps: 8, targetWeightKg: 75, targetRpe: 8 },
      { exerciseId: "romanian-deadlift", orderIndex: 1, targetSets: 3, targetReps: 8, targetWeightKg: 65, targetRpe: 8 },
      { exerciseId: "leg-extension", orderIndex: 2, targetSets: 3, targetReps: 12, targetWeightKg: 35, targetRpe: 8 },
      { exerciseId: "standing-calf-raises", orderIndex: 3, targetSets: 3, targetReps: 15, targetWeightKg: 45, targetRpe: 8 },
    ],
  },
];

export async function seedStarterTemplates(database: any) {
  const existing = await database
    .select({ count: sql<number>`count(*)` })
    .from(workoutTemplates);
  if ((existing[0]?.count ?? 0) > 0) return;

  const now = Date.now();

  for (const tpl of PRESET_TEMPLATES) {
    const { exercises: tplExercises, ...tplRow } = tpl;
    await database.insert(workoutTemplates).values({
      ...tplRow,
      createdAt: now,
      updatedAt: now,
      clientTimestamp: now,
      isDeleted: false,
    });
    for (const ex of tplExercises) {
      await database.insert(templateExercises).values({
        id: `te_${tpl.id}_${ex.exerciseId}`,
        templateId: tpl.id,
        exerciseId: ex.exerciseId,
        orderIndex: ex.orderIndex,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeightKg: ex.targetWeightKg,
        targetRpe: ex.targetRpe,
        restSeconds: 90,
        createdAt: now,
        updatedAt: now,
        clientTimestamp: now,
        isDeleted: false,
      });
    }
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
