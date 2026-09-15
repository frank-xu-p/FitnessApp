import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronDown,
  Timer,
  Plus,
  Zap,
  Sliders,
  Dumbbell,
  Pause,
  Play,
  FastForward,
  CheckCircle2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { WorkoutExerciseCard } from "../../components/WorkoutExerciseCard";
import { ExercisePicker } from "../../components/ExercisePicker";
import { OverloadCadenceModal } from "../../components/OverloadCadenceModal";
import { FinishWorkoutModal } from "../../components/FinishWorkoutModal";
import {
  getWorkoutWithSets,
  getExercise,
  updateWorkout,
  deleteWorkout,
  saveWorkoutAsTemplate,
  updateTemplate,
  updateTemplateValuesOnly,
  getTemplateWithExercises,
  getSetsForWorkout,
  createSet,
  updateSet,
  deleteSet,
  deleteSetsForExerciseInWorkout,
  type TemplateWithExercises,
} from "../../db/queries";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import {
  suggestNextSetWeight,
  defaultEquipmentIncrement,
} from "../../lib/progression";
import {
  effectiveWeightKg,
  effectiveReps,
  hasRequiredDataForCompletion,
} from "../../lib/unilateral";
import type { Exercise, Workout, Set as WorkoutSet } from "../../db/schema";

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    activeWorkout,
    setActiveWorkout,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    autoOverloadEnabled,
    setAutoOverload,
    cadenceModel,
    cadenceRate,
    cadenceIncrementKg,
    setCadenceConfig,
    clearWorkout,
  } = useWorkoutStore();

  const [workout, setWorkout] = useState<Workout | null>(activeWorkout);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [template, setTemplate] = useState<TemplateWithExercises | null>(null);

  const [title, setTitle] = useState(workout?.title ?? "Workout");
  const [pickingExercise, setPickingExercise] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [showOverloadModal, setShowOverloadModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live workout stopwatch
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Floating Rest Timer State
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [restTimerTotal, setRestTimerTotal] = useState(120);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);

  // Rest Timer Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRestTimerRunning) {
      interval = setInterval(() => {
        setRestTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsRestTimerRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            return 0;
          }
          if (prev === 4) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRestTimerRunning]);

  const triggerRestTimer = useCallback((seconds: number) => {
    setRestTimerTotal(seconds);
    setRestTimerSeconds(seconds);
    setIsRestTimerRunning(true);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const loadedWorkout = await getWorkoutWithSets(id);
    if (!loadedWorkout) {
      setLoading(false);
      return;
    }

    setWorkout(loadedWorkout);
    setTitle(loadedWorkout.title);
    setAllSets(loadedWorkout.sets);

    if (loadedWorkout.templateId) {
      const tpl = await getTemplateWithExercises(loadedWorkout.templateId);
      if (tpl) setTemplate(tpl);
    }

    const existingExerciseIds = Array.from(
      new Set(loadedWorkout.sets.map((s) => s.exerciseId))
    );

    const combinedIds = Array.from(
      new Set([
        ...existingExerciseIds,
        ...(activeWorkout?.id === id ? activeWorkout.exerciseIds : []),
      ])
    );

    const loadedExercises: Exercise[] = [];
    for (const exId of combinedIds) {
      const ex = await getExercise(exId);
      if (ex) loadedExercises.push(ex);
    }

    setExercisesList(loadedExercises);
    setActiveWorkout(loadedWorkout, combinedIds);

    const initialElapsed = Math.max(
      0,
      Math.floor((Date.now() - loadedWorkout.startedAt) / 1000)
    );
    setElapsedSeconds(initialElapsed);

    setLoading(false);
  }, [id, activeWorkout, setActiveWorkout]);

  useEffect(() => {
    load();
  }, []);

  // Workout duration stopwatch interval
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const refreshSets = async () => {
    if (!id) return;
    const latestSets = await getSetsForWorkout(id);
    setAllSets(latestSets);
  };

  const handleAddExercise = async (ex: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    // H2: when replacing, consume the pending replacement — remove the old
    // exercise (and soft-delete its sets) instead of adding alongside it.
    const replacingId = replacingExerciseId;
    if (replacingId && replacingId !== ex.id) {
      setExercisesList((prev) => prev.filter((e) => e.id !== replacingId));
      removeExerciseFromWorkout(replacingId);
      if (workout) {
        await deleteSetsForExerciseInWorkout(workout.id, replacingId);
      }
    }
    setReplacingExerciseId(null);

    if (!exercisesList.some((e) => e.id === ex.id)) {
      setExercisesList((prev) => [...prev, ex]);
      addExerciseToWorkout(ex.id);

      if (workout) {
        await createSet(workout.id, ex.id, 1, {
          weightKg: null,
          reps: null,
          setType: "standard",
        });
        await refreshSets();
      }
    }
    setPickingExercise(false);
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const nextList = exercisesList.filter((e) => e.id !== exerciseId);
    setExercisesList(nextList);
    removeExerciseFromWorkout(exerciseId);
    // H1: soft-delete the exercise's sets in SQLite so no orphaned rows remain
    if (workout) {
      await deleteSetsForExerciseInWorkout(workout.id, exerciseId);
      await refreshSets();
    }
  };

  const handleTitleBlur = async () => {
    if (workout && title.trim() && title !== workout.title) {
      await updateWorkout(workout.id, { title: title.trim() });
    }
  };

  const handleFinishWorkout = async (options: {
    notes?: string;
    templateAction: "none" | "save_new" | "update_all" | "update_values_only";
    newTemplateName?: string;
  }) => {
    if (!workout) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    const completedAt = Date.now();
    const currentWorkoutSets = await getSetsForWorkout(workout.id);

    await updateWorkout(workout.id, {
      title: title.trim() || workout.title,
      completedAt,
      notes: options.notes ?? null,
      autoOverloadEnabled,
      cadenceModel,
      cadenceRate,
      cadenceIncrementKg,
    });

    if (options.templateAction === "save_new") {
      const tplName = options.newTemplateName || title.trim() || "My Workout";
      await saveWorkoutAsTemplate(workout.id, tplName, {
        notes: options.notes,
        autoOverloadEnabled,
        cadenceModel,
        cadenceRate,
      });
    } else if (options.templateAction === "update_all" && workout.templateId) {
      const exerciseMap = new Map<string, WorkoutSet[]>();
      for (const s of currentWorkoutSets) {
        if (!exerciseMap.has(s.exerciseId)) exerciseMap.set(s.exerciseId, []);
        exerciseMap.get(s.exerciseId)!.push(s);
      }

      const updatedExercises = Array.from(exerciseMap.entries()).map(
        ([exerciseId, exSets], idx) => {
          const completed = exSets.filter((s) => s.completedAt != null);
          const topSet = (completed.length > 0 ? completed : exSets).reduce(
            (max, s) =>
            ((effectiveWeightKg(s) ?? 0) >= (effectiveWeightKg(max) ?? 0) ? s : max),
            exSets[0]
          );
          return {
            exerciseId,
            orderIndex: idx,
            targetSets: exSets.length,
            targetReps: effectiveReps(topSet) ?? 10,
            targetWeightKg: effectiveWeightKg(topSet) ?? null,
            targetRpe: topSet?.rpe ?? 8,
          };
        }
      );

      await updateTemplate(workout.templateId, {
        autoOverloadEnabled,
        cadenceModel,
        cadenceRate,
        cadenceIncrementKg,
        exercises: updatedExercises,
      });
    } else if (
      options.templateAction === "update_values_only" &&
      workout.templateId
    ) {
      const exerciseMap = new Map<string, WorkoutSet[]>();
      for (const s of currentWorkoutSets) {
        if (!exerciseMap.has(s.exerciseId)) exerciseMap.set(s.exerciseId, []);
        exerciseMap.get(s.exerciseId)!.push(s);
      }

      const valueUpdates = Array.from(exerciseMap.entries()).map(
        ([exerciseId, exSets]) => {
          const completed = exSets.filter((s) => s.completedAt != null);
          const topSet = (completed.length > 0 ? completed : exSets).reduce(
            (max, s) =>
            ((effectiveWeightKg(s) ?? 0) >= (effectiveWeightKg(max) ?? 0) ? s : max),
            exSets[0]
          );
          return {
            exerciseId,
            targetWeightKg: effectiveWeightKg(topSet) ?? null,
            targetReps: effectiveReps(topSet) ?? 10,
            targetRpe: topSet?.rpe ?? 8,
          };
        }
      );

      await updateTemplateValuesOnly(workout.templateId, valueUpdates);
    }

    clearWorkout();
    setShowFinishModal(false);
    router.replace("/(tabs)/workouts");
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text className="mt-3 text-sm font-mono text-zinc-400">Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="mb-4 text-base text-zinc-300 font-bold">Workout not found.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/workouts")}
          className="rounded-xl bg-cyan-500 px-5 py-3"
        >
          <Text className="font-bold text-black uppercase">Back to Workouts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isStructureModified = Boolean(
    template &&
      (template.exercises.length !== exercisesList.length ||
        template.exercises.some((te, i) => te.exerciseId !== exercisesList[i]?.id))
  );

  const handleInitiateFinish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (!workout) return;
    const latestSets = await getSetsForWorkout(workout.id);
    setAllSets(latestSets);

    const completedSets = latestSets.filter((s) => s.completedAt != null);
    const uncompletedSets = latestSets.filter((s) => s.completedAt == null);

    if (completedSets.length === 0) {
      Alert.alert(
        "No Sets Completed",
        "You haven't completed any sets in this workout session. Would you like to discard/cancel this workout or continue?",
        [
          {
            text: "Continue Workout",
            style: "cancel",
          },
          {
            text: "Cancel Workout",
            style: "destructive",
            onPress: async () => {
              await deleteWorkout(workout.id);
              clearWorkout();
              router.replace("/(tabs)/workouts");
            },
          },
        ]
      );
      return;
    }

    if (uncompletedSets.length > 0) {
      Alert.alert(
        "Unfinished Sets",
        `You have ${uncompletedSets.length} unfinished set${
          uncompletedSets.length > 1 ? "s" : ""
        }. Sets with complete data will be marked completed; incomplete ones will be discarded.`,
        [
          {
            text: "Keep Editing",
            style: "cancel",
          },
          {
            text: "Discard Unfinished",
            style: "destructive",
            onPress: async () => {
              for (const s of uncompletedSets) {
                await deleteSet(s.id);
              }
              const updated = await getSetsForWorkout(workout.id);
              setAllSets(updated);
              setShowFinishModal(true);
            },
          },
          {
            // H3: never fabricate weight/reps. Only sets that already have
            // the required data (per the exercise's tracking mode) may be
            // completed; the rest are discarded.
            text: "Complete Valid Only",
            onPress: async () => {
              const now = Date.now();
              const modeByExercise = new Map<string, "unilateral" | "bilateral">();
              for (const ex of exercisesList) {
                modeByExercise.set(
                  ex.id,
                  ex.trackingMode === "unilateral" ? "unilateral" : "bilateral"
                );
              }
              for (const s of uncompletedSets) {
                const mode = modeByExercise.get(s.exerciseId) ?? "bilateral";
                if (hasRequiredDataForCompletion(s, mode)) {
                  await updateSet(s.id, { completedAt: now });
                } else {
                  await deleteSet(s.id);
                }
              }
              const updated = await getSetsForWorkout(workout.id);
              setAllSets(updated);
              setShowFinishModal(true);
            },
          },
        ]
      );
      return;
    }

    setShowFinishModal(true);
  };

  return (
    <View className="flex-1 bg-black">
      {/* Top Navigation Bar with notch clearance */}
      <View className="border-b border-zinc-800/80 bg-zinc-950 px-4 pt-16 pb-4">
        <View className="flex-row items-center justify-between">
          {/* Collapse / Back Chevron */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.back();
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800"
          >
            <ChevronDown size={24} color="#A1A1AA" />
          </TouchableOpacity>

          {/* Center: Live Stopwatch Timer */}
          <View className="min-h-[44px] flex-row items-center gap-2 rounded-2xl bg-zinc-900 px-4 border border-zinc-800">
            <Timer size={18} color="#38BDF8" />
            <Text className="text-base font-mono font-black text-white">
              {formatTimer(elapsedSeconds)}
            </Text>
          </View>

          {/* Right: High-contrast FINISH Button with Neon Lime accent */}
          <TouchableOpacity
            onPress={handleInitiateFinish}
            activeOpacity={0.8}
            hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
            className="min-h-[44px] px-4 items-center justify-center rounded-2xl bg-[#CCFF00] shadow-md shadow-[#CCFF00]/20"
          >
            <Text className="text-sm font-black uppercase text-black tracking-wider">
              FINISH
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title Bar & Auto-Overload Pill */}
        <View className="mt-3 flex-row items-center justify-between">
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={handleTitleBlur}
            className="flex-1 text-base font-bold text-white"
            placeholder="Workout Title"
            placeholderTextColor="#52525B"
          />

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setShowOverloadModal(true);
            }}
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-1 border ${
              autoOverloadEnabled
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <Zap
              size={12}
              color={autoOverloadEnabled ? "#F59E0B" : "#71717A"}
            />
            <Text
              className={`text-[11px] font-mono font-bold ${
                autoOverloadEnabled ? "text-amber-400" : "text-zinc-400"
              }`}
            >
              Overload: {autoOverloadEnabled ? "ON" : "OFF"}
            </Text>
            <Sliders
              size={10}
              color={autoOverloadEnabled ? "#F59E0B" : "#71717A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content: Vertical Feed of All Exercises */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isRestTimerRunning ? 120 : 60 }}
      >
        {exercisesList.length === 0 ? (
          <View className="items-center justify-center p-8 mt-12 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/60">
            <Dumbbell size={44} color="#71717A" />
            <Text className="mt-4 text-base font-bold text-white">
              No exercises added yet
            </Text>
            <Text className="mt-1 text-center text-xs text-zinc-500">
              Tap the button below to add exercises to this workout.
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setPickingExercise(true);
              }}
              activeOpacity={0.8}
              className="mt-6 flex-row items-center gap-2 rounded-2xl bg-[#CCFF00] px-6 py-3.5 shadow-lg shadow-[#CCFF00]/10"
            >
              <Plus size={18} color="#000000" />
              <Text className="font-black text-black uppercase tracking-wider">
                Add First Exercise
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          exercisesList.map((exercise) => {
            const exerciseSets = allSets
              .filter((s) => s.exerciseId === exercise.id)
              .sort((a, b) => a.setNumber - b.setNumber);

            return (
              <WorkoutExerciseCard
                key={exercise.id}
                workoutId={workout.id}
                exercise={exercise}
                sets={exerciseSets}
                onSetsChange={refreshSets}
                onRemoveExercise={() => handleRemoveExercise(exercise.id)}
                onReplaceExercise={() => {
                  setReplacingExerciseId(exercise.id);
                  setPickingExercise(true);
                }}
                onTriggerRestTimer={triggerRestTimer}
              />
            );
          })
        )}

        {/* Bottom Actions */}
        {exercisesList.length > 0 && (
          <View className="mb-12 gap-3">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setPickingExercise(true);
              }}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 py-3.5"
            >
              <Plus size={20} color="#38BDF8" />
              <Text className="text-sm font-black text-cyan-400 uppercase tracking-wider">
                Add Exercise
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleInitiateFinish}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] py-4 shadow-lg shadow-[#CCFF00]/10"
            >
              <CheckCircle2 size={20} color="#000000" strokeWidth={2.5} />
              <Text className="text-base font-black text-black uppercase tracking-wider">
                Finish Workout
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Active Rest Timer Dock */}
      {isRestTimerRunning && (
        <View className="absolute bottom-6 left-4 right-4 rounded-3xl border border-zinc-800 bg-zinc-900/95 p-4 shadow-2xl">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-500/40">
                <Timer size={22} color="#38BDF8" />
              </View>
              <View>
                <Text className="text-[10px] font-black font-mono text-zinc-400 uppercase tracking-wider">
                  Rest Timer
                </Text>
                <Text className="text-xl font-mono font-black text-white">
                  {formatTimer(restTimerSeconds)}
                </Text>
              </View>
            </View>

            {/* Timer Controls */}
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setRestTimerSeconds((prev) => prev + 30);
                }}
                className="rounded-xl bg-zinc-800 px-2.5 py-2 border border-zinc-700/60"
              >
                <Text className="text-xs font-mono font-bold text-cyan-400">+30s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setIsRestTimerRunning(!isRestTimerRunning);
                }}
                className="rounded-xl bg-cyan-500 p-2.5"
              >
                {isRestTimerRunning ? (
                  <Pause size={18} color="#000000" />
                ) : (
                  <Play size={18} color="#000000" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setIsRestTimerRunning(false);
                  setRestTimerSeconds(0);
                }}
                className="rounded-xl bg-zinc-800 p-2.5 border border-zinc-700/60"
              >
                <FastForward size={18} color="#A1A1AA" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Exercise Picker Modal */}
      <Modal
        visible={pickingExercise}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPickingExercise(false);
          setReplacingExerciseId(null);
        }}
      >
        <ExercisePicker
          onSelect={handleAddExercise}
        />
      </Modal>

      {/* Progressive Overload Cadence Configuration Modal */}
      <OverloadCadenceModal
        visible={showOverloadModal}
        autoOverloadEnabled={autoOverloadEnabled}
        cadenceModel={cadenceModel}
        cadenceRate={cadenceRate}
        cadenceIncrementKg={cadenceIncrementKg}
        onSave={(cfg) => {
          setAutoOverload(cfg.autoOverloadEnabled);
          setCadenceConfig({
            model: cfg.cadenceModel,
            rate: cfg.cadenceRate,
            incrementKg: cfg.cadenceIncrementKg,
          });
          setShowOverloadModal(false);
        }}
        onClose={() => setShowOverloadModal(false)}
      />

      {/* Finish Workout Resolution Modal */}
      <FinishWorkoutModal
        visible={showFinishModal}
        workout={workout}
        sets={allSets}
        durationSeconds={elapsedSeconds}
        template={template}
        templateName={template?.name}
        isStructureModified={isStructureModified}
        onFinish={handleFinishWorkout}
        onClose={() => setShowFinishModal(false)}
      />
    </View>
  );
}
