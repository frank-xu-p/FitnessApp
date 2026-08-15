import { useRouter } from "expo-router";
import { View, TouchableOpacity, Text } from "react-native";
import { ExercisePicker } from "../../components/ExercisePicker";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { Camera } from "lucide-react-native";
import type { Exercise } from "../../db/schema";

export default function ExercisesScreen() {
  const router = useRouter();
  const { activeWorkout, addExerciseToWorkout } = useWorkoutStore();

  const handleSelect = (exercise: Exercise) => {
    if (activeWorkout) {
      addExerciseToWorkout(exercise.id);
      router.push(`/workout/${activeWorkout.id}`);
    }
  };

  return (
    <View className="flex-1">
      <TouchableOpacity
        onPress={() => router.push("/import-video")}
        className="mx-4 mb-2 mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-purple-100 py-3 dark:bg-purple-900/30"
      >
        <Camera size={20} color="#9333EA" />
        <Text className="font-medium text-purple-700 dark:text-purple-300">
          Import exercise with AI
        </Text>
      </TouchableOpacity>
      <ExercisePicker
        onSelect={handleSelect}
        onCreate={(name) => {
          console.log("Create exercise", name);
        }}
      />
    </View>
  );
}
