import { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Trophy, Clock, Dumbbell, CheckCircle2, X, RefreshCw, BookmarkPlus, Layers } from "lucide-react-native";
import { useAuthStore } from "../store/useAuthStore";
import { toDisplay } from "../lib/units";
import type { Workout, Set, WorkoutTemplate } from "../db/schema";

export type TemplateAction = "none" | "save_new" | "update_all" | "update_values_only";

export type FinishWorkoutModalProps = {
  visible: boolean;
  onClose: () => void;
  workout: Workout;
  sets: Set[];
  durationSeconds: number;
  template?: WorkoutTemplate | null;
  templateName?: string | null;
  isStructureModified?: boolean;
  onFinish: (options: {
    notes?: string;
    templateAction: TemplateAction;
    newTemplateName?: string;
  }) => Promise<void>;
};

export function FinishWorkoutModal({
  visible,
  onClose,
  workout,
  sets,
  durationSeconds,
  template,
  templateName,
  isStructureModified = false,
  onFinish,
}: FinishWorkoutModalProps) {
  const { displayUnit } = useAuthStore();
  const [notes, setNotes] = useState("");
  const isFromTemplate = !!workout.templateId;

  // For exact same workout structure: simple toggle for updating weights
  const [updateTemplateWeights, setUpdateTemplateWeights] = useState(true);

  // For modified workout structure: choose between overwrite, save new, or none
  const [modifiedAction, setModifiedAction] = useState<"update_all" | "save_new" | "none">("update_all");

  // For scratch workout: save as template toggle
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState(
    isFromTemplate
      ? `${templateName || workout.title} (Variation)`
      : workout.title || "My Workout"
  );
  const [loading, setLoading] = useState(false);

  // Compute summary stats
  const completedSets = sets.filter((s) => s.completedAt != null);
  const totalReps = completedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const totalVolumeKg = completedSets.reduce((sum, s) => {
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    return sum + w * r;
  }, 0);

  const displayVolume = toDisplay(totalVolumeKg, displayUnit) ?? 0;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      let action: TemplateAction = "none";
      if (isFromTemplate) {
        if (!isStructureModified) {
          action = updateTemplateWeights ? "update_values_only" : "none";
        } else {
          action = modifiedAction;
        }
      } else {
        action = saveAsTemplate ? "save_new" : "none";
      }

      await onFinish({
        notes: notes.trim() || undefined,
        templateAction: action,
        newTemplateName: newTemplateName.trim() || workout.title,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View testID="finish-workout-modal" className="flex-1 justify-end bg-black/70">
        <View className="max-h-[90%] rounded-t-3xl bg-gray-900 p-6 border-t border-gray-800 shadow-2xl">
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="mb-5 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="rounded-2xl bg-amber-500/20 p-3">
                  <Trophy size={28} color="#F59E0B" />
                </View>
                <View>
                  <Text className="text-xl font-black text-white">
                    Workout Completed!
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {workout.title || "Great session today"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="rounded-full bg-gray-800 p-2"
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Quick Stats Grid */}
            <View className="mb-5 flex-row gap-2.5">
              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3.5 items-center border border-gray-700/50">
                <Clock size={20} color="#38BDF8" />
                <Text className="mt-1 text-[11px] font-bold text-gray-400 uppercase">Duration</Text>
                <Text className="text-base font-black text-white font-mono">
                  {formatDuration(durationSeconds)}
                </Text>
              </View>

              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3.5 items-center border border-gray-700/50">
                <Dumbbell size={20} color="#10B981" />
                <Text className="mt-1 text-[11px] font-bold text-gray-400 uppercase">Volume</Text>
                <Text className="text-base font-black text-white">
                  {Math.round(displayVolume)} {displayUnit}
                </Text>
              </View>

              <View className="flex-1 rounded-2xl bg-gray-800/80 p-3.5 items-center border border-gray-700/50">
                <CheckCircle2 size={20} color="#A855F7" />
                <Text className="mt-1 text-[11px] font-bold text-gray-400 uppercase">Sets / Reps</Text>
                <Text className="text-base font-black text-white">
                  {completedSets.length} / {totalReps}
                </Text>
              </View>
            </View>

            {/* Template Management Options */}
            <View className="mb-4 rounded-2xl border border-gray-800 bg-gray-800/50 p-4">
              {/* CASE 1: Started from template, same exercises (suggest update weights) */}
              {isFromTemplate && !isStructureModified && (
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-white">
                      Update Template Weights
                    </Text>
                    <Text className="text-xs text-gray-400">
                      Save today's top weights into "{templateName ?? workout.title}" for progressive overload in your next session.
                    </Text>
                  </View>
                  <Switch
                    value={updateTemplateWeights}
                    onValueChange={setUpdateTemplateWeights}
                    trackColor={{ false: "#374151", true: "#0284C7" }}
                    thumbColor={updateTemplateWeights ? "#38BDF8" : "#9CA3AF"}
                  />
                </View>
              )}

              {/* CASE 2: Started from template, exercises were added/removed/modified */}
              {isFromTemplate && isStructureModified && (
                <View>
                  <View className="mb-3">
                    <Text className="text-sm font-bold text-amber-300">
                      Workout Routine Modified
                    </Text>
                    <Text className="text-xs text-gray-400">
                      You added or changed exercises during this session.
                    </Text>
                  </View>

                  <View className="gap-2">
                    {/* Option: Overwrite Template */}
                    <TouchableOpacity
                      onPress={() => setModifiedAction("update_all")}
                      className={`flex-row items-center justify-between rounded-xl p-3 border ${
                        modifiedAction === "update_all"
                          ? "border-sky-500 bg-sky-950/40"
                          : "border-gray-700 bg-gray-800"
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                        <RefreshCw size={16} color={modifiedAction === "update_all" ? "#38BDF8" : "#9CA3AF"} />
                        <View>
                          <Text className="text-sm font-bold text-white">
                            Overwrite "{templateName ?? workout.title}"
                          </Text>
                          <Text className="text-[11px] text-gray-400">
                            Update the saved template to match today's new exercise routine.
                          </Text>
                        </View>
                      </View>
                      {modifiedAction === "update_all" && (
                        <CheckCircle2 size={18} color="#38BDF8" />
                      )}
                    </TouchableOpacity>

                    {/* Option: Save as New Template */}
                    <TouchableOpacity
                      onPress={() => setModifiedAction("save_new")}
                      className={`flex-row items-center justify-between rounded-xl p-3 border ${
                        modifiedAction === "save_new"
                          ? "border-sky-500 bg-sky-950/40"
                          : "border-gray-700 bg-gray-800"
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                        <BookmarkPlus size={16} color={modifiedAction === "save_new" ? "#38BDF8" : "#9CA3AF"} />
                        <View>
                          <Text className="text-sm font-bold text-white">
                            Save as New Routine Template
                          </Text>
                          <Text className="text-[11px] text-gray-400">
                            Keep the original template intact and save this as a separate routine.
                          </Text>
                        </View>
                      </View>
                      {modifiedAction === "save_new" && (
                        <CheckCircle2 size={18} color="#38BDF8" />
                      )}
                    </TouchableOpacity>

                    {modifiedAction === "save_new" && (
                      <TextInput
                        value={newTemplateName}
                        onChangeText={setNewTemplateName}
                        placeholder="New Template Name..."
                        placeholderTextColor="#64748B"
                        className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white"
                      />
                    )}

                    {/* Option: Don't Update Template */}
                    <TouchableOpacity
                      onPress={() => setModifiedAction("none")}
                      className={`flex-row items-center justify-between rounded-xl p-3 border ${
                        modifiedAction === "none"
                          ? "border-sky-500 bg-sky-950/40"
                          : "border-gray-700 bg-gray-800"
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                        <Layers size={16} color={modifiedAction === "none" ? "#38BDF8" : "#9CA3AF"} />
                        <View>
                          <Text className="text-sm font-bold text-white">
                            Don't Update Template
                          </Text>
                          <Text className="text-[11px] text-gray-400">
                            Just record today's session without altering any templates.
                          </Text>
                        </View>
                      </View>
                      {modifiedAction === "none" && (
                        <CheckCircle2 size={18} color="#38BDF8" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* CASE 3: Started from scratch */}
              {!isFromTemplate && (
                <View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-bold text-white">
                        Save as Template Routine?
                      </Text>
                      <Text className="text-xs text-gray-400">
                        Reuse this exercise lineup and weights for future workouts.
                      </Text>
                    </View>
                    <Switch
                      value={saveAsTemplate}
                      onValueChange={setSaveAsTemplate}
                      trackColor={{ false: "#374151", true: "#0284C7" }}
                      thumbColor={saveAsTemplate ? "#38BDF8" : "#9CA3AF"}
                    />
                  </View>
                  {saveAsTemplate && (
                    <TextInput
                      value={newTemplateName}
                      onChangeText={setNewTemplateName}
                      placeholder="Template Name..."
                      placeholderTextColor="#64748B"
                      className="mt-3 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white"
                    />
                  )}
                </View>
              )}
            </View>

            {/* Workout Notes */}
            <View className="mb-6">
              <Text className="mb-1 text-xs font-bold text-gray-400 uppercase">
                Notes (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                placeholder="How did today's session feel? Energy levels, soreness..."
                placeholderTextColor="#64748B"
                className="rounded-2xl border border-gray-800 bg-gray-800/60 p-3 text-sm text-white"
              />
            </View>

            {/* Big Primary Action Buttons */}
            <View className="gap-2.5 pb-4">
              <TouchableOpacity
                onPress={handleComplete}
                disabled={loading}
                activeOpacity={0.8}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 shadow-lg"
              >

                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <CheckCircle2 size={20} color="white" />
                    <Text className="text-base font-black text-white uppercase tracking-wider">
                      Save & Complete Workout
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                className="h-12 items-center justify-center rounded-2xl border border-gray-800 bg-gray-800/40"
              >
                <Text className="text-sm font-bold text-gray-400">Resume Workout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
