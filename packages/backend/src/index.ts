import { Hono } from "hono";
import { createAuthFromD1 } from "./auth";
import { createDb } from "./db/client";
import exercises from "./routes/exercises";
import workouts from "./routes/workouts";
import sync from "./routes/sync";
import admin from "./routes/admin";
import ai from "./routes/ai";

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

app.on(["POST", "GET"], "/api/auth/**", (c) =>
  createAuthFromD1(c.env.DB, c.env.BETTER_AUTH_SECRET).handler(c.req.raw)
);

app.route("/api/exercises", exercises);
app.route("/api/workouts", workouts);
app.route("/api/sync", sync);
app.route("/api/admin", admin);
app.route("/api/ai", ai);

app.get("/media/:key{.*}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.R2.get(key);
  if (!object) return c.notFound();
  return c.body(object.body, 200, {
    "Content-Type": object.httpMetadata?.contentType ?? "image/png",
  });
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
