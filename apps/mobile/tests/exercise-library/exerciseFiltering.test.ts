import { describe, it, expect } from "vitest";

export type ExerciseFilters = {
  query?: string;
  muscles?: string[];
  equipment?: string[];
};

// Pure filtering logic simulation matching getExercises SQL logic
function filterExercises(
  items: Array<{ id: string; name: string; equipment: string | null; primaryMuscles: string[] }>,
  filters: ExerciseFilters
) {
  return items.filter((item) => {
    if (filters.query && filters.query.trim().length > 0) {
      const q = filters.query.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchEq = item.equipment?.toLowerCase().includes(q);
      const matchMuscle = item.primaryMuscles.some((m) => m.toLowerCase().includes(q));
      if (!matchName && !matchEq && !matchMuscle) return false;
    }
    if (filters.equipment && filters.equipment.length > 0) {
      const matchEq = filters.equipment.some((eq) =>
        item.equipment?.toLowerCase().includes(eq.toLowerCase())
      );
      if (!matchEq) return false;
    }
    if (filters.muscles && filters.muscles.length > 0) {
      const matchMuscles = filters.muscles.some((m) =>
        item.primaryMuscles.some((pm) => pm.toLowerCase().includes(m.toLowerCase()))
      );
      if (!matchMuscles) return false;
    }
    return true;
  });
}

function computePRsFromHistory(sessions: any[]) {
  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let maxEstimated1RMKg: number | null = null;
  let maxVolumeKg: number | null = null;
  let totalSetsCompleted = 0;

  for (const session of sessions) {
    for (const s of session.sets) {
      if (s.completedAt != null) {
        totalSetsCompleted++;
        const w = s.weightKg ?? 0;
        const r = s.reps ?? 0;

        if (s.weightKg != null && (maxWeightKg === null || s.weightKg > maxWeightKg)) {
          maxWeightKg = s.weightKg;
        }
        if (s.reps != null && (maxReps === null || s.reps > maxReps)) {
          maxReps = s.reps;
        }

        const vol = w * r;
        if (vol > 0 && (maxVolumeKg === null || vol > maxVolumeKg)) {
          maxVolumeKg = vol;
        }

        if (w > 0 && r > 0) {
          const e1rm = w * (1 + r / 30);
          if (maxEstimated1RMKg === null || e1rm > maxEstimated1RMKg) {
            maxEstimated1RMKg = Math.round(e1rm * 10) / 10;
          }
        }
      }
    }
  }

  return {
    maxWeightKg,
    maxReps,
    maxEstimated1RMKg,
    maxVolumeKg,
    totalSetsCompleted,
    totalWorkoutsCount: sessions.length,
  };
}

describe("Exercise Library - Hybrid Filtering & PR Calculations", () => {
  const dataset = [
    {
      id: "ex_1",
      name: "Barbell Bench Press",
      equipment: "barbell",
      primaryMuscles: ["chest"],
    },
    {
      id: "ex_2",
      name: "Incline Dumbbell Press",
      equipment: "dumbbell",
      primaryMuscles: ["chest"],
    },
    {
      id: "ex_3",
      name: "Dumbbell Bicep Curl",
      equipment: "dumbbell",
      primaryMuscles: ["biceps"],
    },
    {
      id: "ex_4",
      name: "Barbell Squat",
      equipment: "barbell",
      primaryMuscles: ["quadriceps"],
    },
    {
      id: "ex_5",
      name: "Pull-Up",
      equipment: "body only",
      primaryMuscles: ["lats"],
    },
  ];

  describe("Hybrid Multi-Attribute Filtering", () => {
    it("filters accurately by equipment chip", () => {
      const dumbbells = filterExercises(dataset, { equipment: ["dumbbell"] });
      expect(dumbbells).toHaveLength(2);
      expect(dumbbells.map((d) => d.name)).toEqual([
        "Incline Dumbbell Press",
        "Dumbbell Bicep Curl",
      ]);
    });

    it("filters accurately by target muscle group (anatomical dummy selection)", () => {
      const chestMoves = filterExercises(dataset, { muscles: ["chest"] });
      expect(chestMoves).toHaveLength(2);
      expect(chestMoves.map((c) => c.name)).toEqual([
        "Barbell Bench Press",
        "Incline Dumbbell Press",
      ]);
    });

    it("combines equipment, muscle, and search query filters concurrently", () => {
      const combined = filterExercises(dataset, {
        query: "incline",
        equipment: ["dumbbell"],
        muscles: ["chest"],
      });
      expect(combined).toHaveLength(1);
      expect(combined[0].name).toBe("Incline Dumbbell Press");
    });
  });

  describe("PR Calculation Engine", () => {
    it("calculates max weight, max reps, max volume, and estimated 1RM accurately", () => {
      const mockHistory = [
        {
          workoutId: "w1",
          sets: [
            { weightKg: 100, reps: 10, completedAt: 1720000000000 },
            { weightKg: 120, reps: 6, completedAt: 1720000100000 },
          ],
        },
        {
          workoutId: "w2",
          sets: [
            { weightKg: 110, reps: 8, completedAt: 1721000000000 },
            { weightKg: 130, reps: 5, completedAt: 1721000100000 },
          ],
        },
      ];

      const prs = computePRsFromHistory(mockHistory);
      expect(prs.maxWeightKg).toBe(130);
      expect(prs.maxReps).toBe(10);
      expect(prs.maxVolumeKg).toBe(1000); // 100 * 10
      expect(prs.maxEstimated1RMKg).toBeCloseTo(151.7, 1); // 130 * (1 + 5/30)
      expect(prs.totalSetsCompleted).toBe(4);
    });
  });
});
