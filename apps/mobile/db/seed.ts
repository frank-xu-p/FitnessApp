import { sql, and, eq, inArray } from "drizzle-orm";
import { exercises, sets, workoutTemplates, templateExercises } from "./schema";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import demoVideoSlugs from "../assets/data/demo-video-slugs.json";

/**
 * Ids of every exercise with a demo video (the bundle catalog). The app's
 * built-in catalog is exactly this set: nothing without a demo is seeded.
 */
function loadDemoCatalogIds(): Set<string> {
  return new Set(Object.keys(demoVideoSlugs));
}

/**
 * Starter-template / fallback ids that had no demo video, remapped to the
 * closest catalog exercise that does.
 */
const DEMO_ID_REMAP: Record<string, string> = {
  "barbell-bench-press": "Barbell_Bench_Press_-_Medium_Grip",
  "incline-dumbbell-press": "Incline_Dumbbell_Press",
  "lateral-raise": "Lateral_Raise_-_With_Bands",
  "triceps-pushdown": "bundle_cable_triceps_pushdown",
  deadlift: "bundle_dumbbell_deadlift",
  "lat-pulldown": "bundle_cable_pulldown",
  "barbell-row": "bundle_barbell_underhand_bent_over_row",
  "bicep-curl": "Dumbbell_Bicep_Curl",
  "back-squat": "Barbell_Squat",
  "romanian-deadlift": "Stiff-Legged_Barbell_Deadlift",
  "leg-extension": "Leg_Extensions",
  "overhead-press": "bundle_smith_seated_shoulder_press",
  "standing-calf-raises": "Standing_Calf_Raises",
};

type SourceExercise = {
  id?: string;
  name: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
  trackingMode?: string;
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
  const demoIds = loadDemoCatalogIds();
  // The built-in catalog is exactly the demo-video catalog: skip everything
  // without a demo.
  const dataset = loadExercises().filter((ex) =>
    demoIds.has(String(ex.id ?? ""))
  );
  const rows = dataset.map((ex, idx) => {
    return {
      id: String(ex.id ?? `ex_${idx}_${generateId()}`),
      name: ex.name,
      equipment: ex.equipment ?? null,
      primaryMuscles: ex.primaryMuscles ?? [],
      secondaryMuscles: ex.secondaryMuscles ?? [],
      cues: ex.instructions ?? [],
      // No remote photos: all built-in exercises use the in-house vector
      // mannequin renderer (offline-first, consistent style). imageUrl is
      // reserved for user-created media (e.g. GIFs from VideoImporter).
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
    };
  });

  // Ensure standard fallback IDs exist for preset templates (remapped to
  // demo-video catalog ids).
  for (const fb of FALLBACK_EXERCISES) {
    const demoId = (fb.id && DEMO_ID_REMAP[fb.id]) || fb.id;
    if (demoId && !rows.some((r) => r.id === demoId)) {
      rows.unshift({
        id: demoId,
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

const PRESET_TEMPLATE_IDS = [
  "tpl_push_day",
  "tpl_pull_day",
  "tpl_leg_day",
  "tpl_upper_body",
  "tpl_lower_body",
];

/**
 * Re-points the built-in preset templates at the demo-video catalog.
 * Only touches preset templates (which users cannot edit); custom templates
 * are left alone. Runs on every launch; idempotent.
 */
export async function remapPresetTemplateExercises(database: any) {
  for (const [oldId, newId] of Object.entries(DEMO_ID_REMAP)) {
    await database
      .update(templateExercises)
      .set({ exerciseId: newId })
      .where(
        and(
          eq(templateExercises.exerciseId, oldId),
          inArray(templateExercises.templateId, PRESET_TEMPLATE_IDS)
        )
      );
  }
}

/**
 * Removes built-in (source='base') exercises that have no demo video, so the
 * catalog is exactly the demo-video catalog. Never touches user-created
 * exercises, and never removes an exercise referenced by a logged set or a
 * template — history stays intact. Runs on every launch; idempotent.
 */
export async function pruneNonDemoExercises(database: any) {
  const demoIds = loadDemoCatalogIds();
  if (demoIds.size === 0) return;

  const [setRefs, tplRefs] = await Promise.all([
    database.select({ id: sets.exerciseId }).from(sets),
    database.select({ id: templateExercises.exerciseId }).from(templateExercises),
  ]);
  const referenced = new Set<string>([
    ...(setRefs as { id: string }[]).map((r) => r.id),
    ...(tplRefs as { id: string }[]).map((r) => r.id),
  ]);

  const baseRows = (await database
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.source, "base"))) as { id: string }[];

  const prunable = baseRows
    .map((r) => r.id)
    .filter((id) => !demoIds.has(id) && !referenced.has(id));

  const batchSize = 100;
  for (let i = 0; i < prunable.length; i += batchSize) {
    const batch = prunable.slice(i, i + batchSize);
    await database.delete(exercises).where(inArray(exercises.id, batch));
  }
}

/**
 * Seeds every exercise from the free animated demo bundle that isn't already
 * in the app catalog (assets/data/bundle-exercises.json). Idempotent: only
 * inserts ids missing from the exercises table, so it backfills existing
 * installs on next launch.
 */
export async function seedBundleExercises(database: any) {
  let dataset: SourceExercise[];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require("../assets/data/bundle-exercises.json");
    if (!Array.isArray(data) || data.length === 0) return;
    dataset = data;
  } catch {
    return;
  }

  const existing = await database
    .select({ id: exercises.id })
    .from(exercises);
  const have = new Set((existing as { id: string }[]).map((r) => r.id));

  const now = Date.now();
  const rows = dataset
    .filter((ex) => ex.id && !have.has(String(ex.id)))
    .map((ex) => ({
      id: String(ex.id),
      name: ex.name,
      equipment: ex.equipment ?? null,
      primaryMuscles: ex.primaryMuscles ?? [],
      secondaryMuscles: ex.secondaryMuscles ?? [],
      cues: ex.instructions ?? [],
      imageUrl: null,
      trackingMode:
        ex.trackingMode === "unilateral" ? ("unilateral" as const) : ("bilateral" as const),
      source: "base" as const,
      visibility: "global" as const,
      reviewStatus: "approved" as const,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      clientTimestamp: now,
      isDeleted: false,
    }));

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
      // Templates reference the demo-video catalog.
      const demoExerciseId = DEMO_ID_REMAP[ex.exerciseId] ?? ex.exerciseId;
      await database.insert(templateExercises).values({
        id: `te_${tpl.id}_${demoExerciseId}`,
        templateId: tpl.id,
        exerciseId: demoExerciseId,
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
