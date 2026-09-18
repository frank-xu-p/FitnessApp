import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";

import {
  Search,
  Dumbbell,
  SlidersHorizontal,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";
import { getExercises } from "../../db/queries";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { AnatomicalDummy } from "../../components/AnatomicalDummy";
import { ExerciseThumb } from "../../components/ExerciseThumb";
import { useCleanUI, cx } from "../../lib/theme";
import type { Exercise } from "../../db/schema";

const EQUIPMENT_CHIPS = [
  "All",
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Body Only",
  "Kettlebells",
  "Bands",
];

const MUSCLE_CHIPS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Abdominals",
];

export default function ExercisesScreen() {
  const router = useRouter();
  const cleanUI = useCleanUI();
  const { activeWorkout, addExerciseToWorkout } = useWorkoutStore();

  const [query, setQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("All");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [showBodyMap, setShowBodyMap] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const eqFilter =
        selectedEquipment === "All"
          ? undefined
          : [selectedEquipment.toLowerCase()];

      const muscleFilter =
        selectedMuscle && selectedMuscle !== "All"
          ? [selectedMuscle.toLowerCase()]
          : undefined;

      const rows = await getExercises({
        query: query.trim().length > 0 ? query : undefined,
        equipment: eqFilter,
        muscles: muscleFilter,
      });

      setExercises(rows);
    } catch (err) {
      console.error("Failed to load exercises library", err);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedEquipment, selectedMuscle]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectExercise = (exercise: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (activeWorkout) {
      addExerciseToWorkout(exercise.id);
      router.push(`/workout/${activeWorkout.id}`);
    } else {
      router.push(`/exercise/${exercise.id}`);
    }
  };

  const handleResetFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setQuery("");
    setSelectedEquipment("All");
    setSelectedMuscle(null);
  };

  const hasActiveFilters =
    query.length > 0 ||
    selectedEquipment !== "All" ||
    (selectedMuscle !== null && selectedMuscle !== "All");

  return (
    <View className="flex-1 bg-black pt-12">
      {/* Top Header */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text
              className={cx(
                cleanUI,
                "text-[22px] font-semibold text-white tracking-tight",
                "text-2xl font-black text-white tracking-tight"
              )}
            >
              Exercise Library
            </Text>
            <Text
              className={cx(
                cleanUI,
                "text-[13px] text-[#98989F] mt-0.5",
                "text-xs font-mono font-bold text-zinc-400"
              )}
            >
              {exercises.length} Movements Available
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                router.push("/import-video");
              }}
              activeOpacity={0.8}
              className={cx(
                cleanUI,
                "flex-row items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2",
                "flex-row items-center gap-1.5 rounded-xl bg-purple-500/10 px-3 py-2 border border-purple-500/30"
              )}
            >
              <Sparkles size={16} color={cleanUI ? "#98989F" : "#A855F7"} />
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] font-medium text-[#98989F]",
                  "text-xs font-bold text-purple-400"
                )}
              >
                AI Import
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar + Body Map Toggle */}
        <View className="flex-row items-center gap-2 mb-2">
          <View
            className={cx(
              cleanUI,
              "flex-1 flex-row items-center gap-2 rounded-xl bg-[#1C1C1E] px-3.5 py-2.5",
              "flex-1 flex-row items-center gap-2 rounded-2xl bg-zinc-900 px-3.5 py-2.5 border border-zinc-800/80"
            )}
          >
            <Search size={18} color={cleanUI ? "#98989F" : "#71717A"} />
            <TextInput
              testID="exercise-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercise, muscle, equipment..."
              placeholderTextColor="#71717A"
              className={cx(
                cleanUI,
                "flex-1 text-[15px] text-white",
                "flex-1 text-sm font-semibold text-white"
              )}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                activeOpacity={0.8}
              >
                <X size={16} color="#71717A" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            testID="toggle-body-map-btn"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setShowBodyMap((prev) => !prev);
            }}
            activeOpacity={0.8}
            className={cx(
              cleanUI,
              `flex-row items-center gap-1.5 rounded-xl px-3 py-2.5 ${
                showBodyMap || selectedMuscle ? "bg-[#0A84FF]/20" : "bg-[#1C1C1E]"
              }`,
              `flex-row items-center gap-1.5 rounded-2xl px-3 py-2.5 border ${
                showBodyMap || selectedMuscle
                  ? "bg-cyan-500/20 border-cyan-500/60"
                  : "bg-zinc-900 border-zinc-800/80"
              }`
            )}
          >
            <SlidersHorizontal
              size={16}
              color={
                cleanUI
                  ? showBodyMap || selectedMuscle
                    ? "#0A84FF"
                    : "#98989F"
                  : showBodyMap || selectedMuscle
                    ? "#38BDF8"
                    : "#A1A1AA"
              }
            />
            <Text
              className={cx(
                cleanUI,
                `text-[13px] font-medium ${
                  showBodyMap || selectedMuscle ? "text-[#0A84FF]" : "text-[#98989F]"
                }`,
                `text-xs font-black uppercase tracking-wider ${
                  showBodyMap || selectedMuscle ? "text-cyan-400" : "text-zinc-400"
                }`
              )}
            >
              Body Map
            </Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Anatomical Dummy Body Map (Collapsible / Toggleable) */}
        {showBodyMap && (
          <View className="mb-3">
            <AnatomicalDummy
              selectedMuscle={selectedMuscle}
              onSelectMuscle={(m) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setSelectedMuscle(m);
              }}
            />
          </View>
        )}

        {/* Scrollable Filter Chips */}
        <View className="gap-2 mb-1">
          {/* Equipment Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row"
          >
            <View className="flex-row gap-1.5 pr-4">
              {EQUIPMENT_CHIPS.map((eq) => {
                const isActive = selectedEquipment === eq;
                return (
                  <TouchableOpacity
                    key={eq}
                    testID={`chip-equipment-${eq}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                      setSelectedEquipment(eq);
                    }}
                    activeOpacity={0.8}
                    className={cx(
                      cleanUI,
                      `rounded-xl px-3 py-1.5 ${
                        isActive ? "bg-[#0A84FF]/20" : "bg-[#1C1C1E]"
                      }`,
                      `rounded-xl px-3 py-1.5 border ${
                        isActive
                          ? "bg-cyan-500/20 border-cyan-500/60"
                          : "bg-zinc-900 border-zinc-800/80"
                      }`
                    )}
                  >
                    <Text
                      className={cx(
                        cleanUI,
                        `text-[13px] font-medium ${
                          isActive ? "text-[#0A84FF]" : "text-[#98989F]"
                        }`,
                        `text-xs font-bold ${
                          isActive ? "text-cyan-400" : "text-zinc-400"
                        }`
                      )}
                    >
                      {eq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Muscle Chips */}
          {!showBodyMap && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row"
            >
              <View className="flex-row gap-1.5 pr-4">
                {MUSCLE_CHIPS.map((m) => {
                  const isActive =
                    (m === "All" && !selectedMuscle) ||
                    (selectedMuscle &&
                      selectedMuscle.toLowerCase() === m.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={m}
                      testID={`chip-muscle-${m}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                        setSelectedMuscle(m === "All" ? null : m.toLowerCase());
                      }}
                      activeOpacity={0.8}
                      className={cx(
                        cleanUI,
                        `rounded-xl px-3 py-1 ${
                          isActive ? "bg-[#0A84FF]/20" : "bg-[#1C1C1E]"
                        }`,
                        `rounded-xl px-3 py-1 border ${
                          isActive
                            ? "bg-lime-400/20 border-lime-400/60"
                            : "bg-zinc-900/80 border-zinc-800/60"
                        }`
                      )}
                    >
                      <Text
                        className={cx(
                          cleanUI,
                          `text-[13px] font-medium ${
                            isActive ? "text-[#0A84FF]" : "text-[#98989F]"
                          }`,
                          `text-[11px] font-bold ${
                            isActive ? "text-[#CCFF00]" : "text-zinc-400"
                          }`
                        )}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Active Filters Reset Bar */}
        {hasActiveFilters && (
          <View className="mt-2 flex-row items-center justify-between">
            <Text
              className={cx(
                cleanUI,
                "text-[13px] text-[#98989F]",
                "text-[11px] font-bold text-zinc-400"
              )}
            >
              Filtering by:{" "}
              <Text
                className={cx(
                  cleanUI,
                  "text-[#0A84FF] font-medium",
                  "text-cyan-400 font-black"
                )}
              >
                {[
                  query ? `"${query}"` : null,
                  selectedEquipment !== "All" ? selectedEquipment : null,
                  selectedMuscle ? selectedMuscle : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Text>
            <TouchableOpacity
              testID="reset-filters-btn"
              onPress={handleResetFilters}
              activeOpacity={0.8}
            >
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#0A84FF]",
                  "text-[11px] font-bold text-red-400"
                )}
              >
                Reset All
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main List: FlashList with 44x44 Thumbnails for Smooth 60 FPS Scrolling */}
      <View className="flex-1 px-4 pt-1">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={cleanUI ? "#0A84FF" : "#38BDF8"} />
          </View>
        ) : (
          <FlashList
            data={exercises}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => {
              const primary = Array.isArray(item.primaryMuscles)
                ? item.primaryMuscles[0]
                : null;

              return (
                <TouchableOpacity
                  testID={`exercise-item-${item.id}`}
                  onPress={() => handleSelectExercise(item)}
                  activeOpacity={0.8}
                  className={cx(
                    cleanUI,
                    "mb-2 flex-row items-center justify-between rounded-xl bg-[#141414] p-3",
                    "mb-2.5 flex-row items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900 p-3 shadow-sm"
                  )}
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    {/* 44x44 thumbnail: user GIF > demo poster > mannequin */}
                    <View
                      className={cx(
                        cleanUI,
                        "h-11 w-11 rounded-xl bg-black items-center justify-center overflow-hidden",
                        "h-11 w-11 rounded-xl bg-zinc-950 items-center justify-center overflow-hidden border border-zinc-800"
                      )}
                    >
                      <ExerciseThumb exercise={item} size={44} />
                    </View>

                    {/* Title & Metadata */}
                    <View className="flex-1">
                      <Text
                        className={cx(
                          cleanUI,
                          "text-[16px] text-white",
                          "text-sm font-bold text-white"
                        )}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-1.5">
                        {primary && (
                          <Text
                            className={cx(
                              cleanUI,
                              "text-[13px] capitalize text-[#0A84FF]",
                              "text-xs font-semibold capitalize text-cyan-400"
                            )}
                          >
                            {primary}
                          </Text>
                        )}
                        {item.equipment && (
                          <Text
                            className={cx(
                              cleanUI,
                              "text-[13px] text-[#98989F] capitalize",
                              "text-xs text-zinc-400 capitalize"
                            )}
                          >
                            · {item.equipment}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Right Action */}
                  <View className="flex-row items-center gap-1">
                    {activeWorkout ? (
                      <View
                        className={cx(
                          cleanUI,
                          "rounded-xl bg-[#0A84FF]/20 px-2.5 py-1",
                          "rounded-xl bg-cyan-500/20 px-2.5 py-1 border border-cyan-500/40"
                        )}
                      >
                        <Text
                          className={cx(
                            cleanUI,
                            "text-[13px] font-medium text-[#0A84FF]",
                            "text-[11px] font-black text-cyan-400"
                          )}
                        >
                          + ADD
                        </Text>
                      </View>
                    ) : (
                      <ChevronRight size={18} color={cleanUI ? "#636366" : "#71717A"} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Dumbbell size={40} color={cleanUI ? "#636366" : "#71717A"} />
                <Text
                  className={cx(
                    cleanUI,
                    "mt-3 text-[17px] font-semibold text-white",
                    "mt-3 text-base font-bold text-zinc-300"
                  )}
                >
                  No exercises found
                </Text>
                <Text
                  className={cx(
                    cleanUI,
                    "mt-1 text-[13px] text-[#98989F] text-center px-6",
                    "mt-1 text-xs text-zinc-500 text-center px-6"
                  )}
                >
                  Try clearing your search query or selecting a different muscle group.
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity
                    onPress={handleResetFilters}
                    activeOpacity={0.8}
                    className={cx(
                      cleanUI,
                      "mt-4 rounded-xl bg-[#0A84FF] px-4 py-2",
                      "mt-4 rounded-xl bg-cyan-500 px-4 py-2"
                    )}
                  >
                    <Text
                      className={cx(
                        cleanUI,
                        "text-[15px] font-semibold text-white",
                        "text-xs font-black text-black uppercase"
                      )}
                    >
                      Clear Filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
