export type WeightUnit = "kg" | "lb";

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function toDisplay(weightKg: number | null | undefined, unit: WeightUnit): number | null {
  if (weightKg == null) return null;
  return unit === "lb" ? kgToLb(weightKg) : weightKg;
}

export function toCanonical(weight: number | null | undefined, unit: WeightUnit): number | null {
  if (weight == null) return null;
  return unit === "lb" ? lbToKg(weight) : weight;
}

export function formatWeight(weightKg: number | null | undefined, unit: WeightUnit): string {
  if (weightKg == null) return "—";
  const display = toDisplay(weightKg, unit) ?? 0;
  return `${display.toFixed(unit === "lb" ? 0 : 1)} ${unit}`;
}

export function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function roundToPlate(weightKg: number, unit: WeightUnit): number {
  const step = unit === "lb" ? lbToKg(2.5) : 0.5;
  return roundToNearest(weightKg, step);
}
