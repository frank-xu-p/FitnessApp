import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  displayUnit: text("display_unit", { enum: ["kg", "lb"] })
    .notNull()
    .default("kg"),
  defaultBarWeightKg: real("default_bar_weight_kg").notNull().default(20),
  customPlates: text("custom_plates", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default([20, 15, 10, 5, 2.5, 1.25]),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
