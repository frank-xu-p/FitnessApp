import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../store/useAuthStore";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { createWorkout, getWorkouts, getTemplates, type TemplateWithExercises } from "../../db/queries";
import { Play, Dumbbell, Settings, Bookmark, ChevronRight, Download, Sparkles, Plus, FileText } from "lucide-react-native";
import { SyncStatus } from "../../components/SyncStatus";
import { StrongImportModal } from "../../components/StrongImportModal";
import { Link } from "expo-router";
import type { Workout } from "../../db/schema";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeWorkout, setActiveWorkout, startEmptyWorkout } = useWorkoutStore();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [showStrongModal, setShowStrongModal] = useState(false);

  const userId = user?.id ?? "local";

  const load = useCallback(async () => {
    try {
      const [wRows, tRows] = await Promise.all([
        getWorkouts(userId),
        getTemplates(userId),
      ]);
      setRecentWorkouts(wRows.slice(0, 3));
      setTemplates(tRows.slice(0, 2));
    } catch (err) {
      console.error("Failed to load home data", err);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const startWorkout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const workout = await createWorkout(userId, "Quick Workout");
    startEmptyWorkout(workout);
    router.push(`/workout/${workout.id}`);
  };

  return (
    <ScrollView className="flex-1 bg-black" showsVerticalScrollIndicator={false}>
      <View className="p-5 pt-12">
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-white tracking-tight">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </Text>
            <Text className="text-xs font-mono font-bold text-zinc-400">
              Ready to crush today's session?
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <SyncStatus />
            <Link href="/settings" asChild>
              <TouchableOpacity
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)}
                className="rounded-full bg-zinc-900 p-2.5 border border-zinc-800"
              >
                <Settings size={18} color="#A1A1AA" />
              </TouchableOpacity>
            </Link>
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
            className="mb-4 flex-row items-center justify-between rounded-2xl bg-amber-500 p-4 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-3 w-3 rounded-full bg-black opacity-80" />
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

        {/* Main Action 1: Start Workout Hero (Neon Lime Button) */}
        <TouchableOpacity
          onPress={startWorkout}
          activeOpacity={0.8}
          className="mb-3.5 rounded-2xl bg-[#CCFF00] p-5 shadow-lg shadow-[#CCFF00]/10"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3.5">
              <View className="rounded-xl bg-black p-3">
                <Play size={24} color="#CCFF00" fill="#CCFF00" />
              </View>
              <View>
                <Text className="text-xl font-black text-black tracking-tight">
                  Start Workout
                </Text>
                <Text className="text-xs font-bold text-black/70">
                  Track sets, rest timer & auto overload
                </Text>
              </View>
            </View>
            <ChevronRight size={22} color="#000000" />
          </View>
        </TouchableOpacity>

        {/* Main Action 2: Prominent Import Strong Workout Card (Cyan Border) */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setShowStrongModal(true);
          }}
          activeOpacity={0.8}
          className="mb-6 rounded-2xl border border-cyan-500/40 bg-zinc-900 p-4 shadow-md"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3.5">
              <View className="rounded-xl bg-cyan-500/20 p-3 border border-cyan-500/40">
                <Download size={22} color="#38BDF8" />
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-black text-white tracking-tight">
                    Import Workout / Routine
                  </Text>
                  <View className="rounded-md bg-cyan-500/20 px-1.5 py-0.5">
                    <Text className="text-[10px] font-mono font-bold text-cyan-400">
                      STRONG / CSV
                    </Text>
                  </View>
                </View>
                <Text className="text-xs font-mono text-zinc-400">
                  Paste Strong clipboard share or CSV export
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#38BDF8" />
          </View>
        </TouchableOpacity>

        {/* Quick Templates Section */}
        {templates.length > 0 && (
          <View className="mb-6">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Bookmark size={18} color="#38BDF8" />
                <Text className="text-base font-black text-white">
                  Featured Routines
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  router.push("/(tabs)/workouts");
                }}
              >
                <Text className="text-xs font-bold text-cyan-400">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="gap-2.5">
              {templates.map((tpl) => (
                <TouchableOpacity
                  key={tpl.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    router.push("/(tabs)/workouts");
                  }}
                  activeOpacity={0.8}
                  className="flex-row items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900 p-3.5"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-white">
                      {tpl.name}
                    </Text>
                    <Text className="text-xs font-mono text-zinc-400">
                      {tpl.exercises.length} exercises · {tpl.category}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs font-bold text-cyan-400">Open</Text>
                    <ChevronRight size={14} color="#38BDF8" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent Workouts Card */}
        <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Dumbbell size={18} color="#38BDF8" />
              <Text className="text-base font-black text-white">
                Recent Activity
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                router.push("/(tabs)/workouts");
              }}
            >
              <Text className="text-xs font-bold text-cyan-400">History</Text>
            </TouchableOpacity>
          </View>

          {recentWorkouts.length === 0 ? (
            <Text className="text-xs text-zinc-500 py-2">
              Your logged workouts will appear here once you finish training.
            </Text>
          ) : (
            recentWorkouts.map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setActiveWorkout(w);
                  router.push(`/workout/${w.id}`);
                }}
                activeOpacity={0.8}
                className="flex-row items-center justify-between border-t border-zinc-800/60 py-2.5"
              >
                <View>
                  <Text className="text-sm font-semibold text-white">
                    {w.title}
                  </Text>
                  <Text className="text-xs font-mono text-zinc-400">
                    {new Date(w.startedAt).toLocaleDateString()}
                  </Text>
                </View>
                <ChevronRight size={16} color="#71717A" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Strong App Importer Modal on Home */}
      <StrongImportModal
        visible={showStrongModal}
        onClose={() => setShowStrongModal(false)}
        onImportSuccess={() => load()}
      />
    </ScrollView>
  );
}
