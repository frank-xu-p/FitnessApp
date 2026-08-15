import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  tableName: text("table_name", { enum: ["users", "exercises", "workouts", "sets"] })
    .notNull(),
  recordId: text("record_id").notNull(),
  operation: text("operation", { enum: ["insert", "update", "delete"] }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  clientTimestamp: integer("client_timestamp", { mode: "timestamp" }).notNull(),
  deviceId: text("device_id").notNull(),
  // Sync state
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  retryCount: integer("retry_count").notNull().default(0),
  error: text("error"),
});

export type SyncQueueItem = typeof syncQueue.$inferSelect;
export type NewSyncQueueItem = typeof syncQueue.$inferInsert;
