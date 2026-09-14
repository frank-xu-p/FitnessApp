import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { exercises } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";

const app = new Hono<AppEnv>();


app.use("*", authMiddleware);

function requireAdmin(c: ReturnType<typeof requireAuth>) {
  // In production, check an admin role flag or email domain.
  // For this scaffold, the first authenticated user is treated as admin.
  return c;
}

app.get("/exercises/pending", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAdmin(requireAuth(c));
  const rows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.reviewStatus, "pending"), eq(exercises.isDeleted, false)))
    .all();
  return c.json({ data: rows });
});

app.post("/exercises/:id/review", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAdmin(requireAuth(c));
  const id = c.req.param("id");
  const { status } = await c.req.json<{ status: "approved" | "rejected" }>();
  const now = Date.now();

  const existing = await db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await db
    .update(exercises)
    .set({
      reviewStatus: status,
      visibility: status === "approved" ? "global" : "private",
      updatedAt: now,
      clientTimestamp: now,
    })
    .where(eq(exercises.id, id));

  return c.json({ success: true });
});

export default app;
