import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// node:sqlite via require: vite's resolver can't handle the node: prefix in ESM imports
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>;
import { drizzle } from "drizzle-orm/sqlite-proxy";
import {
  remapPresetTemplateExercises,
  pruneNonDemoExercises,
} from "../../db/seed";

function makeTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT, source TEXT);
    CREATE TABLE sets (id TEXT PRIMARY KEY, exercise_id TEXT);
    CREATE TABLE template_exercises (id TEXT PRIMARY KEY, template_id TEXT, exercise_id TEXT);
  `);

  const db = drizzle(async (sql, params, method) => {
    // sqlite-proxy expects rows as arrays in column order (see mapResultRow)
    const toArrayRows = (rows: Record<string, unknown>[]) =>
      rows.map((r) => Object.values(r));
    const stmt = sqlite.prepare(sql);
    if (method === "all") {
      return {
        rows: toArrayRows(stmt.all(...(params as any[])) as any[]),
      };
    }
    if (method === "get") {
      const row = stmt.get(...(params as any[]));
      return { rows: row ? toArrayRows([row as any]) : [] };
    }
    stmt.run(...(params as any[]));
    return { rows: [] };
  });

  const exec = (sql: string, ...params: any[]) =>
    sqlite.prepare(sql).run(...params);

  return { db, exec, sqlite };
}

function seedFixtures(exec: (sql: string, ...p: any[]) => void) {
  const ex = (id: string, source: string) =>
    exec(`INSERT INTO exercises (id, name, source) VALUES (?, ?, ?)`, id, id, source);
  // Demo-catalog exercises (must survive)
  ex("Barbell_Squat", "base");
  ex("bundle_cable_triceps_pushdown", "base");
  ex("Barbell_Bench_Press_-_Medium_Grip", "base");
  // Non-demo base, unreferenced (must be pruned)
  ex("Some_Old_Lift", "base");
  // Non-demo base, referenced by a logged set (must be kept)
  ex("Legacy_Row", "base");
  // User-created exercise (must be kept)
  ex("custom_abc", "community");
  // Legacy fallback id, referenced by preset + custom templates
  ex("barbell-bench-press", "base");

  exec(`INSERT INTO sets (id, exercise_id) VALUES ('set1', 'Legacy_Row')`);
  exec(
    `INSERT INTO template_exercises (id, template_id, exercise_id) VALUES
     ('te_preset', 'tpl_push_day', 'barbell-bench-press'),
     ('te_custom', 'tpl_custom_1', 'barbell-bench-press')`
  );
}

const remainingExerciseIds = (sqlite: DatabaseSyncInstance): string[] =>
  (sqlite.prepare(`SELECT id FROM exercises`).all() as { id: string }[]).map(
    (r) => r.id
  );

describe("Catalog prune + preset remap (real SQLite)", () => {
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    seedFixtures(ctx.exec);
  });

  it("remaps preset templates to demo-catalog ids, leaves custom templates alone", async () => {
    await remapPresetTemplateExercises(ctx.db as any);

    const rows = ctx.sqlite
      .prepare(`SELECT id, exercise_id FROM template_exercises ORDER BY id`)
      .all() as { id: string; exercise_id: string }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.exercise_id]));

    expect(byId["te_preset"]).toBe("Barbell_Bench_Press_-_Medium_Grip");
    expect(byId["te_custom"]).toBe("barbell-bench-press");
  });

  it("prunes unreferenced non-demo base exercises, keeps demos/history/custom", async () => {
    await remapPresetTemplateExercises(ctx.db as any);
    await pruneNonDemoExercises(ctx.db as any);

    const ids = remainingExerciseIds(ctx.sqlite);
    // Pruned: unreferenced, no demo
    expect(ids).not.toContain("Some_Old_Lift");
    // Kept: demo catalog
    expect(ids).toContain("Barbell_Squat");
    expect(ids).toContain("bundle_cable_triceps_pushdown");
    expect(ids).toContain("Barbell_Bench_Press_-_Medium_Grip");
    // Kept: referenced by a logged set (history protection)
    expect(ids).toContain("Legacy_Row");
    // Kept: user-created
    expect(ids).toContain("custom_abc");
    // Kept: still referenced by the custom template
    expect(ids).toContain("barbell-bench-press");
  });

  it("is idempotent", async () => {
    await remapPresetTemplateExercises(ctx.db as any);
    await pruneNonDemoExercises(ctx.db as any);
    const once = remainingExerciseIds(ctx.sqlite).sort();
    await remapPresetTemplateExercises(ctx.db as any);
    await pruneNonDemoExercises(ctx.db as any);
    expect(remainingExerciseIds(ctx.sqlite).sort()).toEqual(once);
  });
});
