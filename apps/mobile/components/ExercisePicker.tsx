import { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity } from "react-native";
import { Search, Plus } from "lucide-react-native";
import { getExercises } from "../db/queries";
import type { Exercise } from "../db/schema";

type ExercisePickerProps = {
  onSelect: (exercise: Exercise) => void;
  onCreate?: (name: string) => void;
};

export function ExercisePicker({ onSelect, onCreate }: ExercisePickerProps) {
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await getExercises(query);
      setExercises(rows);
    } catch (err) {
      console.error("Failed to load exercises", err);
      setExercises([]);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 p-4">
      <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
        <Search size={20} color="#6B7280" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises..."
          className="flex-1 text-base text-gray-900 dark:text-gray-100"
          placeholderTextColor="#9CA3AF"
        />
      </View>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            className="mb-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {item.name}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {item.equipment}
              {Array.isArray(item.primaryMuscles) ? ` · ${item.primaryMuscles.join(", ")}` : ""}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-gray-500">No exercises found</Text>
            {query.length > 0 && onCreate && (
              <TouchableOpacity
                onPress={() => onCreate(query)}
                className="mt-4 flex-row items-center gap-2 rounded-lg bg-primary px-4 py-2"
              >
                <Plus size={16} color="#FFFFFF" />
                <Text className="font-medium text-white">Create "{query}"</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
