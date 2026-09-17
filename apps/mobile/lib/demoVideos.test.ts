import { describe, it, expect } from "vitest";
import {
  DEMO_VIDEO_BASE,
  getDemoVideoUrl,
  getDemoPosterUrl,
  getDemoVideoSlug,
  hasDemoPoster,
  hasDemoFemaleVideo,
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
  });
});
