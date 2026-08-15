import { roundToPlate, kgToLb, lbToKg, type WeightUnit } from "./units";

export type ProgressionRule = {
  targetReps: number;
  incrementKg: number;
};

export function rirToRpe(rir: number): number {
  return Math.max(1, 10 - rir);
}

export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

export function nextTargetWeight(params: {
  lastWeightKg: number;
  completedReps: number;
  targetReps: number;
  rpe: number;
  incrementKg: number;
  unit: WeightUnit;
}): number {
  const { lastWeightKg, completedReps, targetReps, rpe, incrementKg, unit } = params;

  // Base progression: if target reps met, increase by increment
  let adjustmentFactor = 1;

  if (rpe <= 7 && completedReps >= targetReps) {
    // Easy set + reps met: accelerate progression
    adjustmentFactor = 1.5;
  } else if (rpe >= 9.5 || completedReps < targetReps - 2) {
    // Very hard or failed reps: hold or deload
    adjustmentFactor = -1;
  } else if (completedReps >= targetReps) {
    // Normal progression
    adjustmentFactor = 1;
  } else {
    // Reps short but not failure: hold weight
    adjustmentFactor = 0;
  }

  const increment = unit === "lb" ? lbToKg(incrementKg) : incrementKg;
  const newWeightKg = lastWeightKg + increment * adjustmentFactor;
  return roundToPlate(Math.max(0, newWeightKg), unit);
}

export function suggestNextSetWeight(
  currentSets: Array<{ weightKg: number | null; reps: number | null; rpe: number | null }>,
  rule: ProgressionRule,
  unit: WeightUnit
): number | null {
  const completedSets = currentSets.filter((s) => s.weightKg != null && s.reps != null && s.rpe != null);
  if (completedSets.length === 0) return null;

  const last = completedSets[completedSets.length - 1];
  return nextTargetWeight({
    lastWeightKg: last.weightKg ?? 0,
    completedReps: last.reps ?? 0,
    targetReps: rule.targetReps,
    rpe: last.rpe ?? 7,
    incrementKg: rule.incrementKg,
    unit,
  });
}

export function defaultRule(equipment?: string | null): ProgressionRule {
  if (equipment === "dumbbell" || equipment === "machine") {
    return { targetReps: 8, incrementKg: 2 }; // smaller jumps
  }
  return { targetReps: 8, incrementKg: 2.5 }; // barbell default
}
