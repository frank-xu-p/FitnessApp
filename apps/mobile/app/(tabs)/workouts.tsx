import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Play,
  Plus,
  Bookmark,
  History,
  Calendar,
  Zap,
  Edit2,
  Trash2,
  Copy,
  Clock,
  Dumbbell,
  ChevronRight,
  Sparkles,
  FileText,
  RotateCcw,
  Download,
} from "lucide-react-native";

import { useAuthStore } from "../../store/useAuthStore";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import {
  getWorkoutsWithDetails,
  deleteWorkout,
  getTemplates,
  createWorkout,
  createWorkoutFromTemplate,
  createSet,
  deleteTemplate,
  duplicateTemplate,
  createTemplate,
  updateTemplate,
  type TemplateWithExercises,
  type WorkoutHistoryItem,
} from "../../db/queries";

import { TemplateEditorModal } from "../../components/TemplateEditorModal";
import { WorkoutDetailModal } from "../../components/WorkoutDetailModal";
import { StrongImportModal } from "../../components/StrongImportModal";
import { toDisplay } from "../../lib/units";

type TabMode = "templates" | "history";

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user, displayUnit } = useAuthStore();
  const {
    activeWorkout,
    setActiveWorkout,
    startEmptyWorkout,
    startWorkoutFromTemplate,
    setActiveExerciseId,
  } = useWorkoutStore();

  const [tab, setTab] = useState<TabMode>("templates");
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const [editingTemplate, setEditingTemplate] = useState<TemplateWithExercises | null>(null);
  const [selectedHistoryWorkout, setSelectedHistoryWorkout] = useState<WorkoutHistoryItem | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showStrongModal, setShowStrongModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const userId = user?.id ?? "local";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRows, workoutRows] = await Promise.all([
        getTemplates(userId),
        getWorkoutsWithDetails(userId),
      ]);
      setTemplates(tplRows);
      setWorkouts(workoutRows);
    } catch (err) {
      console.error("Failed to load workouts data", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Start an empty workout
  const handleStartEmptyWorkout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const newWorkout = await createWorkout(userId, "Empty Workout", {
        autoOverloadEnabled: true,
        cadenceModel: "double_progression",
        cadenceRate: "session",
        cadenceIncrementKg: 2.5,
      });
      startEmptyWorkout(newWorkout);
      router.push(`/workout/${newWorkout.id}`);
    } catch (err) {
      Alert.alert("Error", "Could not start workout");
    }
  };

  // Start a workout from a template
  const handleStartFromTemplate = async (templateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setStartingTemplateId(templateId);
    try {
      const { workout: newWorkout, exercises } = await createWorkoutFromTemplate(
        userId,
        templateId,
        true
      );
      const exIds = exercises.map((e) => e.id);
      startWorkoutFromTemplate(newWorkout, exIds);
      if (exIds.length > 0) {
        setActiveExerciseId(exIds[0]);
      }
      router.push(`/workout/${newWorkout.id}`);
    } catch (err) {
      Alert.alert("Error", "Could not start template workout");
    } finally {
      setStartingTemplateId(null);
    }
  };

  const handleRepeatWorkout = async (historyItem: WorkoutHistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const newWorkout = await createWorkout(
        userId,
        historyItem.title || "Workout",
        {
          autoOverloadEnabled: historyItem.autoOverloadEnabled,
          cadenceModel: historyItem.cadenceModel,
          cadenceRate: historyItem.cadenceRate,
          cadenceIncrementKg: historyItem.cadenceIncrementKg,
        }
      );

      const exIds: string[] = [];
      const seen = new Set<string>();
      for (const s of historyItem.sets) {
        if (!seen.has(s.exerciseId)) {
          seen.add(s.exerciseId);
          exIds.push(s.exerciseId);
        }
      }

      startWorkoutFromTemplate(newWorkout, exIds);
      if (exIds.length > 0) {
        setActiveExerciseId(exIds[0]);
      }

      for (const s of historyItem.sets) {
        await createSet(newWorkout.id, s.exerciseId, s.setNumber, {
          setType: s.setType,
          weightKg: s.weightKg,
          reps: s.reps,
          leftWeightKg: s.leftWeightKg,
          leftReps: s.leftReps,
          rightWeightKg: s.rightWeightKg,
          rightReps: s.rightReps,
          restSeconds: s.restSeconds,
        });
      }

      router.push(`/workout/${newWorkout.id}`);
    } catch (err) {
      Alert.alert("Error", "Could not repeat workout");
    }
  };

  const handleDeleteWorkoutHistory = async (workoutId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await deleteWorkout(workoutId);
      await loadData();
    } catch (err) {
      Alert.alert("Error", "Could not delete workout");
    }
  };

  const handleDeleteTemplate = (template: TemplateWithExercises) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (template.isPreset) {
      Alert.alert("Preset Template", "Built-in preset templates cannot be deleted.");
      return;
    }
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTemplate(template.id);
            await loadData();
          },
        },
      ]
    );
  };

  const handleDuplicateTemplate = async (template: TemplateWithExercises) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await duplicateTemplate(template.id, userId, `${template.name} (Custom)`);
      await loadData();
      Alert.alert("Template Duplicated", `Created custom copy of "${template.name}".`);
    } catch (err) {
      Alert.alert("Error", "Could not duplicate template");
    }
  };

  const handleSaveTemplate = async (data: any) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, data);
    } else {
      await createTemplate(userId, data);
    }
    await loadData();
  };

  const categories = [
    "All",
    ...Array.from(new Set(templates.map((t) => t.category || "Custom"))),
  ];

  const filteredTemplates =
    selectedCategory === "All"
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  return (
    <View className="flex-1 bg-black pt-12">
      {/* Top Header */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-white">
              Workouts
            </Text>
            <Text className="text-xs font-mono font-bold text-zinc-400">
              Templates & Logged Sessions
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {/* Strong App Importer CTA */}
            <TouchableOpacity
              testID="open-strong-importer-btn"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setShowStrongModal(true);
              }}
              activeOpacity={0.8}
              className="flex-row items-center gap-1 rounded-xl bg-cyan-500/20 px-3 py-2 border border-cyan-500/40"
            >
              <FileText size={15} color="#38BDF8" />
              <Text className="text-xs font-bold text-cyan-400">Strong Import</Text>
            </TouchableOpacity>

            {/* New Template CTA */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
              activeOpacity={0.8}
              className="flex-row items-center gap-1 rounded-xl bg-zinc-900 px-3 py-2 border border-zinc-800"
            >
              <Plus size={16} color="#E4E4E7" />
              <Text className="text-xs font-bold text-white">New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Workout in progress banner */}
        {activeWorkout && !activeWorkout.completedAt && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push(`/workout/${activeWorkout.id}`);
            }}
            activeOpacity={0.8}
            className="mt-3 flex-row items-center justify-between rounded-2xl bg-amber-500 p-4 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-3 w-3 rounded-full bg-white opacity-80" />
              <View>
                <Text className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                  Workout In Progress
                </Text>
                <Text className="text-base font-bold text-black">
                  {activeWorkout.title}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1 rounded-xl bg-black/20 px-3 py-1.5">
              <Text className="text-xs font-black text-black uppercase">Resume</Text>
              <ChevronRight size={14} color="#000000" />
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Action Hero 1: Start Empty Workout (Neon Lime OLED Button) */}
        <TouchableOpacity
          onPress={handleStartEmptyWorkout}
          activeOpacity={0.8}
          className="mt-3 flex-row items-center justify-between rounded-2xl bg-[#CCFF00] p-4 shadow-lg shadow-[#CCFF00]/10"
        >
          <View className="flex-row items-center gap-3">
            <View className="rounded-xl bg-black p-2.5">
              <Plus size={22} color="#CCFF00" />
            </View>
            <View>
              <Text className="text-base font-black text-black tracking-tight">
                Start Empty Workout
              </Text>
              <Text className="text-xs font-bold text-black/70">
                Log freeform sets or build a custom routine on the fly
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color="#000000" />
        </TouchableOpacity>

        {/* Quick Action Hero 2: Import Strong Workout / Routine */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setShowStrongModal(true);
          }}
          activeOpacity={0.8}
          className="mt-2.5 flex-row items-center justify-between rounded-2xl border border-cyan-500/40 bg-zinc-900 p-3.5 shadow-md"
        >
          <View className="flex-row items-center gap-3">
            <View className="rounded-xl bg-cyan-500/20 p-2.5 border border-cyan-500/40">
              <Download size={20} color="#38BDF8" />
            </View>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-black text-white tracking-tight">
                  Import Workout or Routine
                </Text>
                <View className="rounded-md bg-cyan-500/20 px-1.5 py-0.2">
                  <Text className="text-[9px] font-mono font-bold text-cyan-400">
                    STRONG / CSV
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] font-mono text-zinc-400">
                Paste Strong clipboard share or CSV export
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#38BDF8" />
        </TouchableOpacity>

        {/* Segmented Tab Switcher */}
        <View className="mt-4 flex-row rounded-2xl bg-zinc-900 p-1 border border-zinc-800/80">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setTab("templates");
            }}
            activeOpacity={0.8}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              tab === "templates"
                ? "bg-zinc-800 border border-zinc-700/60"
                : "bg-transparent"
            }`}
          >
            <Bookmark
              size={16}
              color={tab === "templates" ? "#38BDF8" : "#71717A"}
            />
            <Text
              className={`text-xs font-bold ${
                tab === "templates"
                  ? "text-cyan-400 font-black"
                  : "text-zinc-400"
              }`}
            >
              Templates ({templates.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setTab("history");
            }}
            activeOpacity={0.8}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              tab === "history"
                ? "bg-zinc-800 border border-zinc-700/60"
                : "bg-transparent"
            }`}
          >
            <History
              size={16}
              color={tab === "history" ? "#38BDF8" : "#71717A"}
            />
            <Text
              className={`text-xs font-bold ${
                tab === "history"
                  ? "text-cyan-400 font-black"
                  : "text-zinc-400"
              }`}
            >
              History ({workouts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      ) : tab === "templates" ? (
        <View className="flex-1 px-4">
          {/* Category Filter Pills */}
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="py-1 mb-2 max-h-12"
            >
              <View className="flex-row gap-2">
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                      setSelectedCategory(cat);
                    }}
                    activeOpacity={0.8}
                    className={`rounded-full px-3.5 py-1.5 border ${
                      selectedCategory === cat
                        ? "border-cyan-500 bg-cyan-500/20"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        selectedCategory === cat
                          ? "text-cyan-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <FlatList
            data={filteredTemplates}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4 shadow-sm">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-bold text-white">
                        {item.name}
                      </Text>
                      {item.isPreset && (
                        <View className="rounded-full bg-cyan-500/20 px-2 py-0.5 border border-cyan-500/40">
                          <Text className="text-[10px] font-mono font-bold text-cyan-300">
                            PRESET
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-zinc-400 mt-0.5">
                      {item.category} · {item.exercises.length} exercises
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={() => handleDuplicateTemplate(item)}
                      className="rounded-lg p-2"
                      accessibilityLabel="Duplicate Template"
                    >
                      <Copy size={16} color="#38BDF8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                        setEditingTemplate(item);
                        setShowTemplateModal(true);
                      }}
                      className="rounded-lg p-2"
                      accessibilityLabel="Edit Template"
                    >
                      <Edit2 size={16} color="#71717A" />
                    </TouchableOpacity>
                    {!item.isPreset && (
                      <TouchableOpacity
                        onPress={() => handleDeleteTemplate(item)}
                        className="rounded-lg p-2"
                        accessibilityLabel="Delete Template"
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Auto Overload Badge */}
                {item.autoOverloadEnabled && (
                  <View className="mt-2 flex-row items-center gap-1 self-start rounded-md bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
                    <Zap size={11} color="#F59E0B" />
                    <Text className="text-[11px] font-bold text-amber-400">
                      Auto Overload ({item.cadenceModel.replace("_", " ")})
                    </Text>
                  </View>
                )}

                {/* Exercise Preview List */}
                <View className="mt-3 border-t border-zinc-800 pt-2.5">
                  {item.exercises.slice(0, 3).map((te) => {
                    const dispWeight = toDisplay(te.targetWeightKg, displayUnit);
                    return (
                      <Text
                        key={te.id}
                        className="text-xs text-zinc-400 mb-1 font-mono"
                        numberOfLines={1}
                      >
                        • {te.exercise?.name ?? "Exercise"} (
                        {te.targetSets} sets × {te.targetReps ?? 10} reps
                        {dispWeight ? ` @ ${dispWeight} ${displayUnit}` : ""})
                      </Text>
                    );
                  })}
                  {item.exercises.length > 3 && (
                    <Text className="text-[11px] font-medium text-zinc-500 italic">
                      + {item.exercises.length - 3} more exercises
                    </Text>
                  )}
                </View>

                {/* Start Template Action */}
                <TouchableOpacity
                  onPress={() => handleStartFromTemplate(item.id)}
                  disabled={startingTemplateId === item.id}
                  activeOpacity={0.8}
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 shadow-sm"
                >
                  {startingTemplateId === item.id ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Play size={16} color="#000000" fill="#000000" />
                      <Text className="text-xs font-black text-black uppercase tracking-wider">
                        Start Workout
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Dumbbell size={40} color="#71717A" />
                <Text className="mt-3 text-base font-bold text-zinc-300">
                  No routines found
                </Text>
                <Text className="mt-1 text-xs text-zinc-500">
                  Tap "+ Strong Import" or "+ New" to add your training routines.
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        <View className="flex-1 px-4">
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => {
              const completedDate = item.completedAt ? new Date(item.completedAt) : null;
              const durationMinutes =
                item.startedAt && item.completedAt
                  ? Math.round((item.completedAt - item.startedAt) / 60000)
                  : null;

              const exerciseCount = new Set(item.sets.map((s) => s.exerciseId)).size;

              return (
                <View className="mb-3 rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4 shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-white">
                        {item.title}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-3">
                        <View className="flex-row items-center gap-1">
                          <Calendar size={12} color="#71717A" />
                          <Text className="text-xs text-zinc-400 font-mono">
                            {completedDate
                              ? completedDate.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "In progress"}
                          </Text>
                        </View>
                        {durationMinutes && (
                          <View className="flex-row items-center gap-1">
                            <Clock size={12} color="#71717A" />
                            <Text className="text-xs text-zinc-400 font-mono">
                              {durationMinutes} min
                            </Text>
                          </View>
                        )}
                        <Text className="text-xs text-zinc-400 font-mono">
                          {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"} · {item.sets.length} sets
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1">
                      <TouchableOpacity
                        onPress={() => setSelectedHistoryWorkout(item)}
                        className="rounded-lg p-2"
                        accessibilityLabel="View Workout Details"
                      >
                        <ChevronRight size={18} color="#71717A" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Actions: Repeat Workout */}
                  <View className="mt-3 flex-row items-center gap-2 border-t border-zinc-800 pt-2.5">
                    <TouchableOpacity
                      onPress={() => handleRepeatWorkout(item)}
                      activeOpacity={0.8}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-zinc-800 py-2.5 border border-zinc-700/60"
                    >
                      <RotateCcw size={14} color="#38BDF8" />
                      <Text className="text-xs font-bold text-cyan-400">
                        Repeat Workout
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteWorkoutHistory(item.id)}
                      className="rounded-xl bg-red-500/10 p-2.5 border border-red-500/20"
                      accessibilityLabel="Delete Workout"
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <History size={40} color="#71717A" />
                <Text className="mt-3 text-base font-bold text-zinc-300">
                  No workout history yet
                </Text>
                <Text className="mt-1 text-xs text-zinc-500">
                  Start an empty workout or import your Strong history!
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Template Editor Modal */}
      <TemplateEditorModal
        visible={showTemplateModal}
        template={editingTemplate}
        onClose={() => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
      />

      {/* Workout Detail Modal */}
      <WorkoutDetailModal
        visible={!!selectedHistoryWorkout}
        workout={selectedHistoryWorkout}
        onClose={() => setSelectedHistoryWorkout(null)}
        onRepeatWorkout={handleRepeatWorkout}
        onDeleteWorkout={handleDeleteWorkoutHistory}
      />

      {/* Strong App Importer Modal */}
      <StrongImportModal
        visible={showStrongModal}
        onClose={() => setShowStrongModal(false)}
        onImportSuccess={() => loadData()}
      />
    </View>
  );
}
