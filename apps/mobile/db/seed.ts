import { sql } from "drizzle-orm";
import { db } from "./client";
import { exercises } from "./schema";

type SourceExercise = {
  id?: string;
  name: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
};

const FALLBACK_EXERCISES: SourceExercise[] = [
  {
    id: "barbell-bench-press",
    name: "Barbell Bench Press",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: ["Lie on a bench", "Lower the bar to mid-chest", "Press to lockout"],
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
    id: "deadlift",
    name: "Deadlift",
    equipment: "barbell",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["glutes", "back"],
    instructions: ["Hinge and grip the bar", "Push the floor away", "Stand tall"],
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    equipment: "barbell",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps"],
    instructions: ["Bar at shoulder height", "Press overhead", "Lock out"],
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    equipment: "cable",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps"],
    instructions: ["Grip the bar wide", "Pull to upper chest", "Control the return"],
  },
];

function loadExercises(): SourceExercise[] {
  try {
    const data = require("../../assets/data/exercises.json");
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    // Dataset is downloaded by setup.ps1; fall back if it is missing.
  }
  return FALLBACK_EXERCISES;
}

export async function seedBaseExercises() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(exercises);
  if ((existing[0]?.count ?? 0) > 0) return;

  const now = Date.now();
  const rows = loadExercises().map((ex) => ({
    id: String(ex.id ?? generateId()),
    name: ex.name,
    equipment: ex.equipment ?? null,
    primaryMuscles: ex.primaryMuscles ?? [],
    secondaryMuscles: ex.secondaryMuscles ?? [],
    cues: (ex.instructions ?? []).slice(0, 5),
    imageUrl: (ex.images ?? [])[0]
      ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${(ex.images ?? [])[0]}`
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
  }));

  const batchSize = 40;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(exercises).values(rows.slice(i, i + batchSize));
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
