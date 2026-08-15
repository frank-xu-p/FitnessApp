import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import exercises from "free-exercise-db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "migrations");

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escape(str: string | null | undefined): string {
  if (str == null) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

function toJson(value: unknown): string {
  return escape(JSON.stringify(value ?? []));
}

function main() {
  const now = Date.now();
  const values = exercises
    .map((ex: any) => {
      const id = ex.id ?? generateId();
      return `(
        ${escape(id)},
        ${escape(ex.name)},
        ${escape(ex.equipment)},
        ${toJson(ex.primaryMuscles)},
        ${toJson(ex.secondaryMuscles)},
        ${toJson(ex.instructions?.slice(0, 5) ?? [])},
        ${escape((ex.images ?? [])[0] ?? null)},
        'bilateral',
        'base',
        'global',
        'approved',
        NULL,
        ${now},
        ${now},
        ${now},
        0
      )`;
    })
    .join(",\n");

  const sql = `
DELETE FROM "exercises" WHERE "source" = 'base';
INSERT INTO "exercises" (
  "id", "name", "equipment", "primary_muscles", "secondary_muscles", "cues",
  "image_url", "tracking_mode", "source", "visibility", "review_status", "created_by",
  "created_at", "updated_at", "client_timestamp", "is_deleted"
) VALUES
${values};
`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "seed_exercises.sql"), sql);
  console.log(`Wrote ${exercises.length} exercises to seed_exercises.sql`);
}

main();
