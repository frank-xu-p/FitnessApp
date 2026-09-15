import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Plus, Zap, Info, ChevronRight, Dumbbell } from "lucide-react-native";
import { SetRow } from "./SetRow";
import { RestTimer } from "./RestTimer";
import { PlateCalculatorModal } from "./PlateCalculatorModal";
import {
  getSetsForWorkout,
  createSet,
  updateSet,
  deleteSet,
  getExerciseHistory,
} from "../db/queries";
import { useAuthStore } from "../store/useAuthStore";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { toDisplay, formatWeight } from "../lib/units";
import { effectiveWeightKg, effectiveReps } from "../lib/unilateral";
import {
  suggestNextSetWeight,
  computeProgressionSuggestion,
  defaultRule,
  defaultEquipmentIncrement,
  type ProgressionSuggestion,
} from "../lib/progression";
import type { Set, Exercise } from "../db/schema";

type SetLoggerProps = {
  workoutId: string;
  exercise: Exercise;
  onRemoveExercise?: () => void;
};

export function SetLogger({ workoutId, exercise, onRemoveExercise }: SetLoggerProps) {
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateSet, setPlateSet] = useState<Set | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null);
  const [previousPerf, setPreviousPerf] = useState<string | null>(null);

  const { displayUnit } = useAuthStore();
  const { autoOverloadEnabled, cadenceModel, cadenceRate, cadenceIncrementKg } = useWorkoutStore();

  const load = useCallback(async () => {
    const rows = await getSetsForWorkout(workoutId);
    const exSets = rows.filter((s) => s.exerciseId === exercise.id);
    setSets(exSets);

    // Fetch history for previous performance and overload calculation
    const history = await getExerciseHistory(exercise.id, 1);
    if (history.length > 0 && history[0].sets.length > 0) {
      const prevSets = history[0].sets;
      const topSet = prevSets.reduce(
        (max, s) =>
          (effectiveWeightKg(s) ?? 0) >= (effectiveWeightKg(max) ?? 0) ? s : max,
        prevSets[0]
      );
      const prevDispWeight = toDisplay(effectiveWeightKg(topSet), displayUnit);
      setPreviousPerf(
        `${prevDispWeight ? `${prevDispWeight} ${displayUnit}` : "—"} × ${effectiveReps(topSet) ?? 0}${
          topSet.rpe ? ` @ RPE ${topSet.rpe}` : ""
        }`
      );

      if (autoOverloadEnabled) {
        const sugg = computeProgressionSuggestion({
          lastWeightKg: effectiveWeightKg(topSet) ?? 0,
          lastReps: effectiveReps(topSet) ?? 8,
          lastRpe: topSet.rpe ?? 8,
          targetReps: 8,
          incrementKg: cadenceIncrementKg ?? undefined,
          equipment: exercise.equipment,
          model: cadenceModel,
          cadenceRate,
          lastSessionAt: history[0].date,
          unit: displayUnit,
        });
        setSuggestion(sugg);
      }
    } else {
      setPreviousPerf(null);
      setSuggestion(null);
    }

    setLoading(false);
  }, [
    workoutId,
    exercise.id,
    exercise.equipment,
    autoOverloadEnabled,
    cadenceModel,
    cadenceRate,
    cadenceIncrementKg,
    displayUnit,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddSet = async () => {
    const nextNumber = sets.length + 1;
    const lastSet = sets[sets.length - 1];

    let nextWeightKg = lastSet?.weightKg ?? null;
    let nextReps = lastSet?.reps ?? 10;

    if (autoOverloadEnabled) {
      const suggested = suggestNextSetWeight(
        sets,
        {
          targetReps: 8,
          incrementKg:
            cadenceIncrementKg ?? defaultEquipmentIncrement(exercise.equipment, displayUnit),
          model: cadenceModel,
          cadenceRate,
        },
        displayUnit
      );
      if (suggested !== null) {
        nextWeightKg = suggested;
      } else if (suggestion && sets.length === 0 && suggestion.suggestedWeightKg > 0) {
        nextWeightKg = suggestion.suggestedWeightKg;
        nextReps = suggestion.suggestedReps;
      }
    }

    const defaults = {
      weightKg: nextWeightKg,
      reps: nextReps,
      leftWeightKg: lastSet?.leftWeightKg ?? null,
      leftReps: lastSet?.leftReps ?? null,
      rightWeightKg: lastSet?.rightWeightKg ?? null,
      rightReps: lastSet?.rightReps ?? null,
      setType: "standard" as const,
    };

    await createSet(workoutId, exercise.id, nextNumber, defaults);
    await load();
  };

  const handleUpdate = async (id: string, patch: Partial<Set>) => {
    await updateSet(id, patch);
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)).sort((a, b) => a.setNumber - b.setNumber)
    );
  };

  const handleDelete = async (id: string) => {
    await deleteSet(id);
    await load();
  };

  const handleComplete = () => {
    setRestKey((k) => k + 1);
  };

  if (loading) {
    return (
      <View className="p-6 items-center">
        <Text className="text-sm text-gray-500">Loading sets...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4 pt-2 pb-8" showsVerticalScrollIndicator={false}>
        {/* Exercise Header */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {exercise.name}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {exercise.equipment ?? "Free weights"}
              {Array.isArray(exercise.primaryMuscles) && exercise.primaryMuscles.length > 0
                ? ` · ${exercise.primaryMuscles.join(", ")}`
                : ""}
            </Text>
          </View>
          {onRemoveExercise && (
            <TouchableOpacity onPress={onRemoveExercise} className="rounded-lg p-2">
              <Text className="text-xs text-red-500 font-medium">Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auto Progressive Overload Guidance Banner */}
        {autoOverloadEnabled && suggestion && (
          <View
            className={`mb-3 rounded-2xl p-3 border ${
              suggestion.isOverload
                ? "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
                : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30"
            }`}
          >
            <View className="flex-row items-center gap-1.5 mb-1">
              <Zap size={15} color={suggestion.isOverload ? "#D97706" : "#3B82F6"} />
              <Text
                className={`text-xs font-bold ${
                  suggestion.isOverload
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-blue-900 dark:text-blue-200"
                }`}
              >
                {suggestion.isOverload ? "AUTO OVERLOAD ACTIVE" : "PROGRESSION TARGET"}
              </Text>
            </View>
            <Text
              className={`text-xs ${
                suggestion.isOverload
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-blue-800 dark:text-blue-300"
              }`}
            >
              {suggestion.reason}
            </Text>
          </View>
        )}

        {/* Rest Timer */}
        <RestTimer key={restKey} defaultSeconds={90} />

        {/* Sets List */}
        <View className="mt-3">
          {sets.length === 0 ? (
            <View className="items-center py-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <Dumbbell size={28} color="#9CA3AF" />
              <Text className="mt-2 text-xs text-gray-500">No sets added yet</Text>
            </View>
          ) : (
            sets.map((set, index) => (
              <SetRow
                key={set.id}
                set={set}
                exercise={exercise}
                index={index}
                previousPerformance={previousPerf}
                isAutoOverloaded={autoOverloadEnabled && (suggestion?.isOverload ?? false)}
                onUpdate={(patch) => handleUpdate(set.id, patch)}
                onComplete={handleComplete}
                onDelete={() => handleDelete(set.id)}
                onOpenPlateCalculator={setPlateSet}
              />
            ))
          )}
        </View>

        {/* Add Set Button */}
        <TouchableOpacity
          onPress={handleAddSet}
          className="mt-3 mb-6 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-3.5 dark:border-gray-700 dark:bg-gray-800/80"
        >
          <Plus size={18} color="#4B5563" />
          <Text className="font-semibold text-gray-700 dark:text-gray-300">
            Add Set {sets.length + 1}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Plate Calculator Modal */}
      <PlateCalculatorModal
        visible={plateSet !== null}
        targetWeightKg={plateSet?.weightKg ?? 0}
        onClose={() => setPlateSet(null)}
        onApply={(weightKg, setType) => {
          if (plateSet) {
            handleUpdate(plateSet.id, { weightKg, setType });
          }
          setPlateSet(null);
        }}
      />
    </View>
  );
}
