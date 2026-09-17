import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../store/useAuthStore";
import { useWorkoutStore } from "../../store/useWorkoutStore";
import { createWorkout, getWorkouts, getTemplates, type TemplateWithExercises } from "../../db/queries";
import { Play, Dumbbell, Settings, Bookmark, ChevronRight, Download } from "lucide-react-native";
import { SyncStatus } from "../../components/SyncStatus";
import { StrongImportModal } from "../../components/StrongImportModal";
import { Link } from "expo-router";
import { useCleanUI, cx } from "../../lib/theme";
import type { Workout } from "../../db/schema";

export default function HomeScreen() {
  const router = useRouter();
  const cleanUI = useCleanUI();
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

  const tap = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

  return (
    <ScrollView className="flex-1 bg-black" showsVerticalScrollIndicator={false}>
      <View className="p-5 pt-12">
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text
              className={cx(
                cleanUI,
                "text-[22px] font-semibold text-white tracking-tight",
                "text-2xl font-black text-white tracking-tight"
              )}
            >
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </Text>
            <Text
              className={cx(
                cleanUI,
                "text-[13px] text-[#98989F] mt-0.5",
                "text-xs font-mono font-bold text-zinc-400"
              )}
            >
              Ready for today's session?
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <SyncStatus />
            <Link href="/settings" asChild>
              <TouchableOpacity
                onPress={tap}
                className={cx(
                  cleanUI,
                  "rounded-full bg-[#1C1C1E] p-2.5",
                  "rounded-full bg-zinc-900 p-2.5 border border-zinc-800"
                )}
              >
                <Settings size={18} color={cleanUI ? "#98989F" : "#A1A1AA"} />
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Active workout banner */}
        {activeWorkout && !activeWorkout.completedAt && (
          <TouchableOpacity
            onPress={() => {
              tap();
              router.push(`/workout/${activeWorkout.id}`);
            }}
            activeOpacity={0.8}
            className={cx(
              cleanUI,
              "mb-4 flex-row items-center justify-between rounded-xl bg-[#0A84FF]/15 p-4",
              "mb-4 flex-row items-center justify-between rounded-2xl bg-amber-500 p-4 shadow-sm"
            )}
          >
            <View className="flex-row items-center gap-3">
              <View
                className={cx(
                  cleanUI,
                  "h-2.5 w-2.5 rounded-full bg-[#0A84FF]",
                  "h-3 w-3 rounded-full bg-black opacity-80"
                )}
              />
              <View>
                <Text
                  className={cx(
                    cleanUI,
                    "text-[13px] text-[#0A84FF] font-medium",
                    "text-[11px] font-black text-amber-950 uppercase tracking-wider"
                  )}
                >
                  Workout in progress
                </Text>
                <Text
                  className={cx(
                    cleanUI,
                    "text-[16px] font-semibold text-white",
                    "text-base font-bold text-black"
                  )}
                >
                  {activeWorkout.title}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Text
                className={cx(
                  cleanUI,
                  "text-[15px] font-medium text-[#0A84FF]",
                  "text-xs font-black text-black uppercase"
                )}
              >
                Resume
              </Text>
              <ChevronRight size={16} color={cleanUI ? "#0A84FF" : "#000000"} />
            </View>
          </TouchableOpacity>
        )}

        {/* Start workout */}
        <TouchableOpacity
          onPress={startWorkout}
          activeOpacity={0.8}
          className={cx(
            cleanUI,
            "mb-3 rounded-xl bg-[#0A84FF] p-4",
            "mb-3.5 rounded-2xl bg-[#CCFF00] p-5 shadow-lg shadow-[#CCFF00]/10"
          )}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Play
                size={cleanUI ? 20 : 24}
                color="#FFFFFF"
                fill="#FFFFFF"
              />
              <View>
                <Text
                  className={cx(
                    cleanUI,
                    "text-[17px] font-semibold text-white",
                    "text-xl font-black text-black tracking-tight"
                  )}
                >
                  Start Workout
                </Text>
                {!cleanUI && (
                  <Text className="text-xs font-bold text-black/70">
                    Track sets, rest timer & auto overload
                  </Text>
                )}
              </View>
            </View>
            <ChevronRight size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Import */}
        <TouchableOpacity
          onPress={() => {
            tap();
            setShowStrongModal(true);
          }}
          activeOpacity={0.8}
          className={cx(
            cleanUI,
            "mb-6 flex-row items-center justify-between rounded-xl bg-[#141414] p-4",
            "mb-6 rounded-2xl border border-cyan-500/40 bg-zinc-900 p-4 shadow-md"
          )}
        >
          <View className="flex-row items-center gap-3">
            <Download size={20} color={cleanUI ? "#0A84FF" : "#38BDF8"} />
            <View>
              <Text
                className={cx(
                  cleanUI,
                  "text-[16px] font-medium text-white",
                  "text-base font-black text-white tracking-tight"
                )}
              >
                Import Workout
              </Text>
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#98989F]",
                  "text-xs font-mono text-zinc-400"
                )}
              >
                From Strong or CSV
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={cleanUI ? "#636366" : "#38BDF8"} />
        </TouchableOpacity>

        {/* Templates */}
        {templates.length > 0 && (
          <View className="mb-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                className={cx(
                  cleanUI,
                  "text-[17px] font-semibold text-white",
                  "text-base font-black text-white"
                )}
              >
                Routines
              </Text>
              <TouchableOpacity
                onPress={() => {
                  tap();
                  router.push("/(tabs)/workouts");
                }}
              >
                <Text
                  className={cx(
                    cleanUI,
                    "text-[15px] text-[#0A84FF]",
                    "text-xs font-bold text-cyan-400"
                  )}
                >
                  See all
                </Text>
              </TouchableOpacity>
            </View>

            <View className={cx(cleanUI, "gap-0", "gap-2.5")}>
              {templates.map((tpl, i) => (
                <TouchableOpacity
                  key={tpl.id}
                  onPress={() => {
                    tap();
                    router.push("/(tabs)/workouts");
                  }}
                  activeOpacity={0.8}
                  className={cx(
                    cleanUI,
                    `flex-row items-center justify-between py-3 ${
                      i > 0 ? "border-t border-[#2C2C2E]" : ""
                    }`,
                    "flex-row items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900 p-3.5"
                  )}
                >
                  <View className="flex-1 pr-2">
                    <Text
                      className={cx(
                        cleanUI,
                        "text-[16px] text-white",
                        "text-sm font-bold text-white"
                      )}
                      numberOfLines={1}
                    >
                      {tpl.name}
                    </Text>
                    <Text
                      className={cx(
                        cleanUI,
                        "text-[13px] text-[#98989F]",
                        "text-xs font-mono text-zinc-400"
                      )}
                    >
                      {tpl.exercises.length} exercises
                    </Text>
                  </View>
                  <ChevronRight size={16} color={cleanUI ? "#636366" : "#38BDF8"} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent activity */}
        <View
          className={cx(
            cleanUI,
            "rounded-xl bg-[#141414] p-4",
            "rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4"
          )}
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text
              className={cx(
                cleanUI,
                "text-[17px] font-semibold text-white",
                "text-base font-black text-white"
              )}
            >
              Recent Activity
            </Text>
            <TouchableOpacity
              onPress={() => {
                tap();
                router.push("/(tabs)/workouts");
              }}
            >
              <Text
                className={cx(
                  cleanUI,
                  "text-[15px] text-[#0A84FF]",
                  "text-xs font-bold text-cyan-400"
                )}
              >
                History
              </Text>
            </TouchableOpacity>
          </View>

          {recentWorkouts.length === 0 ? (
            <Text
              className={cx(
                cleanUI,
                "text-[14px] text-[#98989F] py-2",
                "text-xs text-zinc-500 py-2"
              )}
            >
              Your logged workouts will appear here once you finish training.
            </Text>
          ) : (
            recentWorkouts.map((w, i) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => {
                  tap();
                  setActiveWorkout(w);
                  router.push(`/workout/${w.id}`);
                }}
                activeOpacity={0.8}
                className={cx(
                  cleanUI,
                  `flex-row items-center justify-between py-3 ${
                    i > 0 ? "border-t border-[#2C2C2E]" : ""
                  }`,
                  "flex-row items-center justify-between border-t border-zinc-800/60 py-2.5"
                )}
              >
                <View>
                  <Text
                    className={cx(
                      cleanUI,
                      "text-[16px] text-white",
                      "text-sm font-semibold text-white"
                    )}
                  >
                    {w.title}
                  </Text>
                  <Text
                    className={cx(
                      cleanUI,
                      "text-[13px] text-[#98989F]",
                      "text-xs font-mono text-zinc-400"
                    )}
                  >
                    {new Date(w.startedAt).toLocaleDateString()}
                  </Text>
                </View>
                <ChevronRight size={16} color={cleanUI ? "#636366" : "#71717A"} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      <StrongImportModal
        visible={showStrongModal}
        onClose={() => setShowStrongModal(false)}
        onImportSuccess={() => load()}
      />
    </ScrollView>
  );
}
