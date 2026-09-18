import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Search, Plus, Dumbbell, X, ChevronDown, ChevronRight } from "lucide-react-native";
import { getExercises } from "../db/queries";
import { ExerciseThumb } from "./ExerciseThumb";
import { useCleanUI, cx } from "../lib/theme";
import {
  groupExercises,
  getExerciseDisplayName,
  findMovementGroup,
  getMovementDisplayName,
} from "../lib/exerciseVariants";
import type { Exercise } from "../db/schema";

type ExercisePickerProps = {
  onSelect: (exercise: Exercise) => void;
  /** Called with the typed name and, when the name belongs to a movement
   *  group, that group's key so the caller can create a proper variant. */
  onCreate?: (name: string, groupKey?: string | null) => void;
};

type Row =
  | { kind: "group"; groupKey: string; displayName: string; items: Exercise[] }
  | { kind: "exercise"; exercise: Exercise };

export function ExercisePicker({ onSelect, onCreate }: ExercisePickerProps) {
  const cleanUI = useCleanUI();
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const searching = query.trim().length > 0;

  const rows: Row[] = useMemo(() => {
    if (searching) {
      return exercises.map((e) => ({ kind: "exercise" as const, exercise: e }));
    }
    const out: Row[] = [];
    for (const g of groupExercises(exercises)) {
      if (g.groupKey && g.items.length > 1) {
        out.push({
          kind: "group",
          groupKey: g.groupKey,
          displayName: g.displayName,
          items: g.items,
        });
      } else {
        for (const e of g.items) out.push({ kind: "exercise", exercise: e });
      }
    }
    return out;
  }, [exercises, searching]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const queryGroupKey = searching ? findMovementGroup(query) : null;

  const renderExerciseRow = (item: Exercise, indented = false) => {
    const primary = Array.isArray(item.primaryMuscles) ? item.primaryMuscles[0] : null;
    return (
      <TouchableOpacity
        onPress={() => onSelect(item)}
        activeOpacity={0.8}
        className={cx(
          cleanUI,
          `${indented ? "ml-14 " : ""}mb-2 flex-row items-center justify-between rounded-xl bg-[#141414] p-3`,
          `${indented ? "ml-14 " : ""}mb-2 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 shadow-sm`
        )}
      >
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          <View
            className={cx(
              cleanUI,
              "h-11 w-11 rounded-xl bg-[#1C1C1E] items-center justify-center overflow-hidden",
              "h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800 items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700/60"
            )}
          >
            <ExerciseThumb exercise={item} size={44} />
          </View>
          <View className="flex-1">
            <Text
              className={cx(
                cleanUI,
                "text-[15px] font-medium text-white",
                "text-sm font-bold text-gray-900 dark:text-gray-100"
              )}
              numberOfLines={1}
            >
              {getExerciseDisplayName(item)}
            </Text>
            <Text
              className={cx(
                cleanUI,
                "text-[13px] text-[#98989F] capitalize mt-0.5",
                "text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5"
              )}
            >
              {primary ? `${primary} · ` : ""}
              {item.equipment ?? "Free Weight"}
            </Text>
          </View>
        </View>
        <View
          className={cx(
            cleanUI,
            "rounded-lg bg-[#0A84FF]/15 px-2.5 py-1",
            "rounded-xl bg-sky-500/10 px-2.5 py-1 border border-sky-500/30"
          )}
        >
          <Text
            className={cx(
              cleanUI,
              "text-[13px] font-semibold text-[#0A84FF]",
              "text-xs font-bold text-sky-500 dark:text-sky-400"
            )}
          >
            Select
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 p-4">
      <View
        className={cx(
          cleanUI,
          "mb-3 flex-row items-center gap-2 rounded-xl bg-[#141414] px-3.5 py-2.5",
          "mb-3 flex-row items-center gap-2 rounded-2xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5 border border-gray-200 dark:border-gray-700"
        )}
      >
        <Search size={18} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises..."
          className={cx(
            cleanUI,
            "flex-1 text-[15px] text-white",
            "flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100"
          )}
          placeholderTextColor={cleanUI ? "#636366" : "#9CA3AF"}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.8}>
            <X size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) =>
          item.kind === "group" ? `group_${item.groupKey}` : item.exercise.id
        }
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={11}
        removeClippedSubviews={true}
        renderItem={({ item }) => {
          if (item.kind === "exercise") return renderExerciseRow(item.exercise);
          const isOpen = expanded.has(item.groupKey);
          return (
            <View className="mb-2">
              <TouchableOpacity
                onPress={() => toggleGroup(item.groupKey)}
                activeOpacity={0.8}
                className={cx(
                  cleanUI,
                  "flex-row items-center justify-between rounded-xl bg-[#141414] p-3",
                  "flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 shadow-sm"
                )}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View
                    className={cx(
                      cleanUI,
                      "h-11 w-11 rounded-xl bg-[#1C1C1E] items-center justify-center",
                      "h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800 items-center justify-center"
                    )}
                  >
                    <Dumbbell size={20} color={cleanUI ? "#0A84FF" : "#64748B"} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={cx(
                        cleanUI,
                        "text-[15px] font-medium text-white",
                        "text-sm font-bold text-gray-900 dark:text-gray-100"
                      )}
                      numberOfLines={1}
                    >
                      {item.displayName}
                    </Text>
                    <Text
                      className={cx(
                        cleanUI,
                        "text-[13px] text-[#98989F] mt-0.5",
                        "text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                      )}
                    >
                      {item.items.length} variants
                    </Text>
                  </View>
                </View>
                {isOpen ? (
                  <ChevronDown size={18} color={cleanUI ? "#98989F" : "#64748B"} />
                ) : (
                  <ChevronRight size={18} color={cleanUI ? "#98989F" : "#64748B"} />
                )}
              </TouchableOpacity>
              {isOpen && (
                <View className="mt-2">
                  {item.items.map((ex) => (
                    <View key={ex.id}>{renderExerciseRow(ex, true)}</View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Dumbbell size={36} color={cleanUI ? "#48484A" : "#64748B"} />
            <Text
              className={cx(
                cleanUI,
                "mt-2 text-[15px] text-[#98989F]",
                "mt-2 text-sm font-bold text-gray-700 dark:text-gray-300"
              )}
            >
              No exercises found
            </Text>
            {query.length > 0 && onCreate && (
              <TouchableOpacity
                onPress={() => onCreate(query, queryGroupKey)}
                activeOpacity={0.8}
                className={cx(
                  cleanUI,
                  "mt-4 flex-row items-center gap-2 rounded-xl bg-[#0A84FF] px-4 py-2.5",
                  "mt-4 flex-row items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5"
                )}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text className="text-[13px] font-semibold text-white">
                  {queryGroupKey
                    ? `Create new ${getMovementDisplayName(queryGroupKey)} variant`
                    : `Create "${query}"`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
