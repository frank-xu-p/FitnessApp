import { createMiddleware } from "hono/factory";
import { createAuthFromD1 } from "../auth";
import type { Context } from "hono";

export type Variables = {
  user: { id: string; email: string; name?: string } | null;
};

export const authMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const auth = createAuthFromD1(c.env.DB);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  await next();
});

export function requireAuth(c: Context<{ Variables: Variables }>) {
  const user = c.get("user");
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
