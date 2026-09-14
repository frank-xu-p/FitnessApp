import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrations";
import { seedBaseExercises, seedStarterTemplates } from "./seed";

const expoDb = openDatabaseSync("fitness.db");
export const db = drizzle(expoDb, { schema });

let initPromise: Promise<void> | null = null;

export function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations(expoDb);
      await seedBaseExercises(db);
      await seedStarterTemplates(db);
    })().catch((err) => {
      console.error("Database initialization failed:", err);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function initDatabase() {
  return ensureDbReady();
}
