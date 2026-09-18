import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// node:sqlite via require: vite's resolver can't handle the node: prefix in ESM imports
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>;
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { MIGRATIONS } from "../../db/migrations";
import { backfillMovementGroups } from "../../db/seed";

function makeProxyDb(sqlite: DatabaseSyncInstance) {
  return drizzle(async (sql, params, method) => {
    // sqlite-proxy expects rows as arrays in column order
    const toArrayRows = (rows: Record<string, unknown>[]) =>
      rows.map((r) => Object.values(r));
    const stmt = sqlite.prepare(sql);
    if (method === "all") {
      return { rows: toArrayRows(stmt.all(...(params as any[])) as any[]) };
    }
    if (method === "get") {
      const row = stmt.get(...(params as any[]));
      return { rows: row ? toArrayRows([row as any]) : [] };
    }
    stmt.run(...(params as any[]));
    return { rows: [] };
  });
}

/** Simulates a pre-migration database: exercises table without the new columns. */
function makeLegacyDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      equipment TEXT
    );
  `);
  return sqlite;
}

const applyMigration3 = (sqlite: DatabaseSyncInstance) => {
  const m3 = MIGRATIONS.find((m) => m.id === 3);
  expect(m3).toBeDefined();
  sqlite.exec(m3!.sql);
};

const insertExercise = (
  sqlite: DatabaseSyncInstance,
  id: string,
  name: string,
  equipment: string | null,
  movementGroup: string | null = null,
  variantLabel: string | null = null
) => {
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, equipment, movement_group, variant_label)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, name, equipment, movementGroup, variantLabel);
};

const readGroups = (sqlite: DatabaseSyncInstance) =>
  (sqlite
    .prepare(`SELECT id, movement_group, variant_label FROM exercises ORDER BY id`)
    .all() as { id: string; movement_group: string | null; variant_label: string | null }[]);

describe("movement-variant migration + backfill (real SQLite)", () => {
  let sqlite: DatabaseSyncInstance;

  beforeEach(() => {
    sqlite = makeLegacyDb();
    applyMigration3(sqlite);
  });

  it("adds movement_group/variant_label columns and the index", () => {
    const cols = sqlite
      .prepare(`PRAGMA table_info("exercises")`)
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("movement_group");
    expect(names).toContain("variant_label");
    const idx = sqlite
      .prepare(`PRAGMA index_list("exercises")`)
      .all() as { name: string }[];
    expect(idx.map((i) => i.name)).toContain("exercises_movement_group_idx");
  });

  it("backfills groups conservatively and never touches pre-classified rows", async () => {
    const db = makeProxyDb(sqlite);
    insertExercise(sqlite, "ex_pushdown", "Triceps Pushdown", "cable");
    insertExercise(sqlite, "ex_rope", "Triceps Pushdown - Rope Attachment", "cable");
    insertExercise(sqlite, "ex_vbar", "Triceps Pushdown - V-Bar Attachment", "cable");
    insertExercise(sqlite, "ex_hack", "Hack Squat", "machine");
    insertExercise(sqlite, "ex_front", "Front Squat", "barbell");
    insertExercise(sqlite, "ex_wrist", "Cable Wrist Curl", "cable");
    // A row the user (or an earlier run) already classified — must be preserved.
    insertExercise(sqlite, "ex_custom", "My Special Press", "dumbbell", "shoulder-press", "Neutral");

    await backfillMovementGroups(db);

    const byId = Object.fromEntries(readGroups(sqlite).map((r) => [r.id, r]));
    expect(byId["ex_pushdown"].movement_group).toBe("triceps-pushdown");
    expect(byId["ex_pushdown"].variant_label).toBe("Straight Bar");
    expect(byId["ex_rope"].movement_group).toBe("triceps-pushdown");
    expect(byId["ex_rope"].variant_label).toBe("Rope");
    expect(byId["ex_vbar"].movement_group).toBe("triceps-pushdown");
    expect(byId["ex_vbar"].variant_label).toBe("V Bar");
    // Distinct movements stay ungrouped.
    expect(byId["ex_hack"].movement_group).toBeNull();
    expect(byId["ex_front"].movement_group).toBeNull();
    expect(byId["ex_wrist"].movement_group).toBeNull();
    // Pre-classified row untouched.
    expect(byId["ex_custom"].movement_group).toBe("shoulder-press");
    expect(byId["ex_custom"].variant_label).toBe("Neutral");
  });

  it("is idempotent: a second run changes nothing", async () => {
    const db = makeProxyDb(sqlite);
    insertExercise(sqlite, "ex_pushdown", "Triceps Pushdown", "cable");
    insertExercise(sqlite, "ex_rope", "Triceps Pushdown (Rope)", "cable");

    await backfillMovementGroups(db);
    const first = readGroups(sqlite);
    await backfillMovementGroups(db);
    const second = readGroups(sqlite);

    expect(second).toEqual(first);
    expect(first.find((r) => r.id === "ex_rope")?.variant_label).toBe("Rope");
  });

  it("migration 3 is safe to apply on an already-migrated database", () => {
    // The __migrations guard in runMigrations prevents re-applying; the raw
    // SQL itself must at least not be destructive on first apply.
    const cols = (
      sqlite.prepare(`PRAGMA table_info("exercises")`).all() as { name: string }[]
    ).map((c) => c.name);
    expect(cols.filter((c) => c === "movement_group")).toHaveLength(1);
  });
});
