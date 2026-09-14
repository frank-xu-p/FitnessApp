import { describe, it, expect } from "vitest";
import { renderStickFigureSvg, SkeletalPose } from "../../lib/stickFigure";

describe("2D Segmented Muscular Figurine Vector Engine (Style 2)", () => {
  it("renders valid SVG markup with dark theme canvas and ground line", () => {
    const pose: SkeletalPose = {
      joints: {
        head: { x: 0.5, y: 0.2 },
        neck: { x: 0.5, y: 0.28 },
        spine: { x: 0.5, y: 0.44 },
        hip: { x: 0.5, y: 0.56 },
      },
      apparatusType: "body",
      primaryMuscles: ["chest"],
    };

    const svg = renderStickFigureSvg(pose);
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 400 400"');
    expect(svg).toContain('fill="#0B0F19"'); // Dark theme canvas
    expect(svg).toContain("neon-glow"); // Neon glow filter
    expect(svg).toContain("</svg>");
  });

  it("renders barbell apparatus with shaft and weight plates", () => {
    const pose: SkeletalPose = {
      joints: {
        head: { x: 0.5, y: 0.2 },
        leftWrist: { x: 0.4, y: 0.4 },
        rightWrist: { x: 0.6, y: 0.4 },
        apparatusStart: { x: 0.25, y: 0.4 },
        apparatusEnd: { x: 0.75, y: 0.4 },
      },
      apparatusType: "barbell",
      primaryMuscles: ["quadriceps", "glutes"],
    };

    const svg = renderStickFigureSvg(pose);
    expect(svg).toContain('stroke="#F59E0B"'); // Apparatus amber color
    expect(svg).toContain("rect"); // Plate geometry
  });

  it("renders dumbbell apparatus on wrists", () => {
    const pose: SkeletalPose = {
      joints: {
        head: { x: 0.5, y: 0.2 },
        leftWrist: { x: 0.38, y: 0.4 },
        rightWrist: { x: 0.62, y: 0.4 },
      },
      apparatusType: "dumbbell",
      primaryMuscles: ["biceps"],
    };

    const svg = renderStickFigureSvg(pose);
    expect(svg).toContain('stroke="#F59E0B"');
    expect(svg).toContain('fill="#F59E0B"');
  });

  it("applies electric neon cyan glowing highlights to active target muscles", () => {
    const chestPose: SkeletalPose = {
      joints: {},
      apparatusType: "dumbbell",
      primaryMuscles: ["chest", "triceps"],
    };

    const svg = renderStickFigureSvg(chestPose);
    // Should include electric cyan fill and stroke
    expect(svg).toContain('fill="#0284C7"');
    expect(svg).toContain('stroke="#38BDF8"');
    expect(svg).toContain('filter="url(#neon-glow)"');
  });

  it("handles empty or partial joint coordinates gracefully with athletic muscular defaults", () => {
    const emptyPose: SkeletalPose = {
      joints: {},
      apparatusType: "body",
      primaryMuscles: [],
    };

    const svg = renderStickFigureSvg(emptyPose);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
  });
});
