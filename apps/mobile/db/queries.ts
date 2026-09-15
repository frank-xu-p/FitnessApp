import { eq, ne, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db, ensureDbReady } from "./client";
import { exercises, workouts, sets, workoutTemplates, templateExercises } from "./schema";
import type { Workout, Set, Exercise, WorkoutTemplate, TemplateExercise } from "./schema";
import { generateUuid } from "../lib/id";
import { getDeviceId } from "../lib/device";
import { logMutation } from "./sync";
import { computeProgressionSuggestion, defaultRule } from "../lib/progression";
import type { WeightUnit } from "../lib/units";
import {
  effectiveWeightKg,
  effectiveReps,
  setVolumeKg,
} from "../lib/unilateral";

function likeQuery(query: string) {
  const q = `%${query.toLowerCase().trim()}%`;
  return sql`(lower(${exercises.name}) LIKE ${q} OR lower(${exercises.equipment}) LIKE ${q} OR lower(${exercises.primaryMuscles}) LIKE ${q})`;
}

export type ExerciseFilters = {
  query?: string;
  muscles?: string[];
  equipment?: string[];
};

export async function getExercises(filtersOrQuery?: string | ExerciseFilters) {
  await ensureDbReady();
  const conditions = [eq(exercises.isDeleted, false)];

  if (typeof filtersOrQuery === "string") {
    if (filtersOrQuery.trim().length > 0) {
      conditions.push(likeQuery(filtersOrQuery));
    }
  } else if (filtersOrQuery) {
    const { query, muscles, equipment } = filtersOrQuery;
    if (query && query.trim().length > 0) {
      conditions.push(likeQuery(query));
    }
    if (muscles && muscles.length > 0) {
      const muscleConditions = muscles.map(
        (m) => sql`lower(${exercises.primaryMuscles}) LIKE ${`%"${m.toLowerCase()}"%`}`
      );
      conditions.push(sql`(${sql.join(muscleConditions, sql` OR `)})`);
    }
    if (equipment && equipment.length > 0) {
      const eqConditions = equipment.map(
        (e) => sql`lower(${exercises.equipment}) LIKE ${`%${e.toLowerCase()}%`}`
      );
      conditions.push(sql`(${sql.join(eqConditions, sql` OR `)})`);
    }
  }

  return db.select().from(exercises).where(and(...conditions)).orderBy(asc(exercises.name));
}

export type ExercisePersonalRecords = {
  maxWeightKg: number | null;
  maxReps: number | null;
  maxEstimated1RMKg: number | null;
  maxVolumeKg: number | null;
  totalSetsCompleted: number;
  totalWorkoutsCount: number;
};

export async function getExercisePersonalRecords(
  exerciseId: string
): Promise<ExercisePersonalRecords> {
  await ensureDbReady();
  const history = await getExerciseHistory(exerciseId, 100);

  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let maxEstimated1RMKg: number | null = null;
  let maxVolumeKg: number | null = null;
  let totalSetsCompleted = 0;

  for (const session of history) {
    for (const s of session.sets) {
      if (s.completedAt != null) {
        totalSetsCompleted++;
        const w = effectiveWeightKg(s) ?? 0;
        const r = effectiveReps(s) ?? 0;

        if (w > 0 && (maxWeightKg === null || w > maxWeightKg)) {
          maxWeightKg = w;
        }
        if (r > 0 && (maxReps === null || r > maxReps)) {
          maxReps = r;
        }

        const vol = setVolumeKg(s);
        if (vol > 0 && (maxVolumeKg === null || vol > maxVolumeKg)) {
          maxVolumeKg = vol;
        }

        if (w > 0 && r > 0) {
          const e1rm = w * (1 + r / 30); // Epley formula
          if (maxEstimated1RMKg === null || e1rm > maxEstimated1RMKg) {
            maxEstimated1RMKg = Math.round(e1rm * 10) / 10;
          }
        }
      }
    }
  }

  return {
    maxWeightKg,
    maxReps,
    maxEstimated1RMKg,
    maxVolumeKg,
    totalSetsCompleted,
    totalWorkoutsCount: history.length,
  };
}

export type ExerciseSessionProgressPoint = {
  workoutId: string;
  date: number;
  title: string;
  topWeightKg: number;
  topReps: number;
  estimated1RMKg: number;
  totalVolumeKg: number;
  setsCount: number;
};

export async function getExerciseAnalytics(
  exerciseId: string
): Promise<ExerciseSessionProgressPoint[]> {
  await ensureDbReady();
  const history = await getExerciseHistory(exerciseId, 20);

  return history
    .map((session) => {
      const completed = session.sets.filter((s) => s.completedAt != null);
      if (completed.length === 0) return null;

      let topWeightKg = 0;
      let topReps = 0;
      let top1RM = 0;
      let totalVol = 0;

      for (const s of completed) {
        const w = effectiveWeightKg(s) ?? 0;
        const r = effectiveReps(s) ?? 0;
        totalVol += setVolumeKg(s);
        if (w > topWeightKg) {
          topWeightKg = w;
          topReps = r;
        }
        if (w > 0 && r > 0) {
          const e1rm = w * (1 + r / 30);
          if (e1rm > top1RM) top1RM = e1rm;
        }
      }

      return {
        workoutId: session.workoutId,
        date: session.date,
        title: session.title,
        topWeightKg,
        topReps,
        estimated1RMKg: Math.round(top1RM * 10) / 10,
        totalVolumeKg: totalVol,
        setsCount: completed.length,
      };
    })
    .filter(Boolean) as ExerciseSessionProgressPoint[];
}

export async function getExercise(id: string) {
  await ensureDbReady();
  const rows = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  return rows[0];
}

/**
 * Persists an exercise's tracking mode (bilateral/unilateral/alternating).
 * Used by the isolateral toggle in the workout screen so per-side input
 * mode survives remounts and app restarts.
 */
export async function updateExerciseTrackingMode(
  exerciseId: string,
  trackingMode: "bilateral" | "unilateral" | "alternating"
) {
  await ensureDbReady();
  const now = Date.now();
  const row = { trackingMode, updatedAt: now, clientTimestamp: now };
  await db.update(exercises).set(row).where(eq(exercises.id, exerciseId));
  await logMutation("exercises", exerciseId, "update", row);
}


export async function upsertExercise(
  payload: Partial<typeof exercises.$inferInsert> & { id?: string; name: string }
) {
  await ensureDbReady();
  const id = payload.id ?? generateUuid();
  const now = Date.now();
  const row = {
    ...payload,
    id,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: payload.isDeleted ?? false,
    createdAt: payload.createdAt ?? now,
  } as typeof exercises.$inferInsert;

  await db.insert(exercises).values(row).onConflictDoUpdate({
    target: exercises.id,
    set: row,
  });
  await logMutation("exercises", id, payload.id ? "update" : "insert", row);
  return row;
}


export async function getWorkouts(userId: string) {
  await ensureDbReady();
  return db
    .select()
    .from(workouts)
    .where(
      and(
        sql`(${workouts.userId} = ${userId} OR ${workouts.userId} = 'local')`,
        eq(workouts.isDeleted, false)
      )
    )
    .orderBy(desc(workouts.startedAt));
}

export type WorkoutHistoryItem = Workout & {
  sets: (Set & { exercise?: Exercise })[];
  exerciseNames: string[];
  totalVolumeKg: number;
  completedSetsCount: number;
  durationSeconds: number;
};

export async function getWorkoutsWithDetails(userId: string): Promise<WorkoutHistoryItem[]> {
  await ensureDbReady();
  const workoutRows = await db
    .select()
    .from(workouts)
    .where(
      and(
        sql`(${workouts.userId} = ${userId} OR ${workouts.userId} = 'local')`,
        eq(workouts.isDeleted, false)
      )
    )
    .orderBy(desc(workouts.startedAt));

  const results: WorkoutHistoryItem[] = [];

  for (const w of workoutRows) {
    const setRows = await db
      .select({
        s: sets,
        ex: exercises,
      })
      .from(sets)
      .leftJoin(exercises, eq(sets.exerciseId, exercises.id))
      .where(and(eq(sets.workoutId, w.id), eq(sets.isDeleted, false)))
      .orderBy(asc(sets.setNumber));

    const setsWithEx = setRows.map((r) => ({
      ...r.s,
      exercise: r.ex ?? undefined,
    }));

    const completed = setsWithEx.filter((s) => s.completedAt != null);
    const totalVolumeKg = completed.reduce((sum, s) => sum + setVolumeKg(s), 0);

    const distinctExerciseNames = Array.from(
      new Set(setsWithEx.map((s) => s.exercise?.name).filter(Boolean))
    ) as string[];

    const durationSeconds =
      w.completedAt && w.startedAt
        ? Math.max(0, Math.round((w.completedAt - w.startedAt) / 1000))
        : 0;

    results.push({
      ...w,
      sets: setsWithEx,
      exerciseNames: distinctExerciseNames,
      totalVolumeKg,
      completedSetsCount: completed.length,
      durationSeconds,
    });
  }

  return results;
}

export async function getWorkout(id: string) {
  await ensureDbReady();
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.isDeleted, false)))
    .limit(1);
  return rows[0];
}

export async function getWorkoutWithSets(id: string) {
  const workout = await getWorkout(id);
  if (!workout) return null;
  const setRows = await db
    .select()
    .from(sets)
    .where(and(eq(sets.workoutId, id), eq(sets.isDeleted, false)))
    .orderBy(asc(sets.setNumber));
  return { ...workout, sets: setRows };
}

export async function createWorkout(
  userId: string,
  title?: string,
  options?: {
    templateId?: string | null;
    autoOverloadEnabled?: boolean;
    cadenceModel?: "double_progression" | "rpe_autoregulated" | "linear";
    cadenceRate?: "session" | "weekly" | "biweekly";
    cadenceIncrementKg?: number | null;
  }
) {
  await ensureDbReady();
  const id = generateUuid();

  const now = Date.now();
  const row = {
    id,
    userId,
    title: title ?? "Workout",
    templateId: options?.templateId ?? null,
    autoOverloadEnabled: options?.autoOverloadEnabled ?? true,
    cadenceModel: options?.cadenceModel ?? "double_progression",
    cadenceRate: options?.cadenceRate ?? "session",
    cadenceIncrementKg: options?.cadenceIncrementKg ?? null,
    startedAt: now,
    completedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };
  await db.insert(workouts).values(row);
  await logMutation("workouts", id, "insert", row);
  return row;
}

export async function updateWorkout(id: string, patch: Partial<typeof workouts.$inferInsert>) {
  const now = Date.now();
  const row = { ...patch, updatedAt: now, clientTimestamp: now };
  await db.update(workouts).set(row).where(eq(workouts.id, id));
  await logMutation("workouts", id, "update", row);
}

export async function deleteWorkout(id: string) {
  await ensureDbReady();
  const now = Date.now();
  await db
    .update(workouts)
    .set({ isDeleted: true, updatedAt: now, clientTimestamp: now })
    .where(eq(workouts.id, id));
  await logMutation("workouts", id, "delete", { id, isDeleted: true, clientTimestamp: now });
}


export async function getSetsForWorkout(workoutId: string) {
  await ensureDbReady();
  return db
    .select()
    .from(sets)
    .where(and(eq(sets.workoutId, workoutId), eq(sets.isDeleted, false)))
    .orderBy(asc(sets.setNumber));
}

export async function createSet(
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  defaults: Partial<typeof sets.$inferInsert> = {}
): Promise<Set> {
  await ensureDbReady();
  const id = generateUuid();
  const now = Date.now();
  const deviceId = await getDeviceId();
  const row: Set = {
    id,
    workoutId,
    exerciseId,
    setNumber,
    setType: defaults.setType ?? "standard",
    weightKg: defaults.weightKg ?? null,
    reps: defaults.reps ?? null,
    leftWeightKg: defaults.leftWeightKg ?? null,
    leftReps: defaults.leftReps ?? null,
    rightWeightKg: defaults.rightWeightKg ?? null,
    rightReps: defaults.rightReps ?? null,
    rpe: defaults.rpe ?? null,
    rir: defaults.rir ?? null,
    durationSeconds: defaults.durationSeconds ?? null,
    restSeconds: defaults.restSeconds ?? null,
    completedAt: defaults.completedAt ?? null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    deviceId,
    isDeleted: false,
  };
  await db.insert(sets).values(row);
  await logMutation("sets", id, "insert", row);
  return row;
}

export async function updateSet(id: string, patch: Partial<typeof sets.$inferInsert>) {
  await ensureDbReady();
  const now = Date.now();
  const deviceId = await getDeviceId();
  const row = { ...patch, updatedAt: now, clientTimestamp: now, deviceId };
  await db.update(sets).set(row).where(eq(sets.id, id));
  await logMutation("sets", id, "update", row);
}

export async function deleteSet(id: string) {
  await ensureDbReady();
  const now = Date.now();
  const deviceId = await getDeviceId();
  await db
    .update(sets)
    .set({ isDeleted: true, updatedAt: now, clientTimestamp: now, deviceId })
    .where(eq(sets.id, id));
  await logMutation("sets", id, "delete", { id, isDeleted: true, clientTimestamp: now, deviceId });
}

/* ========================================================================= */
/*                              TEMPLATES QUERIES                            */
/* ========================================================================= */

export type TemplateWithExercises = WorkoutTemplate & {
  exercises: Array<
    TemplateExercise & {
      exercise: Exercise;
    }
  >;
};

export async function getTemplates(userId: string): Promise<TemplateWithExercises[]> {
  await ensureDbReady();
  const tplRows = await db
    .select()
    .from(workoutTemplates)
    .where(
      and(
        eq(workoutTemplates.isDeleted, false),
        // Allow templates for this user or standard local/global templates
        sql`(${workoutTemplates.userId} = ${userId} OR ${workoutTemplates.userId} = 'local')`
      )
    )
    .orderBy(desc(workoutTemplates.createdAt));

  const result: TemplateWithExercises[] = [];

  for (const tpl of tplRows) {
    const teRows = await db
      .select({
        te: templateExercises,
        ex: exercises,
      })
      .from(templateExercises)
      .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
      .where(
        and(
          eq(templateExercises.templateId, tpl.id),
          eq(templateExercises.isDeleted, false)
        )
      )
      .orderBy(asc(templateExercises.orderIndex));

    result.push({
      ...tpl,
      exercises: teRows.map((r) => ({
        ...r.te,
        exercise: r.ex,
      })),
    });
  }

  return result;
}

export async function getTemplateWithExercises(templateId: string): Promise<TemplateWithExercises | null> {
  await ensureDbReady();
  const tplRows = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.isDeleted, false)))
    .limit(1);


  if (tplRows.length === 0) return null;
  const tpl = tplRows[0];

  const teRows = await db
    .select({
      te: templateExercises,
      ex: exercises,
    })
    .from(templateExercises)
    .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(templateExercises.templateId, tpl.id),
        eq(templateExercises.isDeleted, false)
      )
    )
    .orderBy(asc(templateExercises.orderIndex));

  return {
    ...tpl,
    exercises: teRows.map((r) => ({
      ...r.te,
      exercise: r.ex,
    })),
  };
}

export async function createTemplate(
  userId: string,
  data: {
    name: string;
    notes?: string | null;
    category?: string;
    isPreset?: boolean;
    autoOverloadEnabled?: boolean;
    cadenceModel?: "double_progression" | "rpe_autoregulated" | "linear";
    cadenceRate?: "session" | "weekly" | "biweekly";
    cadenceIncrementKg?: number | null;
    exercises: Array<{
      exerciseId: string;
      orderIndex?: number;
      targetSets: number;
      targetReps?: number | null;
      targetWeightKg?: number | null;
      targetRpe?: number | null;
      restSeconds?: number | null;
      notes?: string | null;
    }>;
  }
): Promise<TemplateWithExercises> {
  await ensureDbReady();
  const templateId = generateUuid();
  const now = Date.now();

  const tplRow: WorkoutTemplate = {
    id: templateId,
    userId,
    name: data.name,
    notes: data.notes ?? null,
    category: data.category ?? "Custom",
    isPreset: data.isPreset ?? false,
    autoOverloadEnabled: data.autoOverloadEnabled ?? true,
    cadenceModel: data.cadenceModel ?? "double_progression",
    cadenceRate: data.cadenceRate ?? "session",
    cadenceIncrementKg: data.cadenceIncrementKg ?? null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };


  await db.insert(workoutTemplates).values(tplRow);

  const insertedExercises: Array<TemplateExercise & { exercise: Exercise }> = [];

  for (let i = 0; i < data.exercises.length; i++) {
    const exData = data.exercises[i];
    const teId = generateUuid();
    const teRow: TemplateExercise = {
      id: teId,
      templateId,
      exerciseId: exData.exerciseId,
      orderIndex: exData.orderIndex ?? i,
      targetSets: exData.targetSets || 3,
      targetReps: exData.targetReps ?? 10,
      targetWeightKg: exData.targetWeightKg ?? null,
      targetRpe: exData.targetRpe ?? 8,
      restSeconds: exData.restSeconds ?? 90,
      notes: exData.notes ?? null,
      createdAt: now,
      updatedAt: now,
      clientTimestamp: now,
      isDeleted: false,
    };

    await db.insert(templateExercises).values(teRow);
    const ex = await getExercise(exData.exerciseId);
    if (ex) {
      insertedExercises.push({
        ...teRow,
        exercise: ex,
      });
    }
  }

  return {
    ...tplRow,
    exercises: insertedExercises,
  };
}


export async function updateTemplate(
  templateId: string,
  data: {
    name?: string;
    notes?: string | null;
    category?: string;
    autoOverloadEnabled?: boolean;
    cadenceModel?: "double_progression" | "rpe_autoregulated" | "linear";
    cadenceRate?: "session" | "weekly" | "biweekly";
    cadenceIncrementKg?: number | null;
    exercises?: Array<{
      exerciseId: string;
      orderIndex?: number;
      targetSets: number;
      targetReps?: number | null;
      targetWeightKg?: number | null;
      targetRpe?: number | null;
      restSeconds?: number | null;
      notes?: string | null;
    }>;
  }
) {
  await ensureDbReady();
  const current = await getTemplateWithExercises(templateId);
  if (!current) throw new Error(`Template not found: ${templateId}`);

  if (current.isPreset) {
    return createTemplate(current.userId, {
      name: data.name ?? current.name,
      notes: data.notes !== undefined ? data.notes : current.notes,
      category: data.category ?? current.category,
      isPreset: false,
      autoOverloadEnabled:
        data.autoOverloadEnabled !== undefined
          ? data.autoOverloadEnabled
          : current.autoOverloadEnabled,
      cadenceModel: data.cadenceModel ?? current.cadenceModel,
      cadenceRate: data.cadenceRate ?? current.cadenceRate,
      cadenceIncrementKg:
        data.cadenceIncrementKg !== undefined
          ? data.cadenceIncrementKg
          : current.cadenceIncrementKg,
      exercises:
        data.exercises ??
        current.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          orderIndex: e.orderIndex,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          targetWeightKg: e.targetWeightKg,
          targetRpe: e.targetRpe,
          restSeconds: e.restSeconds,
          notes: e.notes,
        })),
    });
  }

  const now = Date.now();
  const patch: Partial<typeof workoutTemplates.$inferInsert> = {
    updatedAt: now,
    clientTimestamp: now,
  };

  if (data.name !== undefined) patch.name = data.name;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.category !== undefined) patch.category = data.category;
  if (data.autoOverloadEnabled !== undefined) patch.autoOverloadEnabled = data.autoOverloadEnabled;
  if (data.cadenceModel !== undefined) patch.cadenceModel = data.cadenceModel;
  if (data.cadenceRate !== undefined) patch.cadenceRate = data.cadenceRate;
  if (data.cadenceIncrementKg !== undefined) patch.cadenceIncrementKg = data.cadenceIncrementKg;

  await db.update(workoutTemplates).set(patch).where(eq(workoutTemplates.id, templateId));

  if (data.exercises) {
    // Soft-delete existing template exercises and insert new ones
    await db
      .update(templateExercises)
      .set({ isDeleted: true, updatedAt: now, clientTimestamp: now })
      .where(eq(templateExercises.templateId, templateId));

    for (let i = 0; i < data.exercises.length; i++) {
      const exData = data.exercises[i];
      await db.insert(templateExercises).values({
        id: generateUuid(),
        templateId,
        exerciseId: exData.exerciseId,
        orderIndex: exData.orderIndex ?? i,
        targetSets: exData.targetSets || 3,
        targetReps: exData.targetReps ?? 10,
        targetWeightKg: exData.targetWeightKg ?? null,
        targetRpe: exData.targetRpe ?? 8,
        restSeconds: exData.restSeconds ?? 90,
        notes: exData.notes ?? null,
        createdAt: now,
        updatedAt: now,
        clientTimestamp: now,
        isDeleted: false,
      });
    }
  }
}

/**
 * Updates only the target weights, reps, and RPE for existing exercises in a template,
 * preserving the template's structure.
 */
export async function updateTemplateValuesOnly(
  templateId: string,
  exerciseValues: Array<{
    exerciseId: string;
    targetWeightKg?: number | null;
    targetReps?: number | null;
    targetRpe?: number | null;
  }>
) {
  await ensureDbReady();
  const current = await getTemplateWithExercises(templateId);
  if (!current) throw new Error(`Template not found: ${templateId}`);

  if (current.isPreset) {
    return createTemplate(current.userId, {
      name: current.name,
      notes: current.notes,
      category: current.category,
      isPreset: false,
      autoOverloadEnabled: current.autoOverloadEnabled,
      cadenceModel: current.cadenceModel,
      cadenceRate: current.cadenceRate,
      cadenceIncrementKg: current.cadenceIncrementKg,
      exercises: current.exercises.map((e) => {
        const override = exerciseValues.find((v) => v.exerciseId === e.exerciseId);
        return {
          exerciseId: e.exerciseId,
          orderIndex: e.orderIndex,
          targetSets: e.targetSets,
          targetReps: override?.targetReps !== undefined ? override.targetReps : e.targetReps,
          targetWeightKg:
            override?.targetWeightKg !== undefined ? override.targetWeightKg : e.targetWeightKg,
          targetRpe: override?.targetRpe !== undefined ? override.targetRpe : e.targetRpe,
          restSeconds: e.restSeconds,
          notes: e.notes,
        };
      }),
    });
  }

  const now = Date.now();
  for (const item of exerciseValues) {
    const patch: Partial<typeof templateExercises.$inferInsert> = {
      updatedAt: now,
      clientTimestamp: now,
    };
    if (item.targetWeightKg !== undefined) patch.targetWeightKg = item.targetWeightKg;
    if (item.targetReps !== undefined) patch.targetReps = item.targetReps;
    if (item.targetRpe !== undefined) patch.targetRpe = item.targetRpe;

    await db
      .update(templateExercises)
      .set(patch)
      .where(
        and(
          eq(templateExercises.templateId, templateId),
          eq(templateExercises.exerciseId, item.exerciseId),
          eq(templateExercises.isDeleted, false)
        )
      );
  }

  await db
    .update(workoutTemplates)
    .set({ updatedAt: now, clientTimestamp: now })
    .where(eq(workoutTemplates.id, templateId));
}


export async function duplicateTemplate(
  templateId: string,
  userId: string,
  customName?: string
): Promise<TemplateWithExercises> {
  await ensureDbReady();
  const source = await getTemplateWithExercises(templateId);
  if (!source) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const name = customName ?? `${source.name} (Copy)`;
  return createTemplate(userId, {
    name,
    notes: source.notes,
    category: source.category,
    isPreset: false, // Duplicates are user custom templates
    autoOverloadEnabled: source.autoOverloadEnabled,
    cadenceModel: source.cadenceModel,
    cadenceRate: source.cadenceRate,
    cadenceIncrementKg: source.cadenceIncrementKg,
    exercises: source.exercises.map((te) => ({
      exerciseId: te.exerciseId,
      orderIndex: te.orderIndex,
      targetSets: te.targetSets,
      targetReps: te.targetReps,
      targetWeightKg: te.targetWeightKg,
      targetRpe: te.targetRpe,
      restSeconds: te.restSeconds,
      notes: te.notes,
    })),
  });
}

export async function deleteTemplate(templateId: string) {
  await ensureDbReady();
  const tpl = await getTemplateWithExercises(templateId);
  if (tpl?.isPreset) {
    throw new Error("Cannot delete a preset template");
  }
  const now = Date.now();
  await db
    .update(workoutTemplates)
    .set({ isDeleted: true, updatedAt: now, clientTimestamp: now })
    .where(eq(workoutTemplates.id, templateId));
}


/* ========================================================================= */
/*                     EXERCISE HISTORY & PROGRESSION                        */
/* ========================================================================= */

/**
 * Fetches previous session's completed sets for an exercise.
 */
export async function getExerciseHistory(
  exerciseId: string,
  limitWorkouts = 3,
  excludeWorkoutId?: string
) {
  await ensureDbReady();
  const conditions = [
    eq(sets.exerciseId, exerciseId),
    eq(sets.isDeleted, false),
    eq(workouts.isDeleted, false),
    sql`${sets.completedAt} IS NOT NULL`,
    sql`${workouts.completedAt} IS NOT NULL`,
  ];
  if (excludeWorkoutId) {
    conditions.push(ne(workouts.id, excludeWorkoutId));
  }

  // Find recent completed workouts with sets for this exercise
  const rows = await db
    .select({
      setId: sets.id,
      workoutId: sets.workoutId,
      setNumber: sets.setNumber,
      setType: sets.setType,
      weightKg: sets.weightKg,
      reps: sets.reps,
      leftWeightKg: sets.leftWeightKg,
      leftReps: sets.leftReps,
      rightWeightKg: sets.rightWeightKg,
      rightReps: sets.rightReps,
      rpe: sets.rpe,
      completedAt: sets.completedAt,
      workoutDate: workouts.startedAt,
      workoutTitle: workouts.title,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(and(...conditions))
    .orderBy(desc(workouts.startedAt), asc(sets.setNumber));


  // Group by workoutId
  const sessionsMap = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!sessionsMap.has(row.workoutId)) {
      if (sessionsMap.size >= limitWorkouts) break;
      sessionsMap.set(row.workoutId, []);
    }
    sessionsMap.get(row.workoutId)!.push(row);
  }

  return Array.from(sessionsMap.entries()).map(([workoutId, sessionSets]) => ({
    workoutId,
    date: sessionSets[0]?.workoutDate ?? Date.now(),
    title: sessionSets[0]?.workoutTitle ?? "Workout",
    sets: sessionSets,
  }));
}

/**
 * Starts a workout from an existing template, automatically applying progressive overload
 * if enabled on the template or requested.
 */
export async function createWorkoutFromTemplate(
  userId: string,
  templateId: string,
  autoOverloadEnabled = true,
  unit: WeightUnit = "kg"
) {
  const tpl = await getTemplateWithExercises(templateId);
  if (!tpl) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const workout = await createWorkout(userId, tpl.name, {
    templateId: tpl.id,
    autoOverloadEnabled,
    cadenceModel: tpl.cadenceModel,
    cadenceRate: tpl.cadenceRate,
    cadenceIncrementKg: tpl.cadenceIncrementKg,
  });

  const createdSets: Set[] = [];

  for (const te of tpl.exercises) {
    let startingWeight = te.targetWeightKg;
    let startingReps = te.targetReps ?? 10;

    if (autoOverloadEnabled) {
      const history = await getExerciseHistory(te.exerciseId, 1);
      if (history.length > 0 && history[0].sets.length > 0) {
        const lastSession = history[0].sets;
        // Find top working set (unilateral-aware: per-side data counts)
        const topSet = lastSession.reduce(
          (max, s) => ((effectiveWeightKg(s) ?? 0) > (effectiveWeightKg(max) ?? 0) ? s : max),
          lastSession[0]
        );

        const suggestion = computeProgressionSuggestion({
          lastWeightKg: effectiveWeightKg(topSet) ?? te.targetWeightKg ?? 0,
          lastReps: effectiveReps(topSet) ?? startingReps,
          lastRpe: topSet.rpe ?? te.targetRpe ?? 8,
          targetReps: te.targetReps ?? 8,
          targetRpe: te.targetRpe ?? 8,
          incrementKg: tpl.cadenceIncrementKg ?? undefined,
          equipment: te.exercise?.equipment,
          model: tpl.cadenceModel,
          cadenceRate: tpl.cadenceRate,
          lastSessionAt: history[0].date,
          unit,
        });

        if (suggestion.suggestedWeightKg > 0) {
          startingWeight = suggestion.suggestedWeightKg;
          startingReps = suggestion.suggestedReps;
        }
      }
    }

    const numSets = te.targetSets || 3;
    for (let setIdx = 1; setIdx <= numSets; setIdx++) {
      const createdSet = await createSet(workout.id, te.exerciseId, setIdx, {
        weightKg: startingWeight,
        reps: startingReps,
        setType: "standard",
      });
      createdSets.push(createdSet);
    }
  }

  return {
    workout,
    sets: createdSets,
    exercises: tpl.exercises.map((te) => te.exercise),
  };
}

/**
 * Saves a completed or in-progress workout as a reusable template.
 */
export async function saveWorkoutAsTemplate(
  workoutId: string,
  name: string,
  options?: {
    category?: string;
    notes?: string | null;
    autoOverloadEnabled?: boolean;
    cadenceModel?: "double_progression" | "rpe_autoregulated" | "linear";
    cadenceRate?: "session" | "weekly" | "biweekly";
  }
) {
  const workoutData = await getWorkoutWithSets(workoutId);
  if (!workoutData) throw new Error("Workout not found");

  // Group sets by exercise in order of first appearance
  const exerciseMap = new Map<string, typeof workoutData.sets>();
  for (const s of workoutData.sets) {
    if (!exerciseMap.has(s.exerciseId)) {
      exerciseMap.set(s.exerciseId, []);
    }
    exerciseMap.get(s.exerciseId)!.push(s);
  }

  const templateExercisesPayload: Array<{
    exerciseId: string;
    orderIndex: number;
    targetSets: number;
    targetReps: number;
    targetWeightKg: number | null;
    targetRpe: number | null;
  }> = [];

  let orderIndex = 0;
  for (const [exerciseId, exSets] of exerciseMap.entries()) {
    const completedSets = exSets.filter((s) => s.completedAt != null);
    const candidateSets = completedSets.length > 0 ? completedSets : exSets;

    // Pick top weight set or last set (unilateral-aware)
    const topSet = candidateSets.reduce(
      (max, s) => ((effectiveWeightKg(s) ?? 0) >= (effectiveWeightKg(max) ?? 0) ? s : max),
      candidateSets[0]
    );

    templateExercisesPayload.push({
      exerciseId,
      orderIndex,
      targetSets: exSets.length,
      targetReps: effectiveReps(topSet) ?? 10,
      targetWeightKg: effectiveWeightKg(topSet) ?? null,
      targetRpe: topSet?.rpe ?? 8,
    });
    orderIndex++;
  }

  return createTemplate(workoutData.userId, {
    name,
    category: options?.category ?? "Custom",
    notes: options?.notes ?? workoutData.notes,
    autoOverloadEnabled: options?.autoOverloadEnabled ?? workoutData.autoOverloadEnabled ?? true,
    cadenceModel: options?.cadenceModel ?? workoutData.cadenceModel ?? "double_progression",
    cadenceRate: options?.cadenceRate ?? workoutData.cadenceRate ?? "session",
    exercises: templateExercisesPayload,
  });
}
