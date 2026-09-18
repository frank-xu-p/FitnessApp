/**
 * Movement-group / variant model for exercise naming.
 *
 * A "movement" is the canonical exercise (e.g. Triceps Pushdown); a "variant"
 * is one concrete way of doing it (Rope, Straight Bar, Seated Machine...).
 * Variants are stored on the exercise row as:
 *   movementGroup: stable key like "triceps-pushdown" (null = ungrouped)
 *   variantLabel:  short distinguishing label like "Rope" (null = base)
 * Display: "Triceps Pushdown · Rope", or just "Triceps Pushdown" for the base.
 *
 * The grouping rules below are deliberately conservative: an exercise joins a
 * group only when its normalized name exactly equals the group's core, so
 * "Hack Squat" never collapses into "Squat". Labels are derived
 * deterministically from the name; the few judgement calls (straight-bar
 * default for cable pushdowns) are explicit overrides.
 */

export type MovementGroupKey = string;

/** Group key -> display name. */
export const MOVEMENT_GROUPS: Record<string, string> = {
  "triceps-pushdown": "Triceps Pushdown",
  "triceps-extension": "Triceps Extension",
  "biceps-curl": "Biceps Curl",
  "shoulder-press": "Shoulder Press",
  "chest-press": "Chest Press",
  "bench-press": "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
  "calf-raise": "Calf Raise",
  crunch: "Crunch",
  "reverse-crunch": "Reverse Crunch",
  "lateral-raise": "Lateral Raise",
  "front-raise": "Front Raise",
  "upright-row": "Upright Row",
  "rear-delt-row": "Rear Delt Row",
  shrug: "Shrug",
  "leg-curl": "Leg Curl",
};

/** Group key -> accepted normalized cores (an exercise joins the group only
 *  when its normalized name is one of these, exactly). */
const MOVEMENT_GROUP_CORES: Record<string, string[]> = {
  "triceps-pushdown": ["triceps pushdown"],
  "triceps-extension": ["triceps extension"],
  "biceps-curl": ["curl"],
  "shoulder-press": ["shoulder press"],
  "chest-press": ["chest press"],
  "bench-press": ["bench press"],
  squat: ["squat"],
  deadlift: ["deadlift"],
  "calf-raise": ["calf raise"],
  crunch: ["crunch"],
  "reverse-crunch": ["reverse crunch"],
  "lateral-raise": ["lateral raise"],
  "front-raise": ["front raise"],
  "upright-row": ["upright row"],
  "rear-delt-row": ["rear delt row"],
  shrug: ["shrug"],
  "leg-curl": ["leg curl"],
};

const EQUIPMENT_WORDS = new Set([
  "cable", "dumbbell", "dumbbells", "barbell", "machine",
  "lever", "leverage", "hammer", "band", "bands",
  "kettlebell", "kettlebells", "smith", "ez", "e-z",
  "body", "ball", "exercise",
]);
const ATTACHMENT_WORDS = new Set([
  "rope", "ropes", "v-bar", "vbar", "v", "bar", "bars",
  "stirrup", "handle", "handles", "straight",
]);
const POSITION_WORDS = new Set([
  "seated", "standing", "lying", "incline", "decline",
  "one-arm", "onearm", "two-arm", "twoarm", "kneeling",
  "bent-over", "bentover", "overhead", "supine", "prone",
  "single", "single-arm",
]);
const FILLER_WORDS = new Set(["with", "a", "the", "and", "db", "dbs", "of", "on", "to", "attachment"]);
const MUSCLE_NOISE_WORDS = new Set(["bicep", "biceps"]);

const EQUIPMENT_DISPLAY: Record<string, string> = {
  "body only": "Bodyweight",
  bodyweight: "Bodyweight",
  bands: "Band",
  band: "Band",
  "e-z curl bar": "EZ Bar",
  kettlebells: "Kettlebell",
  kettlebell: "Kettlebell",
  "exercise ball": "Ball",
  cable: "Cable",
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  machine: "Machine",
  other: "Other",
};

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Normalizes a name for movement-group detection: strips equipment,
 * attachments, positions and filler so "Cable Rope Triceps Pushdown" and
 * "Triceps Pushdown (Rope)" both become "triceps pushdown".
 */
export function normalizeMovementName(name: string): string {
  return tokenize(name)
    .filter(
      (t) =>
        !EQUIPMENT_WORDS.has(t) &&
        !ATTACHMENT_WORDS.has(t) &&
        !POSITION_WORDS.has(t) &&
        !FILLER_WORDS.has(t) &&
        !MUSCLE_NOISE_WORDS.has(t)
    )
    .join(" ");
}

/** Returns the movement-group key for a name, or null when it matches no group. */
export function findMovementGroup(name: string): string | null {
  const norm = normalizeMovementName(name);
  for (const [key, cores] of Object.entries(MOVEMENT_GROUP_CORES)) {
    for (const core of cores) {
      if (norm === core) return key;
      // Variant spellings keep the core first: "Triceps Pushdown - Rope
      // Attachment", "Triceps Pushdown (Rope)". The separator requirement
      // keeps this conservative: "Hack Squat" and "Front Squat" never match
      // the "squat" core.
      if (
        norm.startsWith(core + " - ") ||
        norm.startsWith(core + " (") ||
        norm.startsWith(core + " with ")
      ) {
        return key;
      }
    }
  }
  return null;
}

/** Display name for a movement group key. */
export function getMovementDisplayName(groupKey: string): string {
  return MOVEMENT_GROUPS[groupKey] ?? groupKey;
}

function equipmentDisplay(equipment: string | null | undefined): string | null {
  if (!equipment) return null;
  const key = equipment.toLowerCase().trim();
  return EQUIPMENT_DISPLAY[key] ?? equipment;
}

/**
 * Derives the variant label from a name within its group, e.g.
 * "Cable Rope Triceps Pushdown" -> "Rope". Returns null for the base variant.
 * A parenthetical attachment ("(Rope Attachment)", "(V-Grip)", "(with rope)")
 * always wins.
 */
export function deriveVariantLabel(
  name: string,
  equipment: string | null | undefined,
  groupKey: string
): string | null {
  const paren = name.match(/\(([^)]*)\)/);
  if (paren) {
    let words = paren[1]
      .toLowerCase()
      .replace(/\battachment\b/g, "")
      .replace(/\bwith\b/g, " ")
      .replace(/[–—-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    // Strong writes "(Cable-Rope)" / "(Cable-Straight Bar)" but the catalog
    // labels are "Rope" / "Straight Bar" — drop the redundant equipment
    // prefix so variant labels canonicalize across spellings.
    const EQUIPMENT_PREFIX_WORDS = new Set([
      "cable",
      "machine",
      "dumbbell",
      "barbell",
      "band",
      "bands",
      "kettlebell",
    ]);
    while (words.length > 0 && EQUIPMENT_PREFIX_WORDS.has(words[0])) {
      words = words.slice(1);
    }
    if (words.length > 0) {
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  const coreWords = new Set<string>();
  for (const core of MOVEMENT_GROUP_CORES[groupKey] ?? []) {
    for (const w of core.split(" ")) coreWords.add(w);
  }
  const ownEquipment = new Set(
    (equipment ?? "").toLowerCase().replace(/[–—-]/g, " ").split(" ").filter(Boolean)
  );
  const brandWords = new Set(["lever", "leverage", "hammer"]);

  const keep = tokenize(name).filter(
    (t) =>
      !coreWords.has(t) &&
      !ownEquipment.has(t) &&
      !brandWords.has(t) &&
      !FILLER_WORDS.has(t) &&
      !MUSCLE_NOISE_WORDS.has(t)
  );
  if (keep.length > 0) {
    return keep.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // No distinguishing tokens: the cable pushdown default is a straight bar
  // (matches Strong's own convention); otherwise fall back to equipment.
  if (groupKey === "triceps-pushdown" && (equipment ?? "").toLowerCase() === "cable") {
    return "Straight Bar";
  }
  return equipmentDisplay(equipment);
}

export type VariantExercise = {
  id: string;
  name: string;
  equipment?: string | null;
  movementGroup?: string | null;
  variantLabel?: string | null;
};

/**
 * User-facing display name: "Triceps Pushdown · Rope", or the plain name
 * when the exercise has no group.
 */
export function getExerciseDisplayName(ex: VariantExercise): string {
  const group = ex.movementGroup;
  if (!group) return ex.name;
  const movement = getMovementDisplayName(group);
  if (ex.variantLabel) return `${movement} · ${ex.variantLabel}`;
  return movement;
}

/** Groups a flat exercise list into movement groups + ungrouped leftovers. */
export function groupExercises<T extends VariantExercise>(
  list: T[]
): { groupKey: string | null; displayName: string; items: T[] }[] {
  const byGroup = new Map<string | null, T[]>();
  for (const ex of list) {
    const key = ex.movementGroup ?? null;
    const arr = byGroup.get(key);
    if (arr) arr.push(ex);
    else byGroup.set(key, [ex]);
  }
  const result: { groupKey: string | null; displayName: string; items: T[] }[] = [];
  for (const [key, items] of byGroup) {
    result.push({
      groupKey: key,
      displayName: key ? getMovementDisplayName(key) : "",
      items,
    });
  }
  // Grouped movements first (alphabetical), then ungrouped.
  result.sort((a, b) => {
    if (a.groupKey && !b.groupKey) return -1;
    if (!a.groupKey && b.groupKey) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
  return result;
}
