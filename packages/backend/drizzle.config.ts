import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "fitness-db",
  },
} as any;
