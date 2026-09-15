import { roundToPlate, kgToLb, lbToKg, type WeightUnit } from "./units";

export type ProgressionModel = "double_progression" | "rpe_autoregulated" | "linear";
export type CadenceRate = "session" | "weekly" | "biweekly";

export type ProgressionRule = {
  targetReps: number;
  incrementKg: number;
  minReps?: number;
  maxReps?: number;
  targetRpe?: number;
  model?: ProgressionModel;
  cadenceRate?: CadenceRate;
};

export type ProgressionSuggestion = {
  suggestedWeightKg: number;
  suggestedReps: number;
  reason: string;
  incrementKg: number;
  isOverload: boolean;
  deltaKg: number;
};

export function rirToRpe(rir: number): number {
  return Math.max(1, Math.min(10, 10 - rir));
}

export function rpeToRir(rpe: number): number {
  return Math.max(0, Math.min(10, 10 - rpe));
}

/**
 * Default progression increment, stored in kg. When the user's display unit
 * is pounds, the same nominal increment is interpreted in pounds and
 * converted to kg (e.g. a 2.5 default becomes ~1.13 kg, not a 5.5 lb jump).
 */
export function defaultEquipmentIncrement(
  equipment?: string | null,
  unit: WeightUnit = "kg"
): number {
  let base: number;
  switch (equipment?.toLowerCase()) {
    case "dumbbell":
      base = 2.0; // 2-unit jump (1 per dumbbell or standard 2-unit pair increments)
      break;
    case "machine":
    case "cable":
      base = 2.5;
      break;
    case "bodyweight":
    case "weighted_bodyweight":
      base = 1.25;
      break;
    case "barbell":
    default:
      base = 2.5;
      break;
  }
  return unit === "lb" ? lbToKg(base) : base;
}

export function defaultRule(
  equipment?: string | null,
  unit: WeightUnit = "kg"
): ProgressionRule {
  const incrementKg = defaultEquipmentIncrement(equipment, unit);
  return {
    targetReps: 8,
    minReps: 8,
    maxReps: 12,
    targetRpe: 8,
    incrementKg,
    model: "double_progression",
    cadenceRate: "session",
  };
}

/**
 * Calculates the next target weight using the RPE-autoregulated model.
 */
export function nextTargetWeight(params: {
  lastWeightKg: number;
  completedReps: number;
  targetReps: number;
  rpe: number;
  incrementKg: number;
  unit: WeightUnit;
}): number {
  const { lastWeightKg, completedReps, targetReps, rpe, incrementKg, unit } = params;

  let adjustmentFactor = 1;

  if (rpe <= 7 && completedReps >= targetReps) {
    // Easy set: accelerate progression
    adjustmentFactor = 1.5;
  } else if (rpe >= 9.5 || completedReps < targetReps - 2) {
    // Very hard or missed reps: hold or deload
    adjustmentFactor = completedReps < targetReps - 3 ? -1 : 0;
  } else if (completedReps >= targetReps) {
    // Target met with good RPE
    adjustmentFactor = 1;
  } else {
    // Reps slightly short: hold weight
    adjustmentFactor = 0;
  }

  const effectiveIncrement = incrementKg;
  const newWeightKg = lastWeightKg + effectiveIncrement * adjustmentFactor;
  return roundToPlate(Math.max(0, newWeightKg), unit);
}

/**
 * Computes progressive overload suggestion based on previous session or sets data,
 * progression model, and cadence configuration.
 */
export function computeProgressionSuggestion(params: {
  lastWeightKg: number;
  lastReps: number;
  lastRpe?: number | null;
  targetReps?: number;
  minReps?: number;
  maxReps?: number;
  targetRpe?: number;
  incrementKg?: number;
  equipment?: string | null;
  model?: ProgressionModel;
  cadenceRate?: CadenceRate;
  /**
   * Timestamp of the last completed session for this exercise. When
   * cadenceRate is "weekly"/"biweekly", weight is only progressed if the
   * last progression window has fully elapsed (7 / 14 days) — otherwise
   * the engine honestly holds instead of pretending cadence does nothing.
   */
  lastSessionAt?: number | null;
  unit?: WeightUnit;
}): ProgressionSuggestion {
  const unit = params.unit ?? "kg";
  const equipment = params.equipment ?? "barbell";
  const incrementKg = params.incrementKg ?? defaultEquipmentIncrement(equipment, unit);
  const model: ProgressionModel = params.model ?? "double_progression";
  const targetReps = params.targetReps ?? 8;
  const minReps = params.minReps ?? Math.max(1, targetReps - 2);
  const maxReps = params.maxReps ?? (targetReps + 4);
  const targetRpe = params.targetRpe ?? 8;
  const cadenceRate: CadenceRate = params.cadenceRate ?? "session";
  const rpe = params.lastRpe ?? 8;
  const lastWeight = params.lastWeightKg;
  const lastReps = params.lastReps;

  const unitStep = incrementKg;


  // If initial/first session (no past weight logged)
  if (lastWeight <= 0 && lastReps <= 0) {
    return {
      suggestedWeightKg: 0,
      suggestedReps: targetReps,
      reason: "Initial baseline target",
      incrementKg,
      isOverload: false,
      deltaKg: 0,
    };
  }

  // H7: cadence gating. Weekly/biweekly only progress weight when the full
  // window has elapsed since the last session; otherwise hold honestly.
  if (
    (cadenceRate === "weekly" || cadenceRate === "biweekly") &&
    params.lastSessionAt != null
  ) {
    const windowMs = (cadenceRate === "weekly" ? 7 : 14) * 86400 * 1000;
    if (Date.now() - params.lastSessionAt < windowMs) {
      return {
        suggestedWeightKg: lastWeight,
        suggestedReps: Math.min(maxReps, Math.max(minReps, lastReps)),
        reason: `Cadence hold: ${cadenceRate} progression was already applied within the last ${
          cadenceRate === "weekly" ? "7" : "14"
        } days`,
        incrementKg,
        isOverload: false,
        deltaKg: 0,
      };
    }
  }

  if (model === "double_progression") {
    // Double Progression logic (thresholds are relative to targetRpe):
    // If completed reps hit or exceeded maxReps with RPE at/below target+0.5,
    // increase weight & reset reps to minReps.
    if (lastReps >= maxReps && rpe <= targetRpe + 0.5) {
      const newWeight = roundToPlate(lastWeight + unitStep, unit);
      const delta = Math.round((newWeight - lastWeight) * 100) / 100;
      return {
        suggestedWeightKg: newWeight,
        suggestedReps: minReps,
        reason: `Hit top of rep range (${lastReps}/${maxReps} reps @ RPE ${rpe}) -> Overload weight (+${unit === "lb" ? kgToLb(delta).toFixed(1) + " lb" : delta + " kg"}) & reset to ${minReps} reps`,
        incrementKg,
        isOverload: true,
        deltaKg: delta,
      };
    } else if (lastReps >= targetReps && lastReps < maxReps && rpe <= targetRpe) {
      // Still in rep progression phase
      const nextReps = Math.min(maxReps, lastReps + 1);
      return {
        suggestedWeightKg: lastWeight,
        suggestedReps: nextReps,
        reason: `Target met (${lastReps} reps @ RPE ${rpe}) -> Progressive rep target: aim for ${nextReps} reps`,
        incrementKg,
        isOverload: false,
        deltaKg: 0,
      };
    } else if (rpe >= targetRpe + 1.5 || lastReps < minReps) {
      // High effort or missed lower bound
      return {
        suggestedWeightKg: lastWeight,
        suggestedReps: targetReps,
        reason: `Consolidate weight (RPE ${rpe} / ${lastReps} reps) before increasing`,
        incrementKg,
        isOverload: false,
        deltaKg: 0,
      };
    } else {
      // Default sustain
      return {
        suggestedWeightKg: lastWeight,
        suggestedReps: Math.min(maxReps, Math.max(minReps, lastReps + 1)),
        reason: `Maintain ${lastWeight} kg and aim for +1 rep`,
        incrementKg,
        isOverload: false,
        deltaKg: 0,
      };
    }
  }

  if (model === "rpe_autoregulated") {
    let factor = 0;
    let explanation = "";

    if (rpe <= targetRpe - 1.0 && lastReps >= targetReps) {
      factor = 1.5;
      explanation = `Easy effort (RPE ${rpe}) -> Accelerated jump (+${(incrementKg * 1.5).toFixed(1)} kg)`;
    } else if (rpe <= targetRpe + 0.5 && lastReps >= targetReps) {
      factor = 1.0;
      explanation = `Target RPE met (${rpe}) -> Progressive overload (+${incrementKg} kg)`;
    } else if (rpe <= targetRpe + 1.0 && lastReps >= targetReps) {
      factor = 0.5;
      explanation = `RPE ${rpe} -> Microload increment (+${(incrementKg * 0.5).toFixed(1)} kg)`;
    } else if (rpe >= targetRpe + 1.5) {
      factor = 0;
      explanation = `High RPE (${rpe}) -> Hold current weight`;
    } else {
      factor = 0;
      explanation = `Reps short of target (${lastReps}/${targetReps}) -> Consolidate weight`;
    }

    const newWeight = roundToPlate(Math.max(0, lastWeight + unitStep * factor), unit);
    const delta = Math.round((newWeight - lastWeight) * 100) / 100;
    return {
      suggestedWeightKg: newWeight,
      suggestedReps: targetReps,
      reason: explanation,
      incrementKg,
      isOverload: delta > 0,
      deltaKg: delta,
    };
  }

  // Linear cadence model
  const newWeight = roundToPlate(lastWeight + unitStep, unit);
  const delta = Math.round((newWeight - lastWeight) * 100) / 100;
  return {
    suggestedWeightKg: newWeight,
    suggestedReps: targetReps,
    reason: `Cadence overload (+${unit === "lb" ? kgToLb(delta).toFixed(1) + " lb" : delta + " kg"})`,
    incrementKg,
    isOverload: true,
    deltaKg: delta,
  };
}

/**
 * Suggests the next set weight for an in-progress exercise using the
 * completed sets in the current workout. Only sets the user actually
 * completed (completedAt != null) feed the engine — prefilled-but-untouched
 * sets must never trigger progression.
 */
export function suggestNextSetWeight(
  currentSets: Array<{
    weightKg: number | null;
    reps: number | null;
    rpe: number | null;
    completedAt: number | null;
  }>,
  rule: ProgressionRule,
  unit: WeightUnit = "kg"
): number | null {
  const completedSets = currentSets.filter(
    (s) => s.completedAt != null && s.weightKg != null && s.reps != null
  );
  if (completedSets.length === 0) return null;

  const last = completedSets[completedSets.length - 1];
  const suggestion = computeProgressionSuggestion({
    lastWeightKg: last.weightKg ?? 0,
    lastReps: last.reps ?? rule.targetReps,
    lastRpe: last.rpe ?? rule.targetRpe ?? 8,
    targetReps: rule.targetReps,
    minReps: rule.minReps,
    maxReps: rule.maxReps,
    targetRpe: rule.targetRpe,
    incrementKg: rule.incrementKg,
    model: rule.model ?? "double_progression",
    cadenceRate: rule.cadenceRate ?? "session",
    unit,
  });

  return suggestion.suggestedWeightKg;
}
