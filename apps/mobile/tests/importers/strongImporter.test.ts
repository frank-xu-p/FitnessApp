import { describe, it, expect } from "vitest";
import {
  parseStrongText,
  parseStrongCsv,
  parseSetLine,
  parseStrongDate,
  matchExerciseName,
  matchExerciseDetailed,
  resolveOrCreateExercise,
  importStrongAsWorkout,
  importStrongAsTemplate,
} from "../../lib/importers/strongImporter";

const SAMPLE_STRONG_TEXT = `Day 4 Push 2
Friday, August 28, 2026 at 20:01

Shoulder Press (Machine)
D: 240 lb × 6 reps
Set 1: 210 lb × 5 reps
D: 230 lb × 5 reps
Set 2: 210 lb × 5 reps

Iso-Lateral Decline Chest Press (Machine)
Set 1: 270 lb × 12 reps
Set 2: 270 lb × 12 reps

Triceps Pushdown (Cable-Rope)
D: 57.5 lb × 12 reps
Set 1: 42.5 lb × 5 reps
D: 57.5 lb × 10 reps
Set 2: 42.5 lb × 4 reps

Y Lateral Raises (Cable)
D: 60 lb × 11 reps
D: 54 lb × 10 reps
D: 46 lb × 10 reps
Set 1: 40 lb × 15 reps

Chest Fly
Set 1: 145 lb × 20 reps
Set 2: 145 lb × 20 reps

Iso lateral Reverse Fly
Set 1: 125 lb × 20 reps

Shrug (Machine)
Set 1: 250 lb × 20 reps

Overhead Triceps Extension (Cable-Straight Bar)
Set 1: 120 lb × 14 reps
Set 2: 120 lb × 10 reps`;

const mockDatabaseExercises: any[] = [
  {
    id: "ex_shoulder_press",
    name: "Shoulder Press (Machine)",
    equipment: "machine",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "ex_triceps_pushdown",
    name: "Triceps Pushdown",
    equipment: "cable",
    movementGroup: "triceps-pushdown",
    variantLabel: "Straight Bar",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
  },
  {
    id: "ex_triceps_pushdown_rope",
    name: "Cable Rope Triceps Pushdown",
    equipment: "cable",
    movementGroup: "triceps-pushdown",
    variantLabel: "Rope",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
  },
  {
    id: "ex_chest_fly",
    name: "Chest Fly",
    equipment: "dumbbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders"],
  },
  {
    id: "ex_upper_back_stretch",
    name: "Upper Back Stretch",
    equipment: "bodyweight",
    primaryMuscles: ["back"],
    secondaryMuscles: [],
  },
];

describe("Strong App Data Import Engine", () => {
  describe("Plain-Text Parser (`parseStrongText`)", () => {
    it("extracts workout title and date timestamp accurately", () => {
      const parsed = parseStrongText(SAMPLE_STRONG_TEXT, mockDatabaseExercises);

      expect(parsed.title).toBe("Day 4 Push 2");
      const date = new Date(parsed.startedAt);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(7); // August (0-indexed)
      expect(date.getDate()).toBe(28);
    });

    it("parses all 8 exercises with 100% precision from sample", () => {
      const parsed = parseStrongText(SAMPLE_STRONG_TEXT, mockDatabaseExercises);

      expect(parsed.exercises.length).toBe(8);

      const exerciseNames = parsed.exercises.map((e) => e.rawExerciseName);
      expect(exerciseNames).toEqual([
        "Shoulder Press (Machine)",
        "Iso-Lateral Decline Chest Press (Machine)",
        "Triceps Pushdown (Cable-Rope)",
        "Y Lateral Raises (Cable)",
        "Chest Fly",
        "Iso lateral Reverse Fly",
        "Shrug (Machine)",
        "Overhead Triceps Extension (Cable-Straight Bar)",
      ]);
    });

    it("parses all 20 sets including dropsets ('D:') and decimal weights with 100% precision", () => {
      const parsed = parseStrongText(SAMPLE_STRONG_TEXT, mockDatabaseExercises);

      const totalSets = parsed.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      expect(totalSets).toBe(20);

      // Exercise 1: Shoulder Press (Machine) - 4 sets (D, Set 1, D, Set 2)
      const ex1 = parsed.exercises[0];
      expect(ex1.sets.length).toBe(4);
      expect(ex1.sets[0]).toMatchObject({
        setType: "drop",
        weightRaw: 240,
        weightUnit: "lb",
        reps: 6,
      });
      expect(ex1.sets[1]).toMatchObject({
        setType: "standard",
        weightRaw: 210,
        weightUnit: "lb",
        reps: 5,
      });
      expect(ex1.sets[2]).toMatchObject({
        setType: "drop",
        weightRaw: 230,
        weightUnit: "lb",
        reps: 5,
      });
      expect(ex1.sets[3]).toMatchObject({
        setType: "standard",
        weightRaw: 210,
        weightUnit: "lb",
        reps: 5,
      });

      // Exercise 3: Triceps Pushdown (Cable-Rope) - float weights 57.5 and 42.5
      const ex3 = parsed.exercises[2];
      expect(ex3.sets.length).toBe(4);
      expect(ex3.sets[0]).toMatchObject({
        setType: "drop",
        weightRaw: 57.5,
        weightUnit: "lb",
        reps: 12,
      });
      expect(ex3.sets[1]).toMatchObject({
        setType: "standard",
        weightRaw: 42.5,
        weightUnit: "lb",
        reps: 5,
      });
      expect(ex3.sets[2]).toMatchObject({
        setType: "drop",
        weightRaw: 57.5,
        weightUnit: "lb",
        reps: 10,
      });
      expect(ex3.sets[3]).toMatchObject({
        setType: "standard",
        weightRaw: 42.5,
        weightUnit: "lb",
        reps: 4,
      });

      // Exercise 7: Shrug (Machine) - 1 set of 250 lb x 20 reps
      const ex7 = parsed.exercises[6];
      expect(ex7.sets.length).toBe(1);
      expect(ex7.sets[0]).toMatchObject({
        setType: "standard",
        weightRaw: 250,
        weightUnit: "lb",
        reps: 20,
      });
    });

    it("parses Warmup ('W:') and Failure ('F:') tags properly", () => {
      const customSample = `Leg Day Blast
2026-08-29 10:00:00

Barbell Squat
W: 135 lb × 10 reps
Set 1: 225 lb × 8 reps
F: 275 lb × 4 reps`;

      const parsed = parseStrongText(customSample);
      expect(parsed.exercises[0].sets[0].setType).toBe("warmup");
      expect(parsed.exercises[0].sets[1].setType).toBe("standard");
      expect(parsed.exercises[0].sets[2].setType).toBe("failure");
    });
  });

  describe("Exercise Matcher (`matchExerciseDetailed`)", () => {
    it("auto-matches exact names and never silently fuzzy-matches", () => {
      const exact = matchExerciseDetailed(
        "Shoulder Press (Machine)",
        mockDatabaseExercises
      );
      expect(exact.exact?.id).toBe("ex_shoulder_press");
      expect(exact.suggestions).toEqual([]);

      // Close but not exact: no auto-match, suggestions offered instead.
      // (Real-world case: "Upper Back Row" must NOT silently become
      // "Upper Back Stretch".)
      const fuzzy = matchExerciseDetailed(
        "Upper Back Row",
        mockDatabaseExercises
      );
      expect(fuzzy.exact).toBeNull();
      expect(
        fuzzy.suggestions.some((s) => s.id === "ex_upper_back_stretch")
      ).toBe(true);
    });

    it("offers no suggestions for completely unknown names", () => {
      const res = matchExerciseDetailed(
        "Quantum Flux Capacitor Lift",
        mockDatabaseExercises
      );
      expect(res.exact).toBeNull();
      expect(res.suggestions).toEqual([]);
    });

    it("legacy matchExerciseName resolves variants through the group", () => {
      const match2 = matchExerciseName(
        "Triceps Pushdown (Rope)",
        mockDatabaseExercises
      );
      expect(match2.exercise?.id).toBe("ex_triceps_pushdown_rope");
      expect(match2.confidence).toBe(1);
    });

    it("matches rope to rope, never silently to the straight-bar base", () => {
      const rope = matchExerciseDetailed(
        "Triceps Pushdown (Rope)",
        mockDatabaseExercises
      );
      expect(rope.exact?.id).toBe("ex_triceps_pushdown_rope");
      expect(rope.suggestions).toEqual([]);
      expect(rope.movementGroup).toBe("triceps-pushdown");

      // Strong's "(Cable-Rope)" canonicalizes to the catalog's "Rope" label
      // and auto-matches the same variant.
      const cableRope = matchExerciseDetailed(
        "Triceps Pushdown (Cable-Rope)",
        mockDatabaseExercises
      );
      expect(cableRope.exact?.id).toBe("ex_triceps_pushdown_rope");
      expect(cableRope.suggestions).toEqual([]);
      expect(cableRope.variantLabel).toBe("Rope");

      // Unknown variant in a known group: no silent match — offer the
      // group's variants so the user picks or creates a new one.
      const vbar = matchExerciseDetailed(
        "Triceps Pushdown (V-Bar)",
        mockDatabaseExercises
      );
      expect(vbar.exact).toBeNull();
      expect(vbar.movementGroup).toBe("triceps-pushdown");
      expect(vbar.variantLabel).toBe("V Bar");
      expect(vbar.suggestions.map((s) => s.id).sort()).toEqual([
        "ex_triceps_pushdown",
        "ex_triceps_pushdown_rope",
      ]);
      // Suggestions carry display names ("Triceps Pushdown · Rope").
      expect(
        vbar.suggestions.some((s) => s.name === "Triceps Pushdown · Rope")
      ).toBe(true);
    });
  });

  describe("User-resolved import (`resolveOrCreateExercise`)", () => {
    const chosenDb = (rows: any[]) => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => rows,
          }),
        }),
      }),
      insert: () => ({
        values: (val: any) => ({
          onConflictDoNothing: () => Promise.resolve(val),
        }),
      }),
    });

    it("uses the user's chosen suggestion over the automatic match", async () => {
      const picked = { id: "ex_chosen", name: "Chosen One" };
      const block: any = {
        rawExerciseName: "Triceps Pushdown (Cable-Rope)",
        matchedExerciseId: undefined,
        suggestions: [{ id: "ex_chosen", name: "Chosen One", score: 0.8 }],
        chosenExerciseId: "ex_chosen",
        sets: [],
      };
      const ex = await resolveOrCreateExercise(block, chosenDb([picked]));
      expect(ex.id).toBe("ex_chosen");
    });

    it("creates a new exercise when the user rejects all suggestions", async () => {
      const block: any = {
        rawExerciseName: "Upper Back Row",
        suggestions: [{ id: "ex_stretch", name: "Upper Back Stretch", score: 0.7 }],
        createNewExercise: true,
        sets: [],
      };
      const ex = await resolveOrCreateExercise(block, chosenDb([]));
      expect(ex.name).toBe("Upper Back Row");
      expect(ex.id.startsWith("custom_")).toBe(true);
    });

    it("tags created exercises with their movement group and variant", async () => {
      const block: any = {
        rawExerciseName: "Triceps Pushdown (V-Bar)",
        suggestions: [],
        createNewExercise: true,
        movementGroup: "triceps-pushdown",
        suggestedVariantLabel: "V Bar",
        sets: [],
      };
      let inserted: any = null;
      const dbCapture = {
        select: () => ({
          from: () => ({ where: () => ({ limit: () => [] as any[] }) }),
        }),
        insert: () => ({
          values: (val: any) => {
            inserted = val;
            return { onConflictDoNothing: () => Promise.resolve(val) };
          },
        }),
      };
      const ex = await resolveOrCreateExercise(block, dbCapture);
      expect(ex.name).toBe("Triceps Pushdown (V-Bar)");
      expect(inserted.movementGroup).toBe("triceps-pushdown");
      expect(inserted.variantLabel).toBe("V Bar");
    });
  });

  describe("Strong Official CSV Importer (`parseStrongCsv`)", () => {
    it("parses multi-row Strong CSV exports correctly", () => {
      const csvData = `"Date","Workout Name","Exercise Name","Set Order","Weight","Reps","RPE","Distance","Seconds","Notes"
"2026-08-28 20:01:00","Day 4 Push 2","Shoulder Press (Machine)","1","240","6","8.5","","","Drop set"
"2026-08-28 20:01:00","Day 4 Push 2","Shoulder Press (Machine)","2","210","5","8","","",""
"2026-08-28 20:01:00","Day 4 Push 2","Chest Fly","1","145","20","9","","",""`;

      const workouts = parseStrongCsv(csvData, mockDatabaseExercises);
      expect(workouts.length).toBe(1);
      expect(workouts[0].title).toBe("Day 4 Push 2");
      expect(workouts[0].exercises.length).toBe(2);
      expect(workouts[0].exercises[0].sets.length).toBe(2);
      expect(workouts[0].exercises[0].sets[0].setType).toBe("drop");
      expect(workouts[0].exercises[0].sets[0].weightRaw).toBe(240);
      expect(workouts[0].exercises[0].sets[0].reps).toBe(6);
    });
  });

  describe("Database Relational Insertion Logic", () => {
    it("creates foreign-key relational records for Workout Logs and Templates", async () => {
      const mockInsertedWorkouts: any[] = [];
      const mockInsertedSets: any[] = [];
      const mockInsertedTemplates: any[] = [];
      const mockInsertedTemplateExercises: any[] = [];
      const mockInsertedExercises: any[] = [];

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => [],
            }),
          }),
        }),
        insert: (table: any) => ({
          values: (val: any) => {
            const tableName = table.name || table._?.name || "";
            if (tableName === "workouts" || table._?.name === "workouts") {
              mockInsertedWorkouts.push(val);
            } else if (tableName === "sets" || table._?.name === "sets") {
              mockInsertedSets.push(val);
            } else if (tableName === "workout_templates" || table._?.name === "workout_templates") {
              mockInsertedTemplates.push(val);
            } else if (tableName === "template_exercises" || table._?.name === "template_exercises") {
              mockInsertedTemplateExercises.push(val);
            } else if (tableName === "exercises" || table._?.name === "exercises") {
              mockInsertedExercises.push(val);
            }
            return {
              onConflictDoNothing: () => Promise.resolve(),
            };
          },
        }),
      };

      const parsed = parseStrongText(SAMPLE_STRONG_TEXT, mockDatabaseExercises);

      // 1. Test Workout Log Import
      const resultLog = await importStrongAsWorkout(parsed, "user_123", mockDb);
      expect(resultLog.workout.id).toBeDefined();
      expect(resultLog.workout.title).toBe("Day 4 Push 2");
      expect(resultLog.sets.length).toBe(20);

      // Verify foreign keys
      for (const s of resultLog.sets) {
        expect(s.workoutId).toBe(resultLog.workout.id);
        expect(s.exerciseId).toBeDefined();
      }

      // 2. Test Template Import
      const resultTemplate = await importStrongAsTemplate(parsed, "user_123", "Push 2 Routine", mockDb);
      expect(resultTemplate.template.id).toBeDefined();
      expect(resultTemplate.template.name).toBe("Push 2 Routine");
      expect(resultTemplate.templateExercises.length).toBe(8);

      for (const te of resultTemplate.templateExercises) {
        expect(te.templateId).toBe(resultTemplate.template.id);
        expect(te.exerciseId).toBeDefined();
        expect(te.targetSets).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
