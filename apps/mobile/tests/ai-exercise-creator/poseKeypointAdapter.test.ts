import { describe, it, expect } from "vitest";
import { fromBlazePoseKeypoints, renderStickFigureSvg } from "../../lib/stickFigure";

describe("MediaPipe BlazePose 33-Keypoint Vision Pose Adapter", () => {
  it("converts raw BlazePose 33-keypoint detection array into normalized SkeletalPose", () => {
    // Mock 33 keypoints
    const rawKeypoints = Array.from({ length: 33 }).map((_, i) => ({
      x: 0.5,
      y: 0.5,
      z: 0.0,
      score: 0.99,
      name: `point_${i}`
    }));

    const pose = fromBlazePoseKeypoints(rawKeypoints, {
      apparatusType: "barbell",
      primaryMuscles: ["quadriceps", "glutes"],
    });

    expect(pose.joints.head).toBeDefined();
    expect(pose.joints.leftShoulder).toBeDefined();
    expect(pose.joints.leftKnee).toBeDefined();
    expect(pose.joints.leftIndex).toBeDefined(); // New 33pt addition
    expect(pose.joints.leftHeel).toBeDefined(); // New 33pt addition

    // Should derive center joints
    expect(pose.joints.neck).toBeDefined();
    expect(pose.joints.spine).toBeDefined();
    expect(pose.joints.hip).toBeDefined();

    expect(pose.apparatusType).toBe("barbell");
    expect(pose.primaryMuscles).toEqual(["quadriceps", "glutes"]);
  });

  it("renders a full synchronized 2D stick figure SVG from BlazePose keypoints", () => {
    const rawKeypoints = Array.from({ length: 33 }).map((_, i) => ({
      x: 0.5,
      y: 0.5,
      z: 0.0,
      score: 0.85,
    }));

    const pose = fromBlazePoseKeypoints(rawKeypoints, {
      apparatusType: "dumbbell",
      primaryMuscles: ["chest", "triceps"],
    });

    const svg = renderStickFigureSvg(pose);

    expect(svg).toContain("<svg");
    expect(svg).toContain('fill="#0B0F19"'); // Canvas BG
    expect(svg).toContain('filter="url(#neon-glow)"');
  });

  it("filters low-confidence detections (< 0.2 score) gracefully", () => {
    const noisyKeypoints = Array.from({ length: 33 }).map((_, i) => ({
      x: 0.5,
      y: 0.5,
      score: i === 0 || i === 11 || i === 12 ? 0.99 : 0.1, // Only head and shoulders are confident
    }));

    const pose = fromBlazePoseKeypoints(noisyKeypoints, {
      apparatusType: "body",
      primaryMuscles: [],
    });

    // High confidence should be parsed
    expect(pose.joints.head).toBeDefined();
    expect(pose.joints.leftShoulder).toBeDefined();
    expect(pose.joints.rightShoulder).toBeDefined();
    expect(pose.joints.neck).toBeDefined();

    // Low confidence should be undefined
    expect(pose.joints.leftWrist).toBeUndefined();
    expect(pose.joints.leftKnee).toBeUndefined();
    expect(pose.joints.leftIndex).toBeUndefined();
  });
});
