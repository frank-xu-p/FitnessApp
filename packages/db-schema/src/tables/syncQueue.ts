import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export type TableName = "users" | "exercises" | "workouts" | "sets";

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  tableName: text("table_name", { enum: ["users", "exercises", "workouts", "sets"] })
    .notNull(),
  recordId: text("record_id").notNull(),
  operation: text("operation", { enum: ["insert", "update", "delete"] }).notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  clientTimestamp: integer("client_timestamp").notNull(),
  deviceId: text("device_id").notNull(),
  syncedAt: integer("synced_at"),
  retryCount: integer("retry_count").notNull().default(0),
  error: text("error"),
});

export type SyncQueueItem = typeof syncQueue.$inferSelect;
export type NewSyncQueueItem = typeof syncQueue.$inferInsert;
