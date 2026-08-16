import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "./client";
import { exercises, workouts, sets } from "./schema";
import { generateUuid } from "../lib/id";
import { getDeviceId } from "../lib/device";
import { logMutation } from "./sync";

function likeQuery(query: string) {
  return sql`lower(${exercises.name}) LIKE ${`%${query.toLowerCase()}%`}`;
}

export async function getExercises(query?: string) {
  const conditions = [eq(exercises.isDeleted, false)];
  if (query) {
    conditions.push(likeQuery(query));
  }
  return db.select().from(exercises).where(and(...conditions));
}

export async function getExercise(id: string) {
  const rows = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  return rows[0];
}

export async function upsertExercise(
  payload: Partial<typeof exercises.$inferInsert> & { id?: string }
) {
  const id = payload.id ?? generateUuid();
  const now = Date.now();
  const row = {
    ...payload,
    id,
    updatedAt: now,
    clientTimestamp: now,
  } as typeof exercises.$inferInsert;

  await db.insert(exercises).values(row).onConflictDoUpdate({
    target: exercises.id,
    set: row,
  });
  await logMutation("exercises", id, payload.id ? "update" : "insert", row);
  return row;
}

export async function getWorkouts(userId: string) {
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.isDeleted, false)))
    .orderBy(desc(workouts.startedAt));
}

export async function getWorkout(id: string) {
  const rows = await db.select().from(workouts).where(eq(workouts.id, id)).limit(1);
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

export async function createWorkout(userId: string, title?: string) {
  const id = generateUuid();
  const now = Date.now();
  const row = {
    id,
    userId,
    title: title ?? "Workout",
    startedAt: now,
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
  const now = Date.now();
  await db
    .update(workouts)
    .set({ isDeleted: true, updatedAt: now, clientTimestamp: now })
    .where(eq(workouts.id, id));
  await logMutation("workouts", id, "delete", { id, isDeleted: true, clientTimestamp: now });
}

export async function getSetsForWorkout(workoutId: string) {
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
) {
  const id = generateUuid();
  const now = Date.now();
  const deviceId = await getDeviceId();
  const row = {
    id,
    workoutId,
    exerciseId,
    setNumber,
    setType: "standard" as const,
    ...defaults,
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
  const now = Date.now();
  const deviceId = await getDeviceId();
  const row = { ...patch, updatedAt: now, clientTimestamp: now, deviceId };
  await db.update(sets).set(row).where(eq(sets.id, id));
  await logMutation("sets", id, "update", row);
}

export async function deleteSet(id: string) {
  const now = Date.now();
  const deviceId = await getDeviceId();
  await db
    .update(sets)
    .set({ isDeleted: true, updatedAt: now, clientTimestamp: now, deviceId })
    .where(eq(sets.id, id));
  await logMutation("sets", id, "delete", { id, isDeleted: true, clientTimestamp: now, deviceId });
}
