import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, type Database } from "./db/client";

export function createAuth(database: Database, secret?: string) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
    }),
    secret,
    socialProviders: {
      // Configure via environment variables at runtime
    },
    trustedOrigins: ["fitnessapp://"],
  });
}

export function createAuthFromD1(d1: D1Database, secret?: string) {
  return createAuth(createDb(d1), secret);
}
