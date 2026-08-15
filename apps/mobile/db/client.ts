import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrations";
import { seedBaseExercises } from "./seed";

const expoDb = openDatabaseSync("fitness.db", { enableChangeListener: true });
export const db = drizzle(expoDb, { schema, logger: __DEV__ });

export async function initDatabase() {
  await runMigrations(expoDb);
  await seedBaseExercises();
}
