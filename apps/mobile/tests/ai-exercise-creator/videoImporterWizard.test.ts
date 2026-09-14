import { describe, it, expect, vi } from "vitest";

// State Machine Simulator for VideoImporter 5-Step Guided Wizard
export class VideoImporterWizardModel {
  step: "input" | "keyframes" | "processing" | "preview" | "saved" = "input";
  videoUri: string | null = null;
  thumbnails: string[] = [];
  hints: string = "";
  processingStage: number = 0;

  // Form State
  exerciseId: string = "";
  name: string = "";
  equipment: string = "";
  parentCategory: string = "other";
  primaryMuscles: string[] = [];
  secondaryMuscles: string[] = [];
  cues: string[] = [];
  animationFrames: string[] = [];

  onVideoPicked(uri: string, extractedKeyframes: string[]) {
    this.videoUri = uri;
    this.thumbnails = extractedKeyframes;
    this.step = "keyframes";
  }

  onPhotosPicked(photoUris: string[]) {
    this.thumbnails = photoUris;
    this.step = "keyframes";
  }

  startAiProcessing() {
    if (this.thumbnails.length === 0) return;
    this.step = "processing";
    this.processingStage = 1;
  }

  onAiCompleted(payload: {
    id: string;
    name: string;
    equipment: string;
    parentCategory: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    cues: string[];
    animationFrames: string[];
  }) {
    this.exerciseId = payload.id;
    this.name = payload.name;
    this.equipment = payload.equipment;
    this.parentCategory = payload.parentCategory;
    this.primaryMuscles = payload.primaryMuscles;
    this.secondaryMuscles = payload.secondaryMuscles;
    this.cues = payload.cues;
    this.animationFrames = payload.animationFrames;
    this.step = "preview";
  }

  saveExercise() {
    if (!this.name.trim()) throw new Error("Exercise name required");
    this.step = "saved";
  }

  resetToInput() {
    this.step = "input";
    this.videoUri = null;
    this.thumbnails = [];
    this.hints = "";
  }
}

describe("AI Figurine Creator - 5-Step Guided Wizard State Machine", () => {
  it("initializes at 'input' step and transitions to 'keyframes' when video/photos are loaded", () => {
    const wizard = new VideoImporterWizardModel();
    expect(wizard.step).toBe("input");

    // User picks video
    wizard.onVideoPicked("file:///clip.mp4", [
      "file:///frame0.jpg",
      "file:///frame1.jpg",
      "file:///frame2.jpg",
    ]);

    expect(wizard.step).toBe("keyframes");
    expect(wizard.thumbnails).toHaveLength(3);
    expect(wizard.videoUri).toBe("file:///clip.mp4");
  });

  it("handles sequential photo selection for multi-angle input", () => {
    const wizard = new VideoImporterWizardModel();
    wizard.onPhotosPicked([
      "file:///photo1.jpg",
      "file:///photo2.jpg",
      "file:///photo3.jpg",
    ]);

    expect(wizard.step).toBe("keyframes");
    expect(wizard.thumbnails).toHaveLength(3);
  });

  it("advances through AI processing stages to 'preview' with synthesized 2D mannequin loop", () => {
    const wizard = new VideoImporterWizardModel();
    wizard.onPhotosPicked(["file:///photo1.jpg", "file:///photo2.jpg"]);

    wizard.startAiProcessing();
    expect(wizard.step).toBe("processing");
    expect(wizard.processingStage).toBe(1);

    // AI finishes synthesis
    wizard.onAiCompleted({
      id: "ex_pendulum_squat",
      name: "Pendulum Squat",
      equipment: "Pendulum Squat Machine",
      parentCategory: "machine",
      primaryMuscles: ["quadriceps", "glutes"],
      secondaryMuscles: ["calves"],
      cues: [
        "Position shoulders firmly against the pads",
        "Descend smoothly to parallel",
        "Drive through mid-foot to lockout",
      ],
      animationFrames: [
        "https://cdn.fitnessapp.com/exercises/ex_pendulum_squat/frame_0.png",
        "https://cdn.fitnessapp.com/exercises/ex_pendulum_squat/frame_1.png",
      ],
    });

    expect(wizard.step).toBe("preview");
    expect(wizard.name).toBe("Pendulum Squat");
    expect(wizard.equipment).toBe("Pendulum Squat Machine");
    expect(wizard.parentCategory).toBe("machine");
    expect(wizard.primaryMuscles).toEqual(["quadriceps", "glutes"]);
    expect(wizard.animationFrames).toHaveLength(2);
  });

  it("allows quick edits in preview and transitions to 'saved'", () => {
    const wizard = new VideoImporterWizardModel();
    wizard.onPhotosPicked(["file:///p1.jpg", "file:///p2.jpg"]);
    wizard.onAiCompleted({
      id: "ex_custom_1",
      name: "Incline Press",
      equipment: "Dumbbells",
      parentCategory: "dumbbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
      cues: ["Press up"],
      animationFrames: ["frame0.png", "frame1.png"],
    });

    // User edits name and target muscles
    wizard.name = "Incline Dumbbell Hex Press";
    wizard.primaryMuscles = ["chest", "triceps", "shoulders"];

    wizard.saveExercise();
    expect(wizard.step).toBe("saved");
    expect(wizard.name).toBe("Incline Dumbbell Hex Press");
    expect(wizard.primaryMuscles).toHaveLength(3);
  });

  it("enforces 10-second video duration limit", () => {
    const validateDuration = (durSecOrMs?: number | null): { valid: boolean; error?: string } => {
      if (durSecOrMs == null) return { valid: true };
      const sec = durSecOrMs > 100 ? durSecOrMs / 1000 : durSecOrMs;
      if (sec > 10.5) {
        return {
          valid: false,
          error: `Video is ${Math.round(sec)}s long. Please trim or clip the video to under 10 seconds showing 1 complete rep from start to finish.`,
        };
      }
      return { valid: true };
    };

    // Valid 6s clip
    expect(validateDuration(6).valid).toBe(true);
    expect(validateDuration(6000).valid).toBe(true);

    // Invalid 15s clip
    const result15 = validateDuration(15);
    expect(result15.valid).toBe(false);
    expect(result15.error).toContain("under 10 seconds");

    // Invalid 30000ms clip
    const result30k = validateDuration(30000);
    expect(result30k.valid).toBe(false);
    expect(result30k.error).toContain("30s long");
  });

  it("gracefully activates on-device kinematic fallback when backend AI is offline", () => {
    const inferLocal = (hints: string, keyframes: string[]) => {
      const cleanHints = hints.trim();
      let inferredName = "Custom Movement";
      let inferredEquip = "Free Weight";
      let inferredCategory = "other";
      let inferredMuscles = ["chest"];

      if (cleanHints.length > 0) {
        inferredName = cleanHints.split(",")[0].trim();
        const lower = cleanHints.toLowerCase();
        if (lower.includes("machine") || lower.includes("pendulum") || lower.includes("smith")) {
          inferredEquip = "Machine";
          inferredCategory = "machine";
        } else if (lower.includes("cable") || lower.includes("pulley")) {
          inferredEquip = "Cable";
          inferredCategory = "cable";
        } else if (lower.includes("dumbbell") || lower.includes("curl") || lower.includes("db")) {
          inferredEquip = "Dumbbell";
          inferredCategory = "dumbbell";
        } else if (lower.includes("barbell") || lower.includes("squat") || lower.includes("bench")) {
          inferredEquip = "Barbell";
          inferredCategory = "barbell";
        }

        if (lower.includes("leg") || lower.includes("squat")) {
          inferredMuscles = ["quadriceps", "glutes"];
        }
      }


      return {
        id: `custom_${Date.now()}`,
        name: inferredName,
        equipment: inferredEquip,
        parentCategory: inferredCategory,
        primaryMuscles: inferredMuscles,
        animationFrames: keyframes,
      };
    };

    // Case 1: Dumbbell Bicep Curl hint
    const result1 = inferLocal("Dumbbell Hammer Curl", ["f1.jpg", "f2.jpg"]);
    expect(result1.name).toBe("Dumbbell Hammer Curl");
    expect(result1.equipment).toBe("Dumbbell");
    expect(result1.parentCategory).toBe("dumbbell");
    expect(result1.animationFrames).toHaveLength(2);

    // Case 2: Pendulum Squat hint
    const result2 = inferLocal("Pendulum Squat, focus on quads", ["f1.jpg"]);
    expect(result2.name).toBe("Pendulum Squat");
    expect(result2.equipment).toBe("Machine");
    expect(result2.parentCategory).toBe("machine");
    expect(result2.primaryMuscles).toContain("quadriceps");

    // Case 3: Empty hints fallback
    const result3 = inferLocal("", ["f1.jpg"]);
    expect(result3.name).toBe("Custom Movement");
    expect(result3.equipment).toBe("Free Weight");
  });
});


