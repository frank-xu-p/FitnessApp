import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  setNumber: integer("set_number").notNull(),
  setType: text("set_type", { enum: ["standard", "warmup", "drop", "failure"] })
    .notNull()
    .default("standard"),
  // Bilateral canonical values
  weightKg: real("weight_kg"),
  reps: integer("reps"),
  // Unilateral tracking
  leftWeightKg: real("left_weight_kg"),
  leftReps: integer("left_reps"),
  rightWeightKg: real("right_weight_kg"),
  rightReps: integer("right_reps"),
  // Feedback and regulation
  rpe: real("rpe"),
  rir: integer("rir"),
  durationSeconds: integer("duration_seconds"),
  restSeconds: integer("rest_seconds"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  // Sync metadata
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  clientTimestamp: integer("client_timestamp", { mode: "timestamp" }).notNull(),
  deviceId: text("device_id").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
