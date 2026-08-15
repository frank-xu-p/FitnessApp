import { roundToNearest, kgToLb, lbToKg, type WeightUnit } from "./units";

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

export type PlateResult = {
  perSideKg: number;
  plates: number[];
  remainderKg: number;
};

export function calculatePlatesPerSide(
  totalWeightKg: number,
  barWeightKg: number,
  availablePlatesKg: number[]
): PlateResult | null {
  const perSide = (totalWeightKg - barWeightKg) / 2;
  if (perSide < 0) return null;

  const sorted = [...availablePlatesKg].sort((a, b) => b - a);
  const plates: number[] = [];
  let remaining = perSide;
  const smallest = sorted[sorted.length - 1] ?? 0.25;

  for (const plate of sorted) {
    while (remaining >= plate - 1e-6) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  // If a tiny remainder exists, round to the nearest available plate.
  if (remaining > smallest / 2 && remaining < smallest) {
    plates.push(smallest);
    remaining = 0;
  }

  return { perSideKg: perSide, plates, remainderKg: Math.max(0, remaining) };
}

export function recommendDropSetWeight(currentWeightKg: number): number {
  const reduction = currentWeightKg * 0.175; // 17.5% drop
  return Math.max(0, currentWeightKg - reduction);
}

export function platesForDisplay(platesKg: number[], unit: WeightUnit): string {
  const values =
    unit === "lb" ? platesKg.map((p) => Math.round(kgToLb(p) * 10) / 10) : platesKg;
  return values.map((p) => `${p} ${unit}`).join(" + ");
}

export function sortPlates(plates: number[]): number[] {
  return [...plates].sort((a, b) => b - a);
}
