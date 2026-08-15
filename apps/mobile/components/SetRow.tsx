import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Check, Trash2, Calculator, ChevronDown } from "lucide-react-native";
import { useAuthStore } from "../store/useAuthStore";
import { toDisplay, toCanonical, formatWeight } from "../lib/units";
import type { Set, Exercise } from "../db/schema";

type SetRowProps = {
  set: Set;
  exercise: Exercise;
  index: number;
  onUpdate: (patch: Partial<Set>) => void;
  onComplete: (completedAt: number) => void;
  onDelete: () => void;
  onOpenPlateCalculator: (set: Set) => void;
};

const SET_TYPES = ["standard", "warmup", "drop", "failure"] as const;

export function SetRow({
  set,
  exercise,
  index,
  onUpdate,
  onComplete,
  onDelete,
  onOpenPlateCalculator,
}: SetRowProps) {
  const { displayUnit } = useAuthStore();
  const [showRpe, setShowRpe] = useState(false);
  const isUnilateral = exercise.trackingMode === "unilateral";
  const isCompleted = !!set.completedAt;

  const handleWeightChange = (value: string, side?: "left" | "right") => {
    const num = value === "" ? null : parseFloat(value);
    const kg = num === null ? null : toCanonical(num, displayUnit);
    if (side === "left") onUpdate({ leftWeightKg: kg });
    else if (side === "right") onUpdate({ rightWeightKg: kg });
    else onUpdate({ weightKg: kg });
  };

  const handleRepsChange = (value: string, side?: "left" | "right") => {
    const num = value === "" ? null : parseInt(value, 10);
    if (side === "left") onUpdate({ leftReps: num });
    else if (side === "right") onUpdate({ rightReps: num });
    else onUpdate({ reps: num });
  };

  const toggleComplete = () => {
    if (isCompleted) {
      onUpdate({ completedAt: null });
    } else {
      const now = Date.now();
      onUpdate({ completedAt: now });
      onComplete(now);
      setShowRpe(true);
    }
  };

  const displayWeight = toDisplay(set.weightKg, displayUnit) ?? "";
  const leftDisplay = toDisplay(set.leftWeightKg, displayUnit) ?? "";
  const rightDisplay = toDisplay(set.rightWeightKg, displayUnit) ?? "";

  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
            Set {index + 1}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const idx = SET_TYPES.indexOf(set.setType);
              const next = SET_TYPES[(idx + 1) % SET_TYPES.length];
              onUpdate({ setType: next });
            }}
            className={`rounded-full px-2 py-1 ${
              set.setType === "warmup"
                ? "bg-orange-100 dark:bg-orange-900"
                : set.setType === "drop"
                ? "bg-purple-100 dark:bg-purple-900"
                : set.setType === "failure"
                ? "bg-red-100 dark:bg-red-900"
                : "bg-gray-100 dark:bg-gray-800"
            }`}
          >
            <View className="flex-row items-center gap-1">
              <Text
                className={`text-xs font-medium capitalize ${
                  set.setType === "warmup"
                    ? "text-orange-700 dark:text-orange-300"
                    : set.setType === "drop"
                    ? "text-purple-700 dark:text-purple-300"
                    : set.setType === "failure"
                    ? "text-red-700 dark:text-red-300"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {set.setType}
              </Text>
              <ChevronDown size={12} color="#6B7280" />
            </View>
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            onPress={() => onOpenPlateCalculator(set)}
            className="rounded-lg p-2"
          >
            <Calculator size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} className="rounded-lg p-2">
            <Trash2 size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {isUnilateral ? (
        <View className="mb-2 flex-row gap-3">
          <SideInputs
            label="Left"
            weight={leftDisplay}
            reps={set.leftReps ?? ""}
            onWeightChange={(v) => handleWeightChange(v, "left")}
            onRepsChange={(v) => handleRepsChange(v, "left")}
            displayUnit={displayUnit}
          />
          <SideInputs
            label="Right"
            weight={rightDisplay}
            reps={set.rightReps ?? ""}
            onWeightChange={(v) => handleWeightChange(v, "right")}
            onRepsChange={(v) => handleRepsChange(v, "right")}
            displayUnit={displayUnit}
          />
        </View>
      ) : (
        <View className="mb-2 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              Weight ({displayUnit})
            </Text>
            <TextInput
              value={String(displayWeight)}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="0"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">Reps</Text>
            <TextInput
              value={String(set.reps ?? "")}
              onChangeText={handleRepsChange}
              keyboardType="number-pad"
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="0"
            />
          </View>
        </View>
      )}

      {isCompleted && (
        <View className="mb-2">
          <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">RPE (1–10)</Text>
          <View className="flex-row gap-1">
            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpe) => (
              <TouchableOpacity
                key={rpe}
                onPress={() => onUpdate({ rpe })}
                className={`flex-1 rounded-lg py-2 ${
                  set.rpe === rpe ? "bg-primary" : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                <Text
                  className={`text-center text-xs font-medium ${
                    set.rpe === rpe ? "text-white" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {rpe}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={toggleComplete}
        className={`flex-row items-center justify-center gap-2 rounded-lg py-2 ${
          isCompleted ? "bg-success" : "bg-primary"
        }`}
      >
        <Check size={18} color="white" />
        <Text className="font-semibold text-white">
          {isCompleted ? "Completed" : "Complete Set"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SideInputs({
  label,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  displayUnit,
}: {
  label: string;
  weight: string | number;
  reps: string | number;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  displayUnit: "kg" | "lb";
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Text>
      <View className="flex-row gap-2">
        <TextInput
          value={String(weight)}
          onChangeText={onWeightChange}
          keyboardType="decimal-pad"
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder={displayUnit}
        />
        <TextInput
          value={String(reps)}
          onChangeText={onRepsChange}
          keyboardType="number-pad"
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="reps"
        />
      </View>
    </View>
  );
}
