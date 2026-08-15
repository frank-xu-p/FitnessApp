import type { SQLiteDatabase } from "expo-sqlite";

const MIGRATIONS = [
  {
    id: 1,
    name: "initial",
    sql: `
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "image" TEXT,
        "display_unit" TEXT NOT NULL DEFAULT 'kg',
        "default_bar_weight_kg" REAL NOT NULL DEFAULT 20,
        "custom_plates" TEXT NOT NULL DEFAULT '[20,15,10,5,2.5,1.25]',
        "created_at" INTEGER NOT NULL,
        "updated_at" INTEGER NOT NULL,
        "client_timestamp" INTEGER NOT NULL,
        "is_deleted" INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "exercises" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "equipment" TEXT,
        "primary_muscles" TEXT,
        "secondary_muscles" TEXT,
        "cues" TEXT,
        "image_url" TEXT,
        "tracking_mode" TEXT NOT NULL DEFAULT 'bilateral',
        "source" TEXT NOT NULL DEFAULT 'base',
        "visibility" TEXT NOT NULL DEFAULT 'private',
        "review_status" TEXT NOT NULL DEFAULT 'pending',
        "created_by" TEXT,
        "created_at" INTEGER NOT NULL,
        "updated_at" INTEGER NOT NULL,
        "client_timestamp" INTEGER NOT NULL,
        "is_deleted" INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "workouts" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT 'Workout',
        "started_at" INTEGER NOT NULL,
        "completed_at" INTEGER,
        "notes" TEXT,
        "created_at" INTEGER NOT NULL,
        "updated_at" INTEGER NOT NULL,
        "client_timestamp" INTEGER NOT NULL,
        "is_deleted" INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "sets" (
        "id" TEXT PRIMARY KEY,
        "workout_id" TEXT NOT NULL,
        "exercise_id" TEXT NOT NULL,
        "set_number" INTEGER NOT NULL,
        "set_type" TEXT NOT NULL DEFAULT 'standard',
        "weight_kg" REAL,
        "reps" INTEGER,
        "left_weight_kg" REAL,
        "left_reps" INTEGER,
        "right_weight_kg" REAL,
        "right_reps" INTEGER,
        "rpe" REAL,
        "rir" INTEGER,
        "duration_seconds" INTEGER,
        "rest_seconds" INTEGER,
        "completed_at" INTEGER,
        "created_at" INTEGER NOT NULL,
        "updated_at" INTEGER NOT NULL,
        "client_timestamp" INTEGER NOT NULL,
        "device_id" TEXT NOT NULL,
        "is_deleted" INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS "sync_queue" (
        "id" TEXT PRIMARY KEY,
        "table_name" TEXT NOT NULL,
        "record_id" TEXT NOT NULL,
        "operation" TEXT NOT NULL,
        "payload" TEXT NOT NULL,
        "client_timestamp" INTEGER NOT NULL,
        "device_id" TEXT NOT NULL,
        "synced_at" INTEGER,
        "retry_count" INTEGER NOT NULL DEFAULT 0,
        "error" TEXT
      );

      CREATE TABLE IF NOT EXISTS "__migrations" (
        "id" INTEGER PRIMARY KEY,
        "name" TEXT NOT NULL,
        "applied_at" INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "sets_workout_id_idx" ON "sets" ("workout_id");
      CREATE INDEX IF NOT EXISTS "sets_exercise_id_idx" ON "sets" ("exercise_id");
      CREATE INDEX IF NOT EXISTS "workouts_user_id_idx" ON "workouts" ("user_id");
      CREATE INDEX IF NOT EXISTS "sync_queue_synced_at_idx" ON "sync_queue" ("synced_at");
    `,
  },
];

export async function runMigrations(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      "id" INTEGER PRIMARY KEY,
      "name" TEXT NOT NULL,
      "applied_at" INTEGER NOT NULL
    );
  `);

  const applied = await database.getAllAsync<{ id: number }>(
    'SELECT "id" FROM "__migrations"'
  );
  const appliedIds = new Set(applied.map((m) => m.id));

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) continue;

    await database.execAsync(migration.sql);
    await database.runAsync(
      'INSERT INTO "__migrations" ("id", "name", "applied_at") VALUES (?, ?, ?)',
      [migration.id, migration.name, Date.now()]
    );
  }
}
