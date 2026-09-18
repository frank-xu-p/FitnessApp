import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  equipment: text("equipment"),
  primaryMuscles: text("primary_muscles", { mode: "json" }).$type<string[]>(),
  secondaryMuscles: text("secondary_muscles", { mode: "json" }).$type<string[]>(),
  cues: text("cues", { mode: "json" }).$type<string[]>(),
  imageUrl: text("image_url"),
  movementGroup: text("movement_group"),
  variantLabel: text("variant_label"),
  trackingMode: text("tracking_mode", { enum: ["bilateral", "unilateral", "alternating"] })
    .notNull()
    .default("bilateral"),
  source: text("source", { enum: ["base", "community"] }).notNull().default("base"),
  visibility: text("visibility", { enum: ["private", "global"] }).notNull().default("private"),
  reviewStatus: text("review_status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  createdBy: text("created_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
