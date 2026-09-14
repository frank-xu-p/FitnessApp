import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("Workout"),
  templateId: text("template_id"),
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
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

