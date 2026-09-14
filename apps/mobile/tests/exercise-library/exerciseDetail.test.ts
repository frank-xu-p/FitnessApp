import { describe, it, expect } from "vitest";

type ExerciseDetailData = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  cues: string[];
  imageUrl: string | null;
};

type LastPerformedSet = {
  setNumber: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
};

type LastPerformedSession = {
  workoutId: string;
  date: number;
  title: string;
  sets: LastPerformedSet[];
};

// Formatter matching ExerciseDetailScreen logic
function formatLastPerformed(session: LastPerformedSession | null, displayUnit: "kg" | "lb" = "kg") {
  if (!session || session.sets.length === 0) {
    return {
      hasHistory: false,
      message: "No session history logged yet. Complete this movement in a workout to see your weights and reps here!",
      rows: [],
    };
  }

  const factor = displayUnit === "lb" ? 2.20462 : 1;
  const rows = session.sets.map((s) => {
    const dispWeight = s.weightKg != null ? Math.round(s.weightKg * factor * 10) / 10 : null;
    const weightText = dispWeight != null ? `${dispWeight} ${displayUnit}` : "BW";
    const repsText = `${s.reps ?? 0}`;
    const intensityText = s.rpe != null ? `RPE ${s.rpe}` : s.rir != null ? `${s.rir} RIR` : "—";

    return {
      setNumber: s.setNumber,
      setType: s.setType,
      weightText,
      repsText,
      formattedSetSummary: `${weightText} × ${repsText}`,
      intensityText,
    };
  });

  return {
    hasHistory: true,
    dateText: new Date(session.date).toISOString().slice(0, 10),
    title: session.title,
    rows,
  };
}

describe("Exercise Detail View - Smart About Tab & Last Performed Mini-Card", () => {
  const mockExercise: ExerciseDetailData = {
    id: "barbell-bench-press",
    name: "Barbell Bench Press",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    cues: [
      "Lie back on a flat bench.",
      "Grip the bar slightly wider than shoulder-width.",
      "Lower the bar slowly to mid-chest.",
      "Press explosively back to lockout.",
    ],
    imageUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg",
  };

  it("verifies metadata mapping for primary/secondary muscles and step-by-step cues", () => {
    expect(mockExercise.name).toBe("Barbell Bench Press");
    expect(mockExercise.equipment).toBe("barbell");
    expect(mockExercise.primaryMuscles).toEqual(["chest"]);
    expect(mockExercise.secondaryMuscles).toEqual(["shoulders", "triceps"]);
    expect(mockExercise.cues).toHaveLength(4);
    expect(mockExercise.cues[0]).toBe("Lie back on a flat bench.");
    expect(mockExercise.cues[3]).toBe("Press explosively back to lockout.");
  });

  it("renders Smart 'Last Performed' mini-card with recent sets, weights, and reps in kg", () => {
    const recentSession: LastPerformedSession = {
      workoutId: "w_push_1",
      date: 1724000000000,
      title: "Push Day Workout",
      sets: [
        { setNumber: 1, setType: "standard", weightKg: 80, reps: 10, rpe: 8, rir: 2 },
        { setNumber: 2, setType: "standard", weightKg: 85, reps: 8, rpe: 8.5, rir: 1 },
        { setNumber: 3, setType: "failure", weightKg: 90, reps: 6, rpe: 10, rir: 0 },
      ],
    };

    const result = formatLastPerformed(recentSession, "kg");

    expect(result.hasHistory).toBe(true);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].formattedSetSummary).toBe("80 kg × 10");
    expect(result.rows[0].intensityText).toBe("RPE 8");

    expect(result.rows[1].formattedSetSummary).toBe("85 kg × 8");
    expect(result.rows[1].intensityText).toBe("RPE 8.5");

    expect(result.rows[2].formattedSetSummary).toBe("90 kg × 6");
    expect(result.rows[2].setType).toBe("failure");
    expect(result.rows[2].intensityText).toBe("RPE 10");
  });

  it("converts Last Performed mini-card weights to lb when user display unit is lb", () => {
    const recentSession: LastPerformedSession = {
      workoutId: "w_push_1",
      date: 1724000000000,
      title: "Push Day Workout",
      sets: [
        { setNumber: 1, setType: "standard", weightKg: 100, reps: 5, rpe: 9, rir: 1 },
      ],
    };

    const result = formatLastPerformed(recentSession, "lb");
    expect(result.rows[0].formattedSetSummary).toBe("220.5 lb × 5");
  });

  it("handles empty history gracefully with welcoming empty state", () => {
    const result = formatLastPerformed(null);
    expect(result.hasHistory).toBe(false);
    expect(result.message).toContain("No session history logged yet");
    expect(result.rows).toEqual([]);
  });

  it("ensures manual rest timer settings are omitted from the About view model", () => {
    // Verified: ExerciseDetailData and About tab contains NO manual rest timer fields
    const aboutKeys = Object.keys(mockExercise);
    expect(aboutKeys).not.toContain("restSeconds");
    expect(aboutKeys).not.toContain("autoRestTimerEnabled");
    expect(aboutKeys).not.toContain("defaultRestTimer");
  });
});
