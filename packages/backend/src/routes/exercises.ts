import { Hono } from "hono";
import { eq, like, and, or } from "drizzle-orm";
import { exercises } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";
import { generateUuid } from "../utils/id";

const app = new Hono<AppEnv>();


app.use("*", authMiddleware);

app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const q = c.req.query("q");
  const visibility = c.req.query("visibility") ?? "global";

  const conditions = [
    eq(exercises.isDeleted, false),
    or(
      eq(exercises.visibility, visibility as "global" | "private"),
      and(eq(exercises.visibility, "private"), eq(exercises.createdBy, user.id))
    ),
  ];

  if (q) {
    conditions.push(like(exercises.name, `%${q}%`));
  }

  const rows = await db
    .select()
    .from(exercises)
    .where(and(...conditions))
    .all();

  return c.json({ data: rows });
});

app.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param("id");
  const row = await db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const body = await c.req.json();
  const now = Date.now();

  const row = {
    id: generateUuid(),
    ...body,
    createdBy: user.id,
    source: body.source ?? "community",
    visibility: body.visibility ?? "private",
    reviewStatus: body.reviewStatus ?? "pending",
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
  };

  await db.insert(exercises).values(row);
  return c.json({ data: row }, 201);
});

app.patch("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = Date.now();

  const existing = await db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.createdBy && existing.createdBy !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db
    .update(exercises)
    .set({ ...body, updatedAt: now, clientTimestamp: now })
    .where(eq(exercises.id, id));

  return c.json({ success: true });
});

export default app;
