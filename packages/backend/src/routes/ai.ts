import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { exercises } from "@fitness-app/db-schema";
import { createDb } from "../db/client";
import { authMiddleware, type AppEnv } from "../middleware/auth";
import { generateUuid } from "../utils/id";
import { renderStickFigureSvg, SkeletalPose } from "../utils/stickFigureRenderer";

const app = new Hono<AppEnv>();

app.use("*", authMiddleware);

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

app.post("/analyze", async (c) => {
  try {
    const db = createDb(c.env.DB);
    const user = c.get("user") || { id: "local_guest_user" };
    const body = await c.req.json<{ frames: string[]; hints?: string }>().catch(() => null);
    const now = Date.now();

    if (!body || !body.frames || body.frames.length === 0) {
      return c.json({ error: "No video or photo frames provided" }, 400);
    }

    const { frames, hints } = body;
    const exerciseId = generateUuid();
    const origin = c.req.url.split("/api")[0];

    let parsed: any = null;

    const systemInstruction = `You are an elite biomechanics and fitness kinematics specialist.
Analyze the provided exercise motion frames.
Extract:
1. "name": Specific exercise name (e.g. "Pendulum Squat", "Incline Dumbbell Press", "Landmine Row").
2. "equipment": Exact apparatus (e.g. "Dumbbell", "Barbell", "Cable", "Pendulum Squat Machine", "Landmine Attachment", "Body Only", "Kettlebell", "Machine").
3. "parentCategory": Main equipment category from ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands", "other"].
4. "primaryMuscles": Primary target muscle groups from ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "lats", "traps", "lower back", "middle back", "glutes", "quadriceps", "hamstrings", "calves"].
5. "secondaryMuscles": Synergist/secondary muscle groups.
6. "cues": 3-5 concise, numbered form execution cues.
7. 2D Skeletal Joint Keypoints (normalized coordinates between 0.0 and 1.0, where x: 0 is left, 1 is right; y: 0 is top, 1 is bottom) for 3 motion phases:
   - "phase1_setup": { "head": {"x": 0.5, "y": 0.2}, "leftShoulder": {"x": 0.45, "y": 0.3}, "rightShoulder": {"x": 0.55, "y": 0.3}, "leftElbow": {"x": 0.4, "y": 0.4}, "rightElbow": {"x": 0.6, "y": 0.4}, "leftWrist": {"x": 0.42, "y": 0.5}, "rightWrist": {"x": 0.58, "y": 0.5}, "spine": {"x": 0.5, "y": 0.45}, "hip": {"x": 0.5, "y": 0.55}, "leftKnee": {"x": 0.48, "y": 0.72}, "rightKnee": {"x": 0.52, "y": 0.72}, "leftAnkle": {"x": 0.48, "y": 0.9}, "rightAnkle": {"x": 0.52, "y": 0.9}, "apparatusStart": {"x": 0.35, "y": 0.5}, "apparatusEnd": {"x": 0.65, "y": 0.5} }
   - "phase2_stretch": joint coordinates at maximum stretch/inflection.
   - "phase3_contraction": joint coordinates at peak contraction/lockout.
${hints ? `User hints: "${hints}"` : ""}

Return ONLY a valid JSON object. No markdown or explanation.`;

    if (c.env.AI) {
      try {
        const imageBytes = Array.from(base64ToUint8Array(frames[0]));
        const visionResponse = (await c.env.AI.run(
          "@cf/meta/llama-3.2-11b-vision-instruct",
          {
            prompt: systemInstruction,
            image: imageBytes,
          }
        )) as { response?: string };

        const text = visionResponse?.response ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (visionErr) {
        console.error("Workers AI vision analysis error:", visionErr);
      }
    }

    // Fallback if AI unparsed
    if (!parsed) {
      const fallbackName = hints && hints.trim().length > 0 ? hints.split(",")[0].trim() : "Custom Exercise";
      parsed = {
        name: fallbackName,
        equipment: "Free Weight",
        parentCategory: "other",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
        cues: [
          "Set up with stable posture and tight core.",
          "Control the eccentric stretch smoothly.",
          "Drive through full range of motion to peak contraction.",
        ],
      };
    }

    const parentCat = (parsed.parentCategory ?? "other").toLowerCase();
    const appType: SkeletalPose["apparatusType"] =
      parentCat === "barbell"
        ? "barbell"
        : parentCat === "dumbbell"
        ? "dumbbell"
        : parentCat === "cable"
        ? "cable"
        : parentCat === "machine"
        ? "machine"
        : parentCat === "body only"
        ? "body"
        : "other";

    // Generate 2D Vector Stick Figures for each Phase
    const poses: SkeletalPose[] = [
      {
        joints: parsed.phase1_setup ?? {},
        apparatusType: appType,
        primaryMuscles: parsed.primaryMuscles ?? ["chest"],
      },
      {
        joints: parsed.phase2_stretch ?? parsed.phase1_setup ?? {},
        apparatusType: appType,
        primaryMuscles: parsed.primaryMuscles ?? ["chest"],
      },
      {
        joints: parsed.phase3_contraction ?? parsed.phase1_setup ?? {},
        apparatusType: appType,
        primaryMuscles: parsed.primaryMuscles ?? ["chest"],
      },
    ];

    const animationFrames: string[] = [];

    for (let i = 0; i < poses.length; i++) {
      const svg = renderStickFigureSvg(poses[i]);
      if (c.env.R2) {
        try {
          const key = `exercises/${exerciseId}/stick_frame_${i}.svg`;
          await c.env.R2.put(key, svg, {
            httpMetadata: { contentType: "image/svg+xml" },
          });
          animationFrames.push(`${origin}/media/${key}`);
        } catch (r2Err) {
          console.error(`R2 save error for frame ${i}:`, r2Err);
          animationFrames.push(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
        }
      } else {
        animationFrames.push(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      }
    }

    const primaryImageUrl = animationFrames[0] ?? null;

    const row = {
      id: exerciseId,
      name: parsed.name ?? "Custom Exercise",
      equipment: parsed.equipment ?? null,
      primaryMuscles: parsed.primaryMuscles ?? [],
      secondaryMuscles: parsed.secondaryMuscles ?? [],
      cues: parsed.cues ?? [],
      imageUrl: primaryImageUrl,
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

    if (db) {
      try {
        await db.insert(exercises).values(row);
      } catch (dbErr) {
        console.error("Error inserting exercise to backend DB:", dbErr);
      }
    }

    return c.json(
      {
        data: {
          ...row,
          animationFrames: animationFrames,
          parentCategory: parsed.parentCategory ?? "other",
        },
      },
      201
    );
  } catch (err: any) {
    console.error("Unhandled error in /api/ai/analyze:", err);
    return c.json(
      {
        error: err?.message || "Internal server error during AI exercise analysis",
      },
      500
    );
  }
});

export default app;
