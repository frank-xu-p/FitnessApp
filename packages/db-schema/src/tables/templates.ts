import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const workoutTemplates = sqliteTable("workout_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  category: text("category").notNull().default("Custom"),
  autoOverloadEnabled: integer("auto_overload_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  cadenceModel: text("cadence_model", {
    enum: ["double_progression", "rpe_autoregulated", "linear"],
  })
    .notNull()
    .default("double_progression"),
  cadenceRate: text("cadence_rate", {
    enum: ["session", "weekly", "biweekly"],
  })
    .notNull()
    .default("session"),
  cadenceIncrementKg: real("cadence_increment_kg"),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});


export const templateExercises = sqliteTable("template_exercises", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  targetSets: integer("target_sets").notNull().default(3),
  targetReps: integer("target_reps").default(10),
  targetWeightKg: real("target_weight_kg"),
  targetRpe: real("target_rpe"),
  restSeconds: integer("rest_seconds").default(90),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type TemplateExercise = typeof templateExercises.$inferSelect;
export type NewTemplateExercise = typeof templateExercises.$inferInsert;
