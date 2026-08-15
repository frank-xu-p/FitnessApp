import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { createWorkout } from "../../db/queries";
import { Play, Dumbbell, Settings } from "lucide-react-native";
import { SyncStatus } from "../../components/SyncStatus";
import { Link } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setActiveWorkout, setActiveExerciseId } = useWorkoutStore();

  const startWorkout = async () => {
    const userId = user?.id ?? "local";
    const workout = await createWorkout(userId, "Quick Workout");
    setActiveWorkout(workout);
    setActiveExerciseId(null);
    router.push(`/workout/${workout.id}`);
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950">
      <View className="p-6 pt-12">
        <View className="mb-8 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              Ready to lift?
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <SyncStatus />
            <Link href="/settings" asChild>
              <TouchableOpacity className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
                <Settings size={20} color="#6B7280" />
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        <TouchableOpacity
          onPress={startWorkout}
          className="mb-6 rounded-2xl bg-primary p-6 shadow-sm"
        >
          <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-white/20 p-3">
              <Play size={28} color="white" />
            </View>
            <View>
              <Text className="text-xl font-bold text-white">Start Workout</Text>
              <Text className="text-sm text-white/80">Track your sets offline</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View className="rounded-2xl bg-gray-100 p-5 dark:bg-gray-900">
          <View className="mb-3 flex-row items-center gap-2">
            <Dumbbell size={20} color="#3B82F6" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Workouts
            </Text>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Your last workouts will appear here once you start training.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
