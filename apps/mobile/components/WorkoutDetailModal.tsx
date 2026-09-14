import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import {
  X,
  Calendar,
  Clock,
  Dumbbell,
  CheckCircle2,
  Trash2,
  RotateCw,
  Trophy,
} from "lucide-react-native";
import { useAuthStore } from "../store/useAuthStore";
import { toDisplay } from "../lib/units";
import { SET_TYPE_CONFIG } from "./SetTypeModal";
import type { WorkoutHistoryItem } from "../db/queries";

type WorkoutDetailModalProps = {
  visible: boolean;
  workout: WorkoutHistoryItem | null;
  onClose: () => void;
  onRepeatWorkout: (workout: WorkoutHistoryItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
};

export function WorkoutDetailModal({
  visible,
  workout,
  onClose,
  onRepeatWorkout,
  onDeleteWorkout,
}: WorkoutDetailModalProps) {
  const { displayUnit } = useAuthStore();

  if (!workout) return null;

  const displayVolume = toDisplay(workout.totalVolumeKg, displayUnit) ?? 0;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formattedDate = new Date(workout.startedAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = new Date(workout.startedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  // Group sets by exercise
  const exerciseMap = new Map<
    string,
    { name: string; sets: typeof workout.sets }
  >();

  for (const s of workout.sets) {
    const exId = s.exerciseId;
    const exName = s.exercise?.name ?? "Exercise";
    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, { name: exName, sets: [] });
    }
    exerciseMap.get(exId)!.sets.push(s);
  }

  const exerciseGroups = Array.from(exerciseMap.values());

  const handleDelete = () => {
    Alert.alert(
      "Delete Workout",
      `Are you sure you want to remove "${workout.title}" from your history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeleteWorkout(workout.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[92%] rounded-t-3xl bg-gray-900 border-t border-gray-800 p-6 shadow-2xl">
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-xl font-black text-white">
                  {workout.title}
                </Text>
                <View className="mt-1 flex-row items-center gap-1.5">
                  <Calendar size={13} color="#94A3B8" />
                  <Text className="text-xs text-gray-400">
                    {formattedDate} · {formattedTime}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="rounded-full bg-gray-800 p-2"
              >
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View className="mb-5 flex-row gap-2.5">
              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3 items-center border border-gray-700/50">
                <Clock size={18} color="#38BDF8" />
                <Text className="mt-1 text-[10px] font-bold text-gray-400 uppercase">Duration</Text>
                <Text className="text-sm font-black text-white font-mono">
                  {formatDuration(workout.durationSeconds)}
                </Text>
              </View>

              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3 items-center border border-gray-700/50">
                <Dumbbell size={18} color="#10B981" />
                <Text className="mt-1 text-[10px] font-bold text-gray-400 uppercase">Volume</Text>
                <Text className="text-sm font-black text-white">
                  {Math.round(displayVolume)} {displayUnit}
                </Text>
              </View>

              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3 items-center border border-gray-700/50">
                <CheckCircle2 size={18} color="#A855F7" />
                <Text className="mt-1 text-[10px] font-bold text-gray-400 uppercase">Completed</Text>
                <Text className="text-sm font-black text-white">
                  {workout.completedSetsCount} sets
                </Text>
              </View>
            </View>

            {/* Notes if present */}
            {workout.notes && (
              <View className="mb-5 rounded-2xl border border-gray-800 bg-gray-800/40 p-3.5">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Notes</Text>
                <Text className="text-sm italic text-gray-200">
                  "{workout.notes}"
                </Text>
              </View>
            )}

            {/* Exercise Breakdown */}
            <View className="mb-6">
              <Text className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Workout Performance ({exerciseGroups.length} Exercises)
              </Text>

              <View className="gap-3">
                {exerciseGroups.map((group, idx) => (
                  <View
                    key={idx}
                    className="rounded-2xl border border-gray-800 bg-gray-800/40 p-3.5"
                  >
                    <Text className="text-base font-bold text-sky-400 mb-2.5">
                      {group.name}
                    </Text>

                    {/* Table Header */}
                    <View className="flex-row items-center justify-between border-b border-gray-800 pb-1.5 px-1">
                      <Text className="w-10 text-[11px] font-bold text-gray-500 uppercase">Set</Text>
                      <Text className="flex-1 text-center text-[11px] font-bold text-gray-500 uppercase">Weight & Reps</Text>
                      <Text className="w-20 text-right text-[11px] font-bold text-gray-500 uppercase">Intensity</Text>
                    </View>

                    {/* Sets Rows */}
                    {group.sets.map((set, sIdx) => {
                      const setWeight = toDisplay(set.weightKg, displayUnit);
                      const isCompleted = set.completedAt != null;
                      const setTypeConf = SET_TYPE_CONFIG[set.setType as keyof typeof SET_TYPE_CONFIG] || SET_TYPE_CONFIG.standard;

                      return (
                        <View
                          key={sIdx}
                          className="flex-row items-center justify-between py-2 border-b border-gray-800/40 px-1"
                        >
                          <View className="w-10 flex-row items-center gap-1.5">
                            <View
                              className="h-5 w-5 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${setTypeConf.color}25` }}
                            >
                              <Text
                                className="text-[10px] font-black"
                                style={{ color: setTypeConf.color }}
                              >
                                {set.setType === "standard" ? set.setNumber : setTypeConf.badge}
                              </Text>
                            </View>
                          </View>

                          <Text className="flex-1 text-center text-xs font-bold text-white">
                            {setWeight != null ? `${setWeight} ${displayUnit}` : "BW"} × {set.reps ?? 0}
                          </Text>

                          <View className="w-20 items-end">
                            {set.rir !== null && set.rir !== undefined ? (
                              <View className="rounded-md bg-gray-800 px-1.5 py-0.5">
                                <Text className="text-[10px] font-bold text-sky-400">
                                  {set.rir === 0 ? "0 RIR 🔥" : `${set.rir} RIR`}
                                </Text>
                              </View>
                            ) : set.rpe != null ? (
                              <Text className="text-[10px] font-bold text-gray-400">
                                RPE {set.rpe}
                              </Text>
                            ) : (
                              <Text className="text-[10px] text-gray-600">—</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-2.5 pb-6">
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onRepeatWorkout(workout);
                }}
                activeOpacity={0.8}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 shadow-lg"
              >
                <RotateCw size={18} color="white" />
                <Text className="text-base font-black text-white uppercase tracking-wider">
                  Repeat Workout
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.8}
                className="h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/20"
              >
                <Trash2 size={16} color="#EF4444" />
                <Text className="text-sm font-bold text-red-400">
                  Delete from History
                </Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
