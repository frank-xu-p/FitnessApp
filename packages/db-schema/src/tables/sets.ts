import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  setNumber: integer("set_number").notNull(),
  setType: text("set_type", { enum: ["standard", "warmup", "drop", "failure"] })
    .notNull()
    .default("standard"),
  weightKg: real("weight_kg"),
  reps: integer("reps"),
  leftWeightKg: real("left_weight_kg"),
  leftReps: integer("left_reps"),
  rightWeightKg: real("right_weight_kg"),
  rightReps: integer("right_reps"),
  rpe: real("rpe"),
  rir: integer("rir"),
  durationSeconds: integer("duration_seconds"),
  restSeconds: integer("rest_seconds"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  deviceId: text("device_id").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
