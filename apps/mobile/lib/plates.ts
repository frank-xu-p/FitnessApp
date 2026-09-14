import type { WeightUnit } from "./units";

export type PlateDenomination = {
  id: string;
  weight: number;
  count: number;
};

export type PlateCount = {
  weight: number;
  count: number;
};

export type PlateLoadResult = {
  ok: boolean;
  perSide: number;
  loadedPerSide: number;
  plates: PlateCount[];
  remainder: number;
  error: string | null;
};

export const DEFAULT_BAR_BY_UNIT: Record<WeightUnit, number> = {
  kg: 20,
  lb: 45,
};

export const DEFAULT_INVENTORY_BY_UNIT: Record<WeightUnit, PlateDenomination[]> = {
  kg: [
    { id: "kg-25", weight: 25, count: 6 },
    { id: "kg-20", weight: 20, count: 6 },
    { id: "kg-10", weight: 10, count: 6 },
    { id: "kg-5", weight: 5, count: 6 },
    { id: "kg-2.5", weight: 2.5, count: 6 },
  ],
  lb: [
    { id: "lb-45", weight: 45, count: 6 },
    { id: "lb-25", weight: 25, count: 6 },
    { id: "lb-10", weight: 10, count: 6 },
    { id: "lb-5", weight: 5, count: 6 },
    { id: "lb-2.5", weight: 2.5, count: 6 },
  ],
};

const EPSILON = 1e-6;

export function createPlateId(unit: WeightUnit, weight: number): string {
  return `${unit}-${weight}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sortInventory(inventory: PlateDenomination[]): PlateDenomination[] {
  return [...inventory].sort((a, b) => b.weight - a.weight);
}

export function calculatePlatesPerSide(
  targetWeight: number,
  barWeight: number,
  inventory: PlateDenomination[]
): PlateLoadResult {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight)) {
    return errorResult(0, "Enter a valid target and bar weight.");
  }

  if (targetWeight < barWeight - EPSILON) {
    return errorResult(0, "Target is lighter than the empty barbell.");
  }

  const perSide = (targetWeight - barWeight) / 2;
  if (perSide <= EPSILON) {
    return {
      ok: true,
      perSide: 0,
      loadedPerSide: 0,
      plates: [],
      remainder: 0,
      error: null,
    };
  }

  const usable = sortInventory(inventory).filter((item) => item.weight > 0 && item.count > 0);
  const plates: PlateCount[] = [];
  let remaining = perSide;

  for (const item of usable) {
    const maxFit = Math.floor((remaining + EPSILON) / item.weight);
    const used = Math.min(maxFit, Math.floor(item.count));
    if (used <= 0) continue;
    plates.push({ weight: item.weight, count: used });
    remaining -= used * item.weight;
  }

  remaining = Math.max(0, remaining);
  const loadedPerSide = perSide - remaining;
  const ok = remaining <= EPSILON;

  return {
    ok,
    perSide,
    loadedPerSide,
    plates,
    remainder: ok ? 0 : roundRemainder(remaining),
    error: ok
      ? null
      : `Cannot load exactly ${formatNumber(perSide)} per side. Remainder: ${formatNumber(roundRemainder(remaining))}.`,
  };
}

export function formatPlateCounts(plates: PlateCount[], unit: WeightUnit): string {
  if (plates.length === 0) return "Bar only";
  return plates
    .map((plate) => `${plate.count}× ${formatNumber(plate.weight)} ${unit}`)
    .join(" + ");
}

export function recommendDropSetWeight(currentWeight: number): number {
  return Math.max(0, currentWeight * 0.825);
}

function errorResult(perSide: number, error: string): PlateLoadResult {
  return {
    ok: false,
    perSide,
    loadedPerSide: 0,
    plates: [],
    remainder: 0,
    error,
  };
}

function roundRemainder(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

export function cloneInventory(inventory: PlateDenomination[]): PlateDenomination[] {
  return inventory.map((item) => ({ ...item }));
}
