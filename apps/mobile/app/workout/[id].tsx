import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import { SetLogger } from "../../components/SetLogger";
import { ExercisePicker } from "../../components/ExercisePicker";
import { getWorkoutWithSets, getExercise } from "../../db/queries";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import type { Exercise, Workout } from "../../db/schema";

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeWorkout, setActiveWorkout, activeExerciseId, setActiveExerciseId } = useWorkoutStore();
  const [workout, setWorkout] = useState<Workout | null>(activeWorkout);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [pickingExercise, setPickingExercise] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkout || activeWorkout.id !== id) {
      const loaded = await getWorkoutWithSets(id);
      if (loaded) setActiveWorkout(loaded);
      setWorkout(loaded);
    }
    if (activeExerciseId) {
      const ex = await getExercise(activeExerciseId);
      setExercise(ex ?? null);
    }
  }, [id, activeWorkout, activeExerciseId, setActiveWorkout]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectExercise = (ex: Exercise) => {
    setActiveExerciseId(ex.id);
    setExercise(ex);
    setPickingExercise(false);
  };

  if (pickingExercise) {
    return (
      <ExercisePicker
        onSelect={handleSelectExercise}
        onCreate={() => setPickingExercise(false)}
      />
    );
  }

  if (!workout) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Loading workout...</Text>
      </View>
    );
  }

  if (!exercise) {
    return (
      <View className="flex-1 bg-white p-4 dark:bg-gray-950">
        <View className="mb-4 flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()} className="rounded-full p-2">
            <ChevronLeft size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {workout.title}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-gray-500 dark:text-gray-400">
            Select an exercise to start logging sets.
          </Text>
          <TouchableOpacity
            onPress={() => setPickingExercise(true)}
            className="flex-row items-center gap-2 rounded-xl bg-primary px-5 py-3"
          >
            <Plus size={20} color="white" />
            <Text className="font-semibold text-white">Choose Exercise</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <View className="flex-row items-center border-b border-gray-200 p-4 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-2 rounded-full p-2">
          <ChevronLeft size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {workout.title}
        </Text>
        <TouchableOpacity
          onPress={() => setPickingExercise(true)}
          className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800"
        >
          <Plus size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <SetLogger workoutId={workout.id} exercise={exercise} />
    </View>
  );
}
