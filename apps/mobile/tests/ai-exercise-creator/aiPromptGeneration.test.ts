import { describe, it, expect } from "vitest";

// Equipment Categorization Helper (mirrors backend classification logic)
export function categorizeEquipment(equipmentName: string): string {
  const norm = equipmentName.toLowerCase().trim();

  if (
    norm.includes("barbell") ||
    norm.includes("trap bar") ||
    norm.includes("hex bar") ||
    norm.includes("safety bar") ||
    norm.includes("safety squat bar") ||
    norm.includes("cambered") ||
    norm.includes("ez bar") ||
    norm.endsWith(" bar")
  ) {
    return "barbell";
  }
  if (norm.includes("dumbbell")) {
    return "dumbbell";
  }
  if (norm.includes("cable") || norm.includes("pulley") || norm.includes("crossover")) {
    return "cable";
  }
  if (
    norm.includes("machine") ||
    norm.includes("smith") ||
    norm.includes("pendulum") ||
    norm.includes("leg press") ||
    norm.includes("hack squat") ||
    norm.includes("hammer strength") ||
    norm.includes("iso-lateral")
  ) {
    return "machine";
  }
  if (
    norm.includes("body") ||
    norm.includes("pull-up") ||
    norm.includes("dip") ||
    norm.includes("trx") ||
    norm.includes("gymnastics")
  ) {
    return "body only";
  }
  if (norm.includes("kettlebell")) {
    return "kettlebells";
  }
  if (norm.includes("band")) {
    return "bands";
  }
  return "other";
}


// 2D Vector Figurine Prompt Builder
export function buildFigurineStylePrompt(
  exerciseName: string,
  equipment: string,
  primaryMuscles: string[],
  phaseDescription: string
): string {
  const primaryMusclesStr = primaryMuscles.join(", ");
  return `2D minimalist flat vector anatomical fitness mannequin, isolated athletic side view, solid dark background (#0B0F19), matte slate-gray body contours (#1E293B, #334155), vibrant neon-cyan glowing active muscles (#38BDF8) highlighting ${primaryMusclesStr}, performing ${phaseDescription} with matte charcoal vector ${equipment}, clean 2D blueprint diagram, no human face, no clothing, no photorealism, no text, no watermark.`;
}

describe("AI Exercise Creator - Prompt Engine & Smart Equipment Categorization", () => {
  describe("Equipment Categorization", () => {
    it("maps novel gym machines to 'machine' parent category", () => {
      expect(categorizeEquipment("Pendulum Squat Machine")).toBe("machine");
      expect(categorizeEquipment("Hammer Strength Iso-Lateral Bench")).toBe("machine");
      expect(categorizeEquipment("Hack Squat")).toBe("machine");
    });

    it("maps novel bars to 'barbell' parent category", () => {
      expect(categorizeEquipment("Trap Bar / Hex Bar")).toBe("barbell");
      expect(categorizeEquipment("Safety Squat Bar")).toBe("barbell");
      expect(categorizeEquipment("EZ Barbell")).toBe("barbell");
    });

    it("maps suspension and calisthenics to 'body only'", () => {
      expect(categorizeEquipment("Gymnastics Rings")).toBe("body only");
      expect(categorizeEquipment("TRX Suspension Straps")).toBe("body only");
      expect(categorizeEquipment("Bodyweight")).toBe("body only");
    });

    it("maps novel functional attachments to 'other'", () => {
      expect(categorizeEquipment("Landmine Attachment")).toBe("other");
      expect(categorizeEquipment("Sandbag")).toBe("other");
    });
  });

  describe("2D Vector Mannequin Style Prompt Generation", () => {
    it("anchors style prompt to signature dark mode #0B0F19 canvas and cyan #38BDF8 highlights", () => {
      const prompt = buildFigurineStylePrompt(
        "Pendulum Squat",
        "Pendulum Squat Machine",
        ["quadriceps", "glutes"],
        "bottom stretched position with deep 90 degree knee flexion"
      );

      expect(prompt).toContain("2D minimalist flat vector anatomical fitness mannequin");
      expect(prompt).toContain("solid dark background (#0B0F19)");
      expect(prompt).toContain("vibrant neon-cyan glowing active muscles (#38BDF8)");
      expect(prompt).toContain("highlighting quadriceps, glutes");
      expect(prompt).toContain("matte charcoal vector Pendulum Squat Machine");
      expect(prompt).toContain("no human face, no clothing, no photorealism");
    });
  });
});
