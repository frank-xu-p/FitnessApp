import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { workouts, sets } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";
import { generateUuid } from "../utils/id";

const app = new Hono<AppEnv>();


app.use("*", authMiddleware);

app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user.id), eq(workouts.isDeleted, false)))
    .orderBy(desc(workouts.startedAt))
    .all();
  return c.json({ data: rows });
});

app.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const id = c.req.param("id");

  const workout = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .get();
  if (!workout) return c.json({ error: "Not found" }, 404);

  const setRows = await db
    .select()
    .from(sets)
    .where(and(eq(sets.workoutId, id), eq(sets.isDeleted, false)))
    .orderBy(sets.setNumber)
    .all();

  return c.json({ data: { ...workout, sets: setRows } });
});

app.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const body = await c.req.json();
  const now = Date.now();

  const row = {
    id: generateUuid(),
    userId: user.id,
    title: body.title ?? "Workout",
    startedAt: body.startedAt ?? now,
    notes: body.notes ?? null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
  };

  await db.insert(workouts).values(row);
  return c.json({ data: row }, 201);
});

app.patch("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = Date.now();

  const existing = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .get();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await db
    .update(workouts)
    .set({ ...body, updatedAt: now, clientTimestamp: now })
    .where(eq(workouts.id, id));

  return c.json({ success: true });
});

export default app;
