import { Hono } from "hono";
import { eq, and, gt, or, inArray } from "drizzle-orm";
import { users, exercises, workouts, sets } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, requireAuth, type Variables } from "../middleware/auth";
import type { Mutation } from "../types/sync";

const tables = { users, exercises, workouts, sets };

const app = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

app.use("*", authMiddleware);

app.post("/push", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const { mutations } = await c.req.json<{ mutations: Mutation[] }>();
  const rejected: Mutation[] = [];

  for (const mutation of mutations) {
    const table = tables[mutation.tableName];
    if (!table) {
      rejected.push(mutation);
      continue;
    }

    // Ownership check
    if (mutation.tableName !== "exercises" && mutation.payload.userId && mutation.payload.userId !== user.id) {
      rejected.push(mutation);
      continue;
    }
    if (mutation.tableName === "exercises" && mutation.payload.createdBy && mutation.payload.createdBy !== user.id) {
      rejected.push(mutation);
      continue;
    }

    const existing = await db
      .select()
      .from(table)
      .where(eq(table.id, mutation.recordId))
      .get();

    if (existing && existing.clientTimestamp >= mutation.clientTimestamp) {
      rejected.push(mutation);
      continue;
    }

    const payload = {
      ...mutation.payload,
      clientTimestamp: mutation.clientTimestamp,
      updatedAt: Date.now(),
    };

    await db
      .insert(table)
      .values(payload as any)
      .onConflictDoUpdate({
        target: table.id,
        set: payload as any,
      });
  }

  return c.json({ accepted: mutations.length - rejected.length, rejected });
});

app.get("/pull", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const since = Number(c.req.query("since") ?? "0");

  const userRows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, user.id), gt(users.clientTimestamp, since)))
    .all();

  const exerciseRows = await db
    .select()
    .from(exercises)
    .where(
      and(
        gt(exercises.clientTimestamp, since),
        eq(exercises.isDeleted, false),
        or(eq(exercises.visibility, "global"), eq(exercises.createdBy, user.id))
      )
    )
    .all();

  const workoutRows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user.id), gt(workouts.clientTimestamp, since)))
    .all();

  const workoutIds = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.userId, user.id))
    .all();

  const setRows = await db
    .select()
    .from(sets)
    .where(
      and(
        eq(sets.isDeleted, false),
        gt(sets.clientTimestamp, since),
        inArray(sets.workoutId, workoutIds.map((w) => w.id))
      )
    )
    .all();

  return c.json({
    mutations: [
      ...userRows.map((r) => ({ tableName: "users" as const, recordId: r.id, payload: r })),
      ...exerciseRows.map((r) => ({ tableName: "exercises" as const, recordId: r.id, payload: r })),
      ...workoutRows.map((r) => ({ tableName: "workouts" as const, recordId: r.id, payload: r })),
      ...setRows.map((r) => ({ tableName: "sets" as const, recordId: r.id, payload: r })),
    ],
  });
});

export default app;
