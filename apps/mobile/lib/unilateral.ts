/**
 * Canonical unilateral (per-side) set semantics.
 *
 * A set is "bilateral" when it carries `weightKg`/`reps`; otherwise it is
 * treated as unilateral and the per-side columns (`leftWeightKg`/`leftReps`,
 * `rightWeightKg`/`rightReps`) are used. Every consumer of set data —
 * history, PRs, analytics, volume, templates, and the overload engine —
 * must go through these helpers so per-side work is never invisible.
 */

export type SetLike = {
  weightKg: number | null | undefined;
  reps: number | null | undefined;
  leftWeightKg: number | null | undefined;
  leftReps: number | null | undefined;
  rightWeightKg: number | null | undefined;
  rightReps: number | null | undefined;
};

export type TrackingMode = "bilateral" | "unilateral" | "alternating";

/** True when the set carries no bilateral weight/reps but has per-side data. */
export function isUnilateralSet(s: SetLike): boolean {
  return (
    s.weightKg == null &&
    (s.leftWeightKg != null ||
      s.rightWeightKg != null ||
      s.leftReps != null ||
      s.rightReps != null)
  );
}

/**
 * The representative weight of a set: bilateral weight when present,
 * otherwise the heavier of the two per-side weights.
 */
export function effectiveWeightKg(s: SetLike): number | null {
  if (s.weightKg != null) return s.weightKg;
  const sides = [s.leftWeightKg, s.rightWeightKg].filter(
    (v): v is number => v != null
  );
  return sides.length > 0 ? Math.max(...sides) : null;
}

/**
 * The representative rep count of a set: bilateral reps when present,
 * otherwise the higher of the two per-side rep counts.
 */
export function effectiveReps(s: SetLike): number | null {
  if (s.reps != null) return s.reps;
  const sides = [s.leftReps, s.rightReps].filter(
    (v): v is number => v != null
  );
  return sides.length > 0 ? Math.max(...sides) : null;
}

/**
 * Total set volume in kg. Bilateral sets count `weightKg × reps`; unilateral
 * sets count each side's `weight × reps` and sum them.
 */
export function setVolumeKg(s: SetLike): number {
  if (s.weightKg != null && s.reps != null) {
    return s.weightKg * s.reps;
  }
  let vol = 0;
  if (s.leftWeightKg != null && s.leftReps != null) {
    vol += s.leftWeightKg * s.leftReps;
  }
  if (s.rightWeightKg != null && s.rightReps != null) {
    vol += s.rightWeightKg * s.rightReps;
  }
  return vol;
}

/**
 * Whether a set holds the minimum data required to be marked complete,
 * given the exercise's tracking mode. Never invent data at completion time.
 */
export function hasRequiredDataForCompletion(
  s: SetLike,
  trackingMode: TrackingMode | null | undefined
): boolean {
  if (trackingMode === "unilateral") {
    return (
      s.leftWeightKg != null &&
      s.leftReps != null &&
      s.rightWeightKg != null &&
      s.rightReps != null
    );
  }
  return s.weightKg != null && s.reps != null;
}
