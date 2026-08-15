import { sql } from "drizzle-orm";
import { db } from "./client";
import { exercises } from "./schema";
import exercisesData from "free-exercise-db";

export async function seedBaseExercises() {
  const existing = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(exercises).get();
  if (existing && existing.count > 0) return;

  const now = Date.now();
  const rows = exercisesData.map((ex: any) => ({
    id: ex.id ?? generateId(),
    name: ex.name,
    equipment: ex.equipment ?? null,
    primaryMuscles: ex.primaryMuscles ?? [],
    secondaryMuscles: ex.secondaryMuscles ?? [],
    cues: (ex.instructions ?? []).slice(0, 5),
    imageUrl: (ex.images ?? [])[0] ?? null,
    trackingMode: "bilateral" as const,
    source: "base" as const,
    visibility: "global" as const,
    reviewStatus: "approved" as const,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  }));

  await db.insert(exercises).values(rows);
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
