export type SetType = "standard" | "warmup" | "drop" | "failure" | "rest_pause";

export const SET_TYPE_CONFIG: Record<
  SetType,
  { label: string; badge: string; color: string; bg: string; darkBg: string; description: string }
> = {
  standard: {
    label: "Standard Set",
    badge: "1",
    color: "#3B82F6",
    bg: "#EFF6FF",
    darkBg: "#1E293B",
    description: "Regular working set at target intensity",
  },
  drop: {
    label: "Drop Set",
    badge: "D",
    color: "#A855F7",
    bg: "#FAF5FF",
    darkBg: "#2E1065",
    description: "Lower weight immediately after failure to extend the set",
  },
  failure: {
    label: "Failure Set",
    badge: "F",
    color: "#EF4444",
    bg: "#FEF2F2",
    darkBg: "#450A0A",
    description: "Pushed to complete momentary muscular failure (RPE 10)",
  },
  warmup: {
    label: "Warmup Set",
    badge: "W",
    color: "#F97316",
    bg: "#FFF7ED",
    darkBg: "#431407",
    description: "Submaximal prep set not counted towards total working volume",
  },
  rest_pause: {
    label: "Rest-Pause",
    badge: "RP",
    color: "#06B6D4",
    bg: "#ECFEFF",
    darkBg: "#083344",
    description: "Short rest (10-15s) between cluster reps to push failure",
  },
};
