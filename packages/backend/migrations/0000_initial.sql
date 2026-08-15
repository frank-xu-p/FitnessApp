-- Shared application tables
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

CREATE INDEX IF NOT EXISTS "sets_workout_id_idx" ON "sets" ("workout_id");
CREATE INDEX IF NOT EXISTS "sets_exercise_id_idx" ON "sets" ("exercise_id");
CREATE INDEX IF NOT EXISTS "workouts_user_id_idx" ON "workouts" ("user_id");
CREATE INDEX IF NOT EXISTS "exercises_visibility_idx" ON "exercises" ("visibility");

-- Better-Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT,
  "image" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires_at" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" INTEGER,
  "refresh_token_expires_at" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "created_at" INTEGER NOT NULL
);
