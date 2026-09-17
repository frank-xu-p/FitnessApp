import { describe, it, expect } from "vitest";
import {
  DEMO_VIDEO_BASE,
  getDemoVideoUrl,
  getDemoPosterUrl,
  getDemoVideoSlug,
  hasDemoPoster,
  hasDemoFemaleVideo,
  hasDemoMaleVideo,
} from "./demoVideos";

describe("demoVideos URL builders", () => {
  it("builds male/female video URLs from a slug", () => {
    expect(getDemoVideoUrl("barbell-bench-press")).toBe(
      `${DEMO_VIDEO_BASE}/exercise-videos/male/barbell-bench-press.mp4`,
    );
    expect(getDemoVideoUrl("barbell-bench-press", "female")).toBe(
      `${DEMO_VIDEO_BASE}/exercise-videos/female/barbell-bench-press.mp4`,
    );
  });

  it("builds male/female poster URLs from a slug", () => {
    expect(getDemoPosterUrl("push-ups")).toBe(
      `${DEMO_VIDEO_BASE}/exercise-posters/male/push-ups.jpg`,
    );
    expect(getDemoPosterUrl("push-ups", "female")).toBe(
      `${DEMO_VIDEO_BASE}/exercise-posters/female/push-ups.jpg`,
    );
  });

  it("returns null/false for exercise ids with no mapped demo video", () => {
    const fakeId = "__no_such_exercise_xyz__";
    expect(getDemoVideoSlug(fakeId)).toBeNull();
    expect(hasDemoPoster(fakeId)).toBe(false);
    expect(hasDemoFemaleVideo(fakeId)).toBe(false);
    expect(hasDemoMaleVideo(fakeId)).toBe(true);
  });

  it("treats male video as available unless the map says otherwise", () => {
    // A real mapped id defaults to male-available.
    expect(hasDemoMaleVideo("Barbell_Squat")).toBe(true);
  });

  it("covers every bundle-only exercise id with a live slug", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const extras = require("../assets/data/bundle-exercises.json") as {
      id: string;
    }[];
    expect(extras.length).toBeGreaterThan(200);
    for (const ex of extras) {
      expect(getDemoVideoSlug(ex.id)).not.toBeNull();
    }
  });
});
