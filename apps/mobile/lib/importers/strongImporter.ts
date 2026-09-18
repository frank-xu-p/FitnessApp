import { toCanonical } from "../units";
import { generateUuid } from "../id";
import {
  exercises,
  workouts,
  sets,
  workoutTemplates,
  templateExercises,
} from "../../db/schema";
import type { Exercise, Workout, Set, WorkoutTemplate, TemplateExercise } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import {
  findMovementGroup,
  deriveVariantLabel,
  getExerciseDisplayName,
} from "../exerciseVariants";

export type StrongSetType = "standard" | "warmup" | "drop" | "failure";

export type ParsedSet = {
  setNumber: number;
  setType: StrongSetType;
  weightKg: number | null;
  weightRaw: number | null;
  weightUnit: "lb" | "kg" | null;
  reps: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;
};

export type ParsedExerciseBlock = {
  rawExerciseName: string;
  matchedExerciseId?: string;
  matchedExerciseName?: string;
  /** Close-but-not-exact candidates for the user to pick from. */
  suggestions: ExerciseSuggestion[];
  /** Set by the import UI when the user picks a suggestion. */
  chosenExerciseId?: string | null;
  /** Set by the import UI when the user chooses to create a new exercise. */
  createNewExercise?: boolean;
  /** Movement group detected from the raw name (variant-aware matching). */
  movementGroup?: string | null;
  /** Variant label derived from the raw name, used when creating the exercise. */
  suggestedVariantLabel?: string | null;
  sets: ParsedSet[];
};

export type ParsedWorkout = {
  title: string;
  startedAt: number;
  completedAt?: number | null;
  notes?: string | null;
  exercises: ParsedExerciseBlock[];
};

/** A close-but-not-exact catalog candidate for the user to review. */
export type ExerciseSuggestion = {
  id: string;
  name: string;
  score: number;
};

const SUGGESTION_THRESHOLD = 0.45;
const MAX_SUGGESTIONS = 3;

/**
 * Normalizes a string by lowercasing, removing punctuation, and collapsing whitespace.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Levenshtein Distance similarity ratio between two strings (0.0 to 1.0).
 */
function computeSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = new Set(normA.split(" "));
  const tokensB = new Set(normB.split(" "));
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const tokenScore = (2 * intersection) / (tokensA.size + tokensB.size);

  const matrix: number[][] = [];
  for (let i = 0; i <= normA.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= normB.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= normA.length; i++) {
    for (let j = 1; j <= normB.length; j++) {
      if (normA[i - 1] === normB[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(normA.length, normB.length);
  const levScore = 1 - matrix[normA.length][normB.length] / maxLen;

  return Math.max(tokenScore, levScore);
}

/** Best-effort equipment guess from keywords in a raw exercise name. */
export function guessEquipmentFromName(rawName: string): string {
  const lower = rawName.toLowerCase();
  if (lower.includes("machine")) return "machine";
  if (lower.includes("cable")) return "cable";
  if (lower.includes("dumbbell") || lower.includes(" db ") || lower.endsWith(" db")) return "dumbbell";
  if (lower.includes("barbell")) return "barbell";
  if (lower.includes("kettlebell")) return "kettlebell";
  if (lower.includes("band")) return "bands";
  return "other";
}

/**
 * Matches an exercise name against the catalog.
 *
 * Only exact matches (ignoring case) auto-match. When the name belongs to a
 * known movement group (e.g. "Triceps Pushdown (Rope)"), matching is
 * variant-aware: an exact variant (same movement + same attachment) auto-
 * matches, otherwise the group's variants are offered as suggestions and the
 * old parenthetical-stripping fallback is skipped — stripping "(Rope)" and
 * matching the bare "Triceps Pushdown" would silently collapse rope into
 * straight-bar. Anything else returns ranked suggestions for the user to pick
 * from — or to reject in favor of creating a brand-new exercise. Never
 * silently fuzzy-matches.
 */
export function matchExerciseDetailed(
  rawName: string,
  candidateExercises: Exercise[] = []
): {
  exact: Exercise | null;
  suggestions: ExerciseSuggestion[];
  movementGroup: string | null;
  variantLabel: string | null;
} {
  if (!rawName || candidateExercises.length === 0) {
    return { exact: null, suggestions: [], movementGroup: null, variantLabel: null };
  }

  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  const exact =
    candidateExercises.find(
      (e) => e.name.toLowerCase() === lower || e.id.toLowerCase() === lower
    ) ?? null;
  if (exact) {
    return {
      exact,
      suggestions: [],
      movementGroup: exact.movementGroup ?? findMovementGroup(trimmed),
      variantLabel: exact.variantLabel ?? null,
    };
  }

  // Variant-aware path: resolve within the movement group, never across variants.
  const groupKey = findMovementGroup(trimmed);
  if (groupKey) {
    const equipment = guessEquipmentFromName(trimmed);
    const variantLabel = deriveVariantLabel(trimmed, equipment, groupKey);
    const variants = candidateExercises.filter((e) => e.movementGroup === groupKey);
    const variantMatch =
      variantLabel != null
        ? (variants.find(
            (e) => (e.variantLabel ?? "").toLowerCase() === variantLabel.toLowerCase()
          ) ?? null)
        : null;
    if (variantMatch) {
      return {
        exact: variantMatch,
        suggestions: [],
        movementGroup: groupKey,
        variantLabel: variantMatch.variantLabel ?? null,
      };
    }
    const suggestions = variants
      .map((e) => ({
        id: e.id,
        name: getExerciseDisplayName(e),
        score: 1,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { exact: null, suggestions, movementGroup: groupKey, variantLabel };
  }

  const cleanRaw = trimmed.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
  const cleanExact =
    candidateExercises.find((e) => {
      const cleanCandidate = e.name
        .replace(/\s*\([^)]*\)/g, "")
        .trim()
        .toLowerCase();
      return cleanCandidate === cleanRaw;
    }) ?? null;
  if (cleanExact) {
    return {
      exact: cleanExact,
      suggestions: [],
      movementGroup: cleanExact.movementGroup ?? null,
      variantLabel: cleanExact.variantLabel ?? null,
    };
  }

  const scored: ExerciseSuggestion[] = [];
  for (const ex of candidateExercises) {
    const score = Math.max(
      computeSimilarity(trimmed, ex.name),
      computeSimilarity(cleanRaw, ex.name),
      ex.equipment ? computeSimilarity(trimmed, `${ex.name} ${ex.equipment}`) : 0
    );
    if (score >= SUGGESTION_THRESHOLD) {
      scored.push({ id: ex.id, name: ex.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const suggestions = scored
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .slice(0, MAX_SUGGESTIONS);

  return { exact: null, suggestions, movementGroup: null, variantLabel: null };
}

/**
 * Legacy matcher kept for compatibility: exact match when possible,
 * otherwise the top suggestion (callers that need user review should use
 * matchExerciseDetailed instead).
 */
export function matchExerciseName(
  rawName: string,
  candidateExercises: Exercise[] = []
): { exercise: Exercise | null; confidence: number } {
  const { exact, suggestions } = matchExerciseDetailed(
    rawName,
    candidateExercises
  );
  if (exact) {
    return { exercise: exact, confidence: 1.0 };
  }
  if (suggestions.length > 0) {
    const top = suggestions[0];
    const exercise = candidateExercises.find((e) => e.id === top.id) ?? null;
    return { exercise, confidence: top.score };
  }
  return { exercise: null, confidence: 0 };
}

/** Builds a ParsedExerciseBlock with exact-match / suggestions resolved. */
function makeExerciseBlock(
  rawName: string,
  candidateExercises: Exercise[],
  sets: ParsedSet[]
): ParsedExerciseBlock {
  const { exact, suggestions, movementGroup, variantLabel } = matchExerciseDetailed(rawName, candidateExercises);
  return {
    rawExerciseName: rawName,
    matchedExerciseId: exact?.id,
    matchedExerciseName: exact?.name,
    suggestions,
    movementGroup,
    suggestedVariantLabel: variantLabel,
    sets,
  };
}

/**
 * Parses a date string commonly outputted by Strong workout export.
 */
export function parseStrongDate(dateStr: string): number {
  if (!dateStr || typeof dateStr !== "string") return Date.now();

  const cleaned = dateStr
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, "")
    .replace(/\s+at\s+/i, " ")
    .trim();

  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  const direct = Date.parse(dateStr);
  if (!isNaN(direct) && direct > 0) {
    return direct;
  }

  return Date.now();
}

/**
 * Identifies if a line is a set specification or an exercise header / metadata line.
 */
function isSetLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return (
    /^(?:Set\s*\d+|D|W|F|Drop(?:\s*Set)?|Warmup|Failure|\d+)\s*:/i.test(trimmed) ||
    /^(?:Set\s*\d+|\d+)\s+/i.test(trimmed) ||
    /(?:lb|lbs|kg|kgs|reps?)\s*[×x*]/i.test(trimmed) ||
    /[×x*]\s*\d+\s*(?:reps?)?/i.test(trimmed)
  );
}

/**
 * Parses a single set line from Strong plain-text export.
 */
export function parseSetLine(line: string, currentSetIndex: number): ParsedSet | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let setType: StrongSetType = "standard";
  let setNumber = currentSetIndex + 1;
  let remaining = trimmed;

  const prefixMatch = trimmed.match(
    /^(?:(Set\s*(\d+)|D|W|F|Drop(?:\s*Set)?|Warmup|Failure)\s*:\s*)(.*)$/i
  );

  if (prefixMatch) {
    const tag = prefixMatch[1].toUpperCase();
    if (tag.startsWith("SET")) {
      setType = "standard";
      if (prefixMatch[2]) {
        setNumber = parseInt(prefixMatch[2], 10);
      }
    } else if (tag === "D" || tag.startsWith("DROP")) {
      setType = "drop";
    } else if (tag === "W" || tag.startsWith("WARMUP")) {
      setType = "warmup";
    } else if (tag === "F" || tag.startsWith("FAILURE")) {
      setType = "failure";
    }
    remaining = prefixMatch[3].trim();
  }

  let weightKg: number | null = null;
  let weightRaw: number | null = null;
  let weightUnit: "lb" | "kg" | null = null;
  let reps: number | null = null;
  let rpe: number | null = null;

  const rpeMatch = remaining.match(/@?\s*rpe\s*([\d.]+)/i);
  if (rpeMatch) {
    rpe = parseFloat(rpeMatch[1]);
    remaining = remaining.replace(rpeMatch[0], "").trim();
  }

  const weightRepsMatch = remaining.match(
    /(?:([\d.]+)\s*(lb|lbs|kg|kgs|bw)?)?\s*(?:[×x*]\s*([\d.]+))(?:\s*reps?)?/i
  );

  if (weightRepsMatch) {
    if (weightRepsMatch[1]) {
      weightRaw = parseFloat(weightRepsMatch[1]);
    }
    const unitStr = (weightRepsMatch[2] || "").toLowerCase();
    if (unitStr.startsWith("lb")) {
      weightUnit = "lb";
      weightKg = weightRaw != null ? toCanonical(weightRaw, "lb") : null;
    } else if (unitStr.startsWith("kg")) {
      weightUnit = "kg";
      weightKg = weightRaw != null ? toCanonical(weightRaw, "kg") : null;
    } else if (weightRaw != null) {
      weightUnit = "lb";
      weightKg = toCanonical(weightRaw, "lb");
    }

    if (weightRepsMatch[3]) {
      reps = parseInt(weightRepsMatch[3], 10);
    }
  } else {
    const numbers = remaining.match(/[\d.]+/g);
    if (numbers && numbers.length >= 2) {
      weightRaw = parseFloat(numbers[0]);
      weightUnit = remaining.toLowerCase().includes("kg") ? "kg" : "lb";
      weightKg = toCanonical(weightRaw, weightUnit);
      reps = parseInt(numbers[1], 10);
    } else if (numbers && numbers.length === 1) {
      reps = parseInt(numbers[0], 10);
    }
  }

  return {
    setNumber,
    setType,
    weightKg: weightKg != null && !isNaN(weightKg) ? Math.round(weightKg * 100) / 100 : null,
    weightRaw: weightRaw != null && !isNaN(weightRaw) ? weightRaw : null,
    weightUnit,
    reps: reps != null && !isNaN(reps) ? reps : null,
    rpe: rpe != null && !isNaN(rpe) ? rpe : null,
  };
}

/**
 * Parses Strong Plain-Text Clipboard Workout Share into structured data.
 */
export function parseStrongText(
  text: string,
  candidateExercises: Exercise[] = []
): ParsedWorkout {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      title: "Strong Workout",
      startedAt: Date.now(),
      exercises: [],
    };
  }

  const title = lines[0];
  let startIndex = 1;
  let startedAt = Date.now();

  if (lines.length > 1) {
    const potentialDate = lines[1];
    if (
      /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}-\d{2}-\d{2})/i.test(
        potentialDate
      )
    ) {
      startedAt = parseStrongDate(potentialDate);
      startIndex = 2;
    }
  }

  const exerciseBlocks: ParsedExerciseBlock[] = [];
  let currentExercise: ParsedExerciseBlock | null = null;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (isSetLine(line)) {
      if (currentExercise) {
        const parsedSet = parseSetLine(line, currentExercise.sets.length);
        if (parsedSet) {
          currentExercise.sets.push(parsedSet);
        }
      }
    } else {
      if (currentExercise && currentExercise.sets.length > 0) {
        exerciseBlocks.push(currentExercise);
      }

      currentExercise = makeExerciseBlock(line, candidateExercises, []);
    }
  }

  if (currentExercise && currentExercise.sets.length > 0) {
    exerciseBlocks.push(currentExercise);
  }

  return {
    title,
    startedAt,
    completedAt: startedAt + 3600 * 1000,
    exercises: exerciseBlocks,
  };
}

/**
 * Parses Strong Official CSV Export format.
 */
export function parseStrongCsv(
  csvContent: string,
  candidateExercises: Exercise[] = []
): ParsedWorkout[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const workoutNameIdx = headers.findIndex((h) => h.includes("workout"));
  const exerciseNameIdx = headers.findIndex((h) => h.includes("exercise"));
  const setOrderIdx = headers.findIndex((h) => h.includes("set"));
  const weightIdx = headers.findIndex((h) => h.includes("weight"));
  const repsIdx = headers.findIndex((h) => h.includes("rep"));
  const rpeIdx = headers.findIndex((h) => h.includes("rpe"));
  const notesIdx = headers.findIndex((h) => h.includes("note"));

  const workoutGroups = new Map<string, { title: string; date: number; rows: string[][] }>();

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
      .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      ?.map((val) => val.replace(/^"|"$/g, "").trim()) || lines[i].split(",").map((v) => v.trim());

    if (row.length === 0) continue;

    const rawDate = dateIdx >= 0 ? row[dateIdx] : "";
    const workoutName = workoutNameIdx >= 0 && row[workoutNameIdx] ? row[workoutNameIdx] : "Strong Workout";
    const timestamp = parseStrongDate(rawDate);
    const groupKey = `${rawDate}_${workoutName}`;

    if (!workoutGroups.has(groupKey)) {
      workoutGroups.set(groupKey, {
        title: workoutName,
        date: timestamp,
        rows: [],
      });
    }

    workoutGroups.get(groupKey)!.rows.push(row);
  }

  const results: ParsedWorkout[] = [];

  for (const group of workoutGroups.values()) {
    const exerciseMap = new Map<string, ParsedSet[]>();

    for (const r of group.rows) {
      const exName = exerciseNameIdx >= 0 && r[exerciseNameIdx] ? r[exerciseNameIdx] : "Exercise";
      const setOrderStr = setOrderIdx >= 0 && r[setOrderIdx] ? r[setOrderIdx] : "1";
      const weightRaw = weightIdx >= 0 && r[weightIdx] ? parseFloat(r[weightIdx]) : null;
      const reps = repsIdx >= 0 && r[repsIdx] ? parseInt(r[repsIdx], 10) : null;
      const rpe = rpeIdx >= 0 && r[rpeIdx] ? parseFloat(r[rpeIdx]) : null;
      const note = notesIdx >= 0 && r[notesIdx] ? r[notesIdx] : null;

      let setType: StrongSetType = "standard";
      let setNumber = parseInt(setOrderStr, 10) || 1;

      if (setOrderStr.toUpperCase().startsWith("D") || (note && note.toLowerCase().includes("drop"))) {
        setType = "drop";
      } else if (setOrderStr.toUpperCase().startsWith("W") || (note && note.toLowerCase().includes("warm"))) {
        setType = "warmup";
      } else if (setOrderStr.toUpperCase().startsWith("F") || (note && note.toLowerCase().includes("fail"))) {
        setType = "failure";
      }

      if (!exerciseMap.has(exName)) {
        exerciseMap.set(exName, []);
      }

      const weightKg = weightRaw != null ? toCanonical(weightRaw, "lb") : null;

      exerciseMap.get(exName)!.push({
        setNumber,
        setType,
        weightKg: weightKg != null ? Math.round(weightKg * 100) / 100 : null,
        weightRaw,
        weightUnit: "lb",
        reps: reps != null && !isNaN(reps) ? reps : null,
        rpe: rpe != null && !isNaN(rpe) ? rpe : null,
        notes: note,
      });
    }

    const exercisesList: ParsedExerciseBlock[] = [];
    for (const [rawExName, setsList] of exerciseMap.entries()) {
      exercisesList.push(makeExerciseBlock(rawExName, candidateExercises, setsList));
    }

    results.push({
      title: group.title,
      startedAt: group.date,
      completedAt: group.date + 3600 * 1000,
      exercises: exercisesList,
    });
  }

  return results;
}

/**
 * Ensures that an exercise exists in SQLite database, creating a new local/community exercise if unmatched.
 *
 * Honors the user's import-time choice: a picked suggestion (chosenExerciseId)
 * or an explicit "create new" (createNewExercise) wins over the automatic
 * exact match. Without a choice, falls back to the exact match, then a
 * case-insensitive name lookup, then creation.
 */
export async function resolveOrCreateExercise(
  block: ParsedExerciseBlock,
  database: any
): Promise<Exercise> {
  if (block.chosenExerciseId) {
    const chosen = await database
      .select()
      .from(exercises)
      .where(eq(exercises.id, block.chosenExerciseId))
      .limit(1);
    if (chosen.length > 0) {
      return chosen[0];
    }
  }

  if (!block.createNewExercise && block.matchedExerciseId) {
    const existing = await database
      .select()
      .from(exercises)
      .where(eq(exercises.id, block.matchedExerciseId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }
  }

  if (!block.createNewExercise) {
    const byName = await database
      .select()
      .from(exercises)
      .where(eq(sql`lower(${exercises.name})`, block.rawExerciseName.toLowerCase().trim()))
      .limit(1);

    if (byName.length > 0) {
      return byName[0];
    }
  }

  const now = Date.now();
  const id = `custom_${generateUuid()}`;
  const rawName = block.rawExerciseName.trim();
  const equipment = guessEquipmentFromName(rawName);
  const movementGroup = block.movementGroup ?? findMovementGroup(rawName);
  const newRow: Exercise = {
    id,
    name: rawName,
    equipment,
    primaryMuscles: [],
    secondaryMuscles: [],
    cues: [],
    imageUrl: null,
    movementGroup,
    variantLabel:
      block.suggestedVariantLabel ??
      (movementGroup ? deriveVariantLabel(rawName, equipment, movementGroup) : null),
    trackingMode: "bilateral",
    source: "community",
    visibility: "private",
    reviewStatus: "approved",
    createdBy: "strong_import",
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };

  await database.insert(exercises).values(newRow).onConflictDoNothing();
  return newRow;
}

/**
 * Imports a ParsedWorkout into the local database as a completed Workout Log.
 */
export async function importStrongAsWorkout(
  parsed: ParsedWorkout,
  userId: string = "local",
  database: any
): Promise<{ workout: Workout; sets: Set[]; exercises: Exercise[] }> {
  const workoutId = generateUuid();
  const now = Date.now();
  const deviceId = `dev_${generateUuid()}`;

  const workoutRow: Workout = {
    id: workoutId,
    userId,
    title: parsed.title || "Strong Workout",
    templateId: null,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression",
    cadenceRate: "session",
    cadenceIncrementKg: 2.5,
    startedAt: parsed.startedAt,
    completedAt: parsed.completedAt ?? parsed.startedAt + 3600 * 1000,
    notes: parsed.notes ?? null,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };

  await database.insert(workouts).values(workoutRow);

  const createdSets: Set[] = [];
  const resolvedExercises: Exercise[] = [];

  for (const block of parsed.exercises) {
    const ex = await resolveOrCreateExercise(block, database);
    resolvedExercises.push(ex);

    for (let setIdx = 0; setIdx < block.sets.length; setIdx++) {
      const s = block.sets[setIdx];
      const setId = generateUuid();
      const setRow: Set = {
        id: setId,
        workoutId,
        exerciseId: ex.id,
        setNumber: s.setNumber || setIdx + 1,
        setType: s.setType,
        weightKg: s.weightKg,
        reps: s.reps,
        leftWeightKg: null,
        leftReps: null,
        rightWeightKg: null,
        rightReps: null,
        rpe: s.rpe ?? null,
        rir: null,
        durationSeconds: s.durationSeconds ?? null,
        restSeconds: 90,
        completedAt: parsed.completedAt ?? parsed.startedAt + setIdx * 120 * 1000,
        createdAt: now,
        updatedAt: now,
        clientTimestamp: now,
        deviceId,
        isDeleted: false,
      };

      await database.insert(sets).values(setRow);
      createdSets.push(setRow);
    }
  }

  return {
    workout: workoutRow,
    sets: createdSets,
    exercises: resolvedExercises,
  };
}

/**
 * Imports a ParsedWorkout into the local database as a reusable Workout Template.
 */
export async function importStrongAsTemplate(
  parsed: ParsedWorkout,
  userId: string = "local",
  customTemplateName: string = "",
  database: any
): Promise<{ template: WorkoutTemplate; templateExercises: TemplateExercise[]; exercises: Exercise[] }> {
  const templateId = generateUuid();
  const now = Date.now();

  const tplRow: WorkoutTemplate = {
    id: templateId,
    userId,
    name: customTemplateName || parsed.title || "Strong Template",
    notes: parsed.notes ?? `Imported from Strong workout on ${new Date(parsed.startedAt).toLocaleDateString()}`,
    category: "Strong Import",
    isPreset: false,
    autoOverloadEnabled: true,
    cadenceModel: "double_progression",
    cadenceRate: "session",
    cadenceIncrementKg: 2.5,
    createdAt: now,
    updatedAt: now,
    clientTimestamp: now,
    isDeleted: false,
  };

  await database.insert(workoutTemplates).values(tplRow);

  const createdTemplateExercises: TemplateExercise[] = [];
  const resolvedExercises: Exercise[] = [];

  for (let idx = 0; idx < parsed.exercises.length; idx++) {
    const block = parsed.exercises[idx];
    const ex = await resolveOrCreateExercise(block, database);
    resolvedExercises.push(ex);

    const targetSets = block.sets.length || 3;
    const topSet = block.sets.reduce(
      (max, s) => ((s.weightKg ?? 0) >= (max.weightKg ?? 0) ? s : max),
      block.sets[0] || { weightKg: null, reps: 10, rpe: 8 }
    );

    const teId = generateUuid();
    const teRow: TemplateExercise = {
      id: teId,
      templateId,
      exerciseId: ex.id,
      orderIndex: idx,
      targetSets,
      targetReps: topSet.reps ?? 10,
      targetWeightKg: topSet.weightKg ?? null,
      targetRpe: topSet.rpe ?? 8,
      restSeconds: 90,
      notes: null,
      createdAt: now,
      updatedAt: now,
      clientTimestamp: now,
      isDeleted: false,
    };

    await database.insert(templateExercises).values(teRow);
    createdTemplateExercises.push(teRow);
  }

  return {
    template: tplRow,
    templateExercises: createdTemplateExercises,
    exercises: resolvedExercises,
  };
}
