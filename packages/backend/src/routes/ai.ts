import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { exercises } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, requireAuth, type Variables } from "../middleware/auth";
import { generateUuid } from "../utils/id";

const app = new Hono<{ Bindings: { DB: D1Database; R2: R2Bucket; AI: Ai }; Variables: Variables }>();

app.use("*", authMiddleware);

app.post("/analyze", async (c) => {
  const db = createDb(c.env.DB);
  const user = requireAuth(c);
  const { frames } = await c.req.json<{ frames: string[] }>();
  const now = Date.now();

  if (!frames || frames.length === 0) {
    return c.json({ error: "No frames provided" }, 400);
  }

  // Build vision prompt with multiple frames
  const imageParts = frames.map((frame) => ({
    type: "image" as const,
    image: frame.split(",")[1] ?? frame,
  }));

  const visionMessages = [
    {
      role: "user" as const,
      content: [
        ...imageParts,
        {
          type: "text" as const,
          text:
            "Identify the exercise shown across these frames. Return ONLY a JSON object with fields: name (string), equipment (string), primaryMuscles (array of strings), secondaryMuscles (array of strings), cues (array of strings). Do not include markdown or explanation.",
        },
      ],
    },
  ];

  const visionResponse = (await c.env.AI.run(
    "@cf/meta/llama-3.2-11b-vision-instruct",
    { messages: visionMessages }
  )) as { response?: string };

  let parsed: Partial<typeof exercises.$inferInsert> = {};
  try {
    const text = visionResponse.response ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    // Fallback to raw response string as name
    parsed = { name: visionResponse.response ?? "Unknown Exercise" };
  }

  // Generate minimalist 2D flat diagram
  const imagePrompt = `Minimalist flat vector illustration of a person performing ${parsed.name} exercise, clean 2D line art, neutral background, fitness diagram style, no text, no watermark.`;
  const imageResponse = (await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
    prompt: imagePrompt,
  })) as { image?: string };

  let imageUrl: string | null = null;
  if (imageResponse.image) {
    const id = generateUuid();
    const key = `exercises/${id}/diagram.png`;
    const imageBuffer = Uint8Array.from(atob(imageResponse.image), (c) => c.charCodeAt(0));
    await c.env.R2.put(key, imageBuffer, {
      httpMetadata: { contentType: "image/png" },
    });
    imageUrl = `${c.req.url.split("/api")[0]}/media/${key}`;
  }

  const row = {
    id: generateUuid(),
    name: parsed.name ?? "Unknown Exercise",
    equipment: parsed.equipment ?? null,
    primaryMuscles: parsed.primaryMuscles ?? [],
    secondaryMuscles: parsed.secondaryMuscles ?? [],
    cues: parsed.cues ?? [],
    imageUrl,
    trackingMode: "bilateral" as const,
    source: "community" as const,
    visibility: "private" as const,
    reviewStatus: "pending" as const,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };

  await db.insert(exercises).values(row);

  return c.json({ data: row }, 201);
});

export default app;
