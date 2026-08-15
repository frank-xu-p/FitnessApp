import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { getWorkouts } from "../../db/queries";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { Calendar } from "lucide-react-native";
import type { Workout } from "../../db/schema";

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setActiveWorkout } = useWorkoutStore();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const load = useCallback(async () => {
    const userId = user?.id ?? "local";
    const rows = await getWorkouts(userId);
    setWorkouts(rows);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
    router.push(`/workout/${workout.id}`);
  };

  return (
    <View className="flex-1 bg-white p-4 dark:bg-gray-950">
      <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Workouts
      </Text>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openWorkout(item)}
            className="mb-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {item.title}
              </Text>
              <Calendar size={16} color="#9CA3AF" />
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(item.startedAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500 dark:text-gray-400">
              No workouts yet. Start your first one from the Home tab.
            </Text>
          </View>
        }
      />
    </View>
  );
}
