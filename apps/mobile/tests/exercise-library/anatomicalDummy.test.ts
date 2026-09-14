import { describe, it, expect, vi } from "vitest";

// State machine for Anatomical Dummy
export class AnatomicalDummyModel {
  view: "front" | "back" = "front";
  selectedMuscle: string | null = null;
  onSelectMuscle: (m: string | null) => void;

  constructor(
    initialMuscle: string | null = null,
    onSelectMuscle: (m: string | null) => void = () => {}
  ) {
    this.selectedMuscle = initialMuscle;
    this.onSelectMuscle = onSelectMuscle;
  }

  setView(newView: "front" | "back") {
    this.view = newView;
  }

  isSelected(muscle: string): boolean {
    if (!this.selectedMuscle) return false;
    const norm = this.selectedMuscle.toLowerCase();
    if (norm === muscle) return true;
    if (muscle === "traps" && (norm === "trapezius" || norm === "neck")) return true;
    if (muscle === "lats" && (norm === "latissimus dorsi" || norm === "back")) return true;
    if (muscle === "quadriceps" && (norm === "quads" || norm === "legs")) return true;
    if (muscle === "abdominals" && (norm === "abs" || norm === "core")) return true;
    return false;
  }

  toggleMuscle(muscle: string) {
    if (this.isSelected(muscle)) {
      this.selectedMuscle = null;
      this.onSelectMuscle(null);
    } else {
      this.selectedMuscle = muscle;
      this.onSelectMuscle(muscle);
    }
  }

  clearSelection() {
    this.selectedMuscle = null;
    this.onSelectMuscle(null);
  }

  getVisibleMuscleGroups(): string[] {
    if (this.view === "front") {
      return [
        "traps",
        "shoulders",
        "chest",
        "biceps",
        "forearms",
        "abdominals",
        "quadriceps",
        "calves",
      ];
    } else {
      return [
        "traps",
        "shoulders",
        "triceps",
        "lats",
        "lower back",
        "glutes",
        "hamstrings",
        "calves",
      ];
    }
  }
}

describe("Anatomical Dummy - State & Interactive Filtering", () => {
  it("initializes in front view by default and toggles cleanly between front and back views", () => {
    const model = new AnatomicalDummyModel();
    expect(model.view).toBe("front");
    expect(model.getVisibleMuscleGroups()).toContain("chest");
    expect(model.getVisibleMuscleGroups()).toContain("biceps");
    expect(model.getVisibleMuscleGroups()).not.toContain("lats");

    // Toggle to Back view
    model.setView("back");
    expect(model.view).toBe("back");
    expect(model.getVisibleMuscleGroups()).toContain("lats");
    expect(model.getVisibleMuscleGroups()).toContain("triceps");
    expect(model.getVisibleMuscleGroups()).toContain("glutes");
    expect(model.getVisibleMuscleGroups()).not.toContain("chest");
  });

  it("toggles muscle group selection and fires onSelectMuscle callback", () => {
    const callback = vi.fn();
    const model = new AnatomicalDummyModel(null, callback);

    // Select chest
    model.toggleMuscle("chest");
    expect(model.selectedMuscle).toBe("chest");
    expect(model.isSelected("chest")).toBe(true);
    expect(callback).toHaveBeenCalledWith("chest");

    // Select again -> toggles off (clears)
    model.toggleMuscle("chest");
    expect(model.selectedMuscle).toBeNull();
    expect(model.isSelected("chest")).toBe(false);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it("normalizes muscle group aliases correctly", () => {
    const model = new AnatomicalDummyModel("abs");
    expect(model.isSelected("abdominals")).toBe(true);

    model.selectedMuscle = "quads";
    expect(model.isSelected("quadriceps")).toBe(true);

    model.selectedMuscle = "trapezius";
    expect(model.isSelected("traps")).toBe(true);

    model.selectedMuscle = "back";
    expect(model.isSelected("lats")).toBe(true);
  });

  it("clears selection when clear button is pressed", () => {
    const callback = vi.fn();
    const model = new AnatomicalDummyModel("shoulders", callback);
    expect(model.selectedMuscle).toBe("shoulders");

    model.clearSelection();
    expect(model.selectedMuscle).toBeNull();
    expect(callback).toHaveBeenCalledWith(null);
  });
});
