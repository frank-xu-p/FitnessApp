import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Plus } from "lucide-react-native";
import { SetRow } from "./SetRow";
import { RestTimer } from "./RestTimer";
import { PlateCalculatorModal } from "./PlateCalculatorModal";
import { getSetsForWorkout, createSet, updateSet, deleteSet } from "../db/queries";
import { useAuthStore } from "../store/useAuthStore";
import { suggestNextSetWeight, defaultRule } from "../lib/progression";
import type { Set, Exercise } from "../db/schema";

type SetLoggerProps = {
  workoutId: string;
  exercise: Exercise;
};

export function SetLogger({ workoutId, exercise }: SetLoggerProps) {
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateSet, setPlateSet] = useState<Set | null>(null);
  const [restKey, setRestKey] = useState(0);
  const { defaultBarWeightKg, customPlates, displayUnit } = useAuthStore();

  const load = useCallback(async () => {
    const rows = await getSetsForWorkout(workoutId);
    setSets(rows.filter((s) => s.exerciseId === exercise.id));
    setLoading(false);
  }, [workoutId, exercise.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddSet = async () => {
    const nextNumber = sets.length + 1;
    const lastSet = sets[sets.length - 1];
    const suggested = suggestNextSetWeight(
      sets,
      defaultRule(exercise.equipment),
      displayUnit
    );

    const defaults = lastSet
      ? {
          weightKg: suggested ?? lastSet.weightKg,
          reps: lastSet.reps,
          leftWeightKg: lastSet.leftWeightKg,
          leftReps: lastSet.leftReps,
          rightWeightKg: lastSet.rightWeightKg,
          rightReps: lastSet.rightReps,
          setType: "standard" as const,
        }
      : {};
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
      <View className="p-4">
        <Text className="text-gray-500">Loading sets...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <View className="mb-4">
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {exercise.name}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {exercise.equipment}
            {Array.isArray(exercise.primaryMuscles) ? ` · ${exercise.primaryMuscles.join(", ")}` : ""}
          </Text>
        </View>

        <RestTimer key={restKey} defaultSeconds={120} />

        <View className="mt-4">
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              exercise={exercise}
              index={index}
              onUpdate={(patch) => handleUpdate(set.id, patch)}
              onComplete={handleComplete}
              onDelete={() => handleDelete(set.id)}
              onOpenPlateCalculator={setPlateSet}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={handleAddSet}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-3 dark:border-gray-600 dark:bg-gray-800"
        >
          <Plus size={20} color="#6B7280" />
          <Text className="font-medium text-gray-700 dark:text-gray-300">Add Set</Text>
        </TouchableOpacity>
      </ScrollView>

      <PlateCalculatorModal
        visible={plateSet !== null}
        targetWeightKg={plateSet?.weightKg ?? 0}
        barWeightKg={defaultBarWeightKg}
        availablePlates={customPlates}
        displayUnit={displayUnit}
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
