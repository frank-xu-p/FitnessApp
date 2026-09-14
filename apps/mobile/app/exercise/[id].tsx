import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Dumbbell,
  Target,
  Trophy,
  History as HistoryIcon,
  TrendingUp,
  Info,
  Calendar,
  CheckCircle2,
  Plus,
} from "lucide-react-native";
import {
  getExercise,
  getExerciseHistory,
  getExercisePersonalRecords,
  getExerciseAnalytics,
  type ExercisePersonalRecords,
  type ExerciseSessionProgressPoint,
} from "../../db/queries";
import { useAuthStore } from "../../store/useAuthStore";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { toDisplay } from "../../lib/units";
import { SET_TYPE_CONFIG } from "../../lib/set-types";
import { SegmentedFigurine } from "../../components/SegmentedFigurine";
import type { Exercise } from "../../db/schema";

type TabMode = "about" | "history" | "charts" | "records";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { displayUnit } = useAuthStore();
  const { activeWorkout, addExerciseToWorkout } = useWorkoutStore();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [prs, setPrs] = useState<ExercisePersonalRecords | null>(null);
  const [analytics, setAnalytics] = useState<ExerciseSessionProgressPoint[]>([]);
  const [tab, setTab] = useState<TabMode>("about");
  const [loading, setLoading] = useState(true);

  // Animated demonstration frame toggle
  const [frameIdx, setFrameIdx] = useState(0);
  const animTimer = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [exData, histData, prsData, analyticsData] = await Promise.all([
        getExercise(id),
        getExerciseHistory(id, 20),
        getExercisePersonalRecords(id),
        getExerciseAnalytics(id),
      ]);
      setExercise(exData ?? null);
      setHistory(histData);
      setPrs(prsData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error("Failed to load exercise details", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Two-frame alternating animation loop if image URL is available
  useEffect(() => {
    if (!exercise?.imageUrl) return;
    animTimer.current = setInterval(() => {
      setFrameIdx((prev) => (prev === 0 ? 1 : 0));
    }, 1200);

    return () => {
      if (animTimer.current) clearInterval(animTimer.current);
    };
  }, [exercise?.imageUrl]);

  const getCurrentImageUrl = () => {
    if (!exercise?.imageUrl) return null;
    if (frameIdx === 1) {
      return exercise.imageUrl.replace("/0.jpg", "/1.jpg");
    }
    return exercise.imageUrl;
  };

  const handleAddToActiveWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (exercise && activeWorkout) {
      addExerciseToWorkout(exercise.id);
      router.push(`/workout/${activeWorkout.id}`);
    }
  };

  const handleTabChange = (t: TabMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setTab(t);
  };

  if (loading || !exercise) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const primaryMuscles = Array.isArray(exercise.primaryMuscles)
    ? exercise.primaryMuscles
    : [];
  const secondaryMuscles = Array.isArray(exercise.secondaryMuscles)
    ? exercise.secondaryMuscles
    : [];
  const instructions = Array.isArray(exercise.cues) ? exercise.cues : [];
  const lastSession = history.length > 0 ? history[0] : null;

  const [viewMode, setViewMode] = useState<"vector" | "photo">("vector");

  return (
    <View className="flex-1 bg-black">
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-zinc-950 border-b border-zinc-800/80">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.back();
          }}
          activeOpacity={0.8}
          className="rounded-full bg-zinc-900 p-2 border border-zinc-800"
        >
          <ArrowLeft size={20} color="#E4E4E7" />
        </TouchableOpacity>

        <View className="flex-1 px-3 items-center">
          <Text
            className="text-base font-black text-white text-center"
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text className="text-xs font-bold text-cyan-400 capitalize">
            {exercise.equipment ?? "Free Weight"}
          </Text>
        </View>

        {activeWorkout ? (
          <TouchableOpacity
            onPress={handleAddToActiveWorkout}
            activeOpacity={0.8}
            className="flex-row items-center gap-1 rounded-xl bg-cyan-500 px-3 py-1.5 shadow-sm"
          >
            <Plus size={16} color="black" />
            <Text className="text-xs font-black text-black uppercase">+ ADD</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-9" />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Style 2: 2D Segmented Muscular Figurine Vector Demonstration Hero */}
        <View className="w-full bg-zinc-950 p-4 border-b border-zinc-800/80 relative">
          {viewMode === "vector" ? (
            <SegmentedFigurine exercise={exercise} size={280} autoPlay={true} />
          ) : (
            <View className="h-[280px] w-full rounded-3xl overflow-hidden bg-black items-center justify-center border border-zinc-800">
              {getCurrentImageUrl() ? (
                <Image
                  source={{ uri: getCurrentImageUrl()! }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <View className="items-center justify-center">
                  <Dumbbell size={56} color="#71717A" />
                  <Text className="mt-2 text-xs font-bold text-zinc-500">
                    No photo reference available
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Toggle between Style 2 Vector Demonstration and Photo Reference */}
          <View className="mt-2.5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full bg-[#CCFF00]" />
              <Text className="text-[11px] font-mono font-bold text-zinc-400">
                {viewMode === "vector" ? "2D Segmented Muscular Figurine (Style 2)" : "Original Reference"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setViewMode((prev) => (prev === "vector" ? "photo" : "vector"));
              }}
              activeOpacity={0.8}
              className="rounded-xl bg-zinc-900 px-3 py-1 border border-zinc-700/60"
            >
              <Text className="text-[11px] font-mono font-bold text-cyan-400">
                Switch to {viewMode === "vector" ? "Photo" : "Style 2 Vector"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row border-b border-zinc-800/80 bg-zinc-950 px-2">
          {(
            [
              { id: "about", label: "About", icon: Info },
              { id: "history", label: "History", icon: HistoryIcon },
              { id: "charts", label: "Charts", icon: TrendingUp },
              { id: "records", label: "Records", icon: Trophy },
            ] as const
          ).map((t) => {
            const IconComp = t.icon;
            const isActive = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                testID={`tab-${t.id}`}
                onPress={() => handleTabChange(t.id)}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 border-b-2 ${
                  isActive ? "border-cyan-400 bg-cyan-500/10" : "border-transparent"
                }`}
              >
                <IconComp
                  size={15}
                  color={isActive ? "#38BDF8" : "#71717A"}
                />
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${
                    isActive ? "text-cyan-400" : "text-zinc-400"
                  }`}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: ABOUT */}
        {tab === "about" && (
          <View className="p-4 gap-4" testID="tab-content-about">
            {/* Target Muscles Cards */}
            <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Target size={16} color="#38BDF8" />
                <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                  Target Muscle Anatomy
                </Text>
              </View>

              <View className="gap-2">
                <View>
                  <Text className="text-[11px] font-bold text-zinc-500 uppercase mb-1">
                    Primary Muscles
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {primaryMuscles.length > 0 ? (
                      primaryMuscles.map((m, idx) => (
                        <View
                          key={idx}
                          className="rounded-lg bg-cyan-500/20 px-2.5 py-1 border border-cyan-500/40"
                        >
                          <Text className="text-xs font-bold capitalize text-cyan-300">
                            {m}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-xs text-zinc-500">General Body</Text>
                    )}
                  </View>
                </View>

                {secondaryMuscles.length > 0 && (
                  <View className="mt-1">
                    <Text className="text-[11px] font-bold text-zinc-500 uppercase mb-1">
                      Secondary / Synergists
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {secondaryMuscles.map((m, idx) => (
                        <View
                          key={idx}
                          className="rounded-lg bg-zinc-950 px-2 py-0.5 border border-zinc-800"
                        >
                          <Text className="text-[11px] font-semibold capitalize text-zinc-400">
                            {m}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Smart "Last Performed" Mini-Card */}
            <View
              testID="last-performed-card"
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4"
            >
              <View className="flex-row items-center justify-between mb-2.5">
                <View className="flex-row items-center gap-2">
                  <CheckCircle2 size={16} color="#CCFF00" />
                  <Text className="text-xs font-black text-[#CCFF00] uppercase tracking-wider">
                    Last Performed
                  </Text>
                </View>
                {lastSession && (
                  <Text className="text-xs font-bold text-zinc-400 font-mono">
                    {new Date(lastSession.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                )}
              </View>

              {lastSession && lastSession.sets.length > 0 ? (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between border-b border-zinc-800 pb-1 px-1">
                    <Text className="w-10 text-[10px] font-black uppercase text-zinc-500 font-mono">SET</Text>
                    <Text className="flex-1 text-center text-[10px] font-black uppercase text-zinc-500 font-mono">WEIGHT & REPS</Text>
                    <Text className="w-16 text-right text-[10px] font-black uppercase text-zinc-500 font-mono">INTENSITY</Text>
                  </View>

                  {lastSession.sets.map((s: any, sIdx: number) => {
                    const dispW = toDisplay(s.weightKg, displayUnit);
                    const typeCfg =
                      SET_TYPE_CONFIG[s.setType as keyof typeof SET_TYPE_CONFIG] ||
                      SET_TYPE_CONFIG.standard;

                    return (
                      <View
                        key={sIdx}
                        testID={`last-performed-set-${sIdx}`}
                        className="flex-row items-center justify-between py-1 px-1"
                      >
                        <View className="w-10 flex-row items-center">
                          <View
                            className="h-5 w-5 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${typeCfg.color}25` }}
                          >
                            <Text
                              className="text-[10px] font-black font-mono"
                              style={{ color: typeCfg.color }}
                            >
                              {s.setType === "standard" ? s.setNumber : typeCfg.badge}
                            </Text>
                          </View>
                        </View>

                        <Text className="flex-1 text-center text-xs font-bold text-white font-mono">
                          {dispW != null ? `${dispW} ${displayUnit}` : "BW"} × {s.reps ?? 0}
                        </Text>

                        <View className="w-16 items-end">
                          {s.rpe != null ? (
                            <Text className="text-[11px] font-bold text-cyan-400 font-mono">
                              RPE {s.rpe}
                            </Text>
                          ) : (
                            <Text className="text-[11px] text-zinc-600 font-mono">—</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="py-2">
                  <Text className="text-xs text-zinc-500 italic">
                    No session history logged yet. Complete this movement in a workout to see your weights and reps here!
                  </Text>
                </View>
              )}
            </View>

            {/* Step-by-Step Instructions & Form Cues */}
            <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
              <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-3">
                Execution & Form Instructions
              </Text>

              {instructions.length > 0 ? (
                <View className="gap-3">
                  {instructions.map((step: string, sIdx: number) => (
                    <View key={sIdx} className="flex-row gap-3">
                      <View className="h-6 w-6 rounded-full bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
                        <Text className="text-xs font-black text-cyan-400 font-mono">
                          {sIdx + 1}
                        </Text>
                      </View>
                      <Text className="flex-1 text-xs leading-5 text-zinc-300">
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-xs text-zinc-500 italic">
                  Maintain controlled eccentric and explosive concentric movement with full range of motion.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: HISTORY */}
        {tab === "history" && (
          <View className="p-4 gap-3" testID="tab-content-history">
            {history.length > 0 ? (
              history.map((session, hIdx) => (
                <View
                  key={hIdx}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-bold text-cyan-400">
                      {session.title}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Calendar size={12} color="#71717A" />
                      <Text className="text-xs text-zinc-400 font-mono">
                        {new Date(session.date).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-1">
                    {session.sets.map((s: any, sIdx: number) => {
                      const dispW = toDisplay(s.weightKg, displayUnit);
                      return (
                        <View
                          key={sIdx}
                          className="flex-row items-center justify-between py-1 border-b border-zinc-800/60 px-1"
                        >
                          <Text className="text-xs font-bold text-zinc-400 font-mono">
                            Set {s.setNumber}
                          </Text>
                          <Text className="text-xs font-bold text-white font-mono">
                            {dispW != null ? `${dispW} ${displayUnit}` : "BW"} × {s.reps ?? 0}
                          </Text>
                          <Text className="text-[11px] font-bold text-zinc-400 font-mono">
                            {s.rpe ? `RPE ${s.rpe}` : "—"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-12">
                <HistoryIcon size={36} color="#71717A" />
                <Text className="mt-2 text-sm font-semibold text-zinc-400">
                  No previous sessions logged
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 3: CHARTS */}
        {tab === "charts" && (
          <View className="p-4 gap-4" testID="tab-content-charts">
            <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
              <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-2">
                Estimated 1RM Progression
              </Text>
              {analytics.length > 0 ? (
                <View className="gap-2">
                  {analytics.map((pt, idx) => (
                    <View
                      key={idx}
                      className="flex-row items-center justify-between py-1 border-b border-zinc-800/60"
                    >
                      <Text className="text-xs text-zinc-400 font-mono">
                        {new Date(pt.date).toLocaleDateString()}
                      </Text>
                      <Text className="text-xs font-bold text-white font-mono">
                        {pt.estimated1RMKg
                          ? `${toDisplay(pt.estimated1RMKg, displayUnit)} ${displayUnit}`
                          : "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-xs text-zinc-500 italic py-4 text-center">
                  Log multiple sessions to view your 1RM progression curve.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* TAB 4: RECORDS */}
        {tab === "records" && (
          <View className="p-4 gap-3" testID="tab-content-records">
            <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Trophy size={16} color="#EAB308" />
                <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                  Personal Records
                </Text>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between py-1.5 border-b border-zinc-800/60">
                  <Text className="text-xs text-zinc-400">Max Weight</Text>
                  <Text className="text-sm font-bold text-white font-mono">
                    {prs?.maxWeightKg
                      ? `${toDisplay(prs.maxWeightKg, displayUnit)} ${displayUnit}`
                      : "—"}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between py-1.5 border-b border-zinc-800/60">
                  <Text className="text-xs text-zinc-400">Max Volume</Text>
                  <Text className="text-sm font-bold text-white font-mono">
                    {prs?.maxVolumeKg
                      ? `${toDisplay(prs.maxVolumeKg, displayUnit)} ${displayUnit}`
                      : "—"}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between py-1.5">
                  <Text className="text-xs text-zinc-400">Est. 1RM</Text>
                  <Text className="text-sm font-bold text-[#CCFF00] font-mono">
                    {prs?.maxEstimated1RMKg
                      ? `${toDisplay(prs.maxEstimated1RMKg, displayUnit)} ${displayUnit}`
                      : "—"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
