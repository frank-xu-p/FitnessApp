import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Image } from "expo-image";
import { Search, Plus, Dumbbell, X } from "lucide-react-native";
import { getExercises } from "../db/queries";
import { SegmentedFigurine } from "./SegmentedFigurine";
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
      <View className="mb-3 flex-row items-center gap-2 rounded-2xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5 border border-gray-200 dark:border-gray-700">
        <Search size={18} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search 800+ exercises..."
          className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100"
          placeholderTextColor="#9CA3AF"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.8}>
            <X size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={11}
        removeClippedSubviews={true}

        renderItem={({ item }) => {
          const primary = Array.isArray(item.primaryMuscles)
            ? item.primaryMuscles[0]
            : null;

          return (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              activeOpacity={0.8}
              className="mb-2 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 shadow-sm"
            >
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                {/* 44x44 Vector Figurine Thumbnail */}
                <View className="h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800 items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700/60">
                  {item.imageUrl?.endsWith(".gif") ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 44, height: 44 }}
                      contentFit="cover"
                    />
                  ) : (
                    <SegmentedFigurine
                      exercise={item}
                      size={44}
                      interactive={false}
                      animated={false}
                    />
                  )}
                </View>

                <View className="flex-1">
                  <Text
                    className="text-sm font-bold text-gray-900 dark:text-gray-100"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
                    {primary ? `${primary} · ` : ""}
                    {item.equipment ?? "Free Weight"}
                  </Text>
                </View>
              </View>

              <View className="rounded-xl bg-sky-500/10 px-2.5 py-1 border border-sky-500/30">
                <Text className="text-xs font-bold text-sky-500 dark:text-sky-400">
                  Select
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Dumbbell size={36} color="#64748B" />
            <Text className="mt-2 text-sm font-bold text-gray-700 dark:text-gray-300">
              No exercises found
            </Text>
            {query.length > 0 && onCreate && (
              <TouchableOpacity
                onPress={() => onCreate(query)}
                activeOpacity={0.8}
                className="mt-4 flex-row items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5"
              >
                <Plus size={16} color="#FFFFFF" />
                <Text className="text-xs font-black text-white uppercase">
                  Create "{query}"
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
