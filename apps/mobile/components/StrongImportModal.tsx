import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  X,
  ClipboardPaste,
  FileText,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  parseStrongText,
  parseStrongCsv,
  importStrongAsWorkout,
  importStrongAsTemplate,
  type ParsedWorkout,
} from "../lib/importers/strongImporter";
import { db } from "../db/client";
import { getExercises } from "../db/queries";
import type { Exercise } from "../db/schema";

export type StrongImportModalProps = {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
};

export function StrongImportModal({
  visible,
  onClose,
  onImportSuccess,
}: StrongImportModalProps) {
  const [inputText, setInputText] = useState("");
  const [candidateExercises, setCandidateExercises] = useState<Exercise[]>([]);
  // H6: keep every parsed workout — the CSV can contain many, and the old
  // code silently discarded all but the first.
  const [parsedList, setParsedList] = useState<ParsedWorkout[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");

  const parsed = parsedList[selectedIdx] ?? null;

  useEffect(() => {
    if (visible) {
      getExercises()
        .then((exs) => setCandidateExercises(exs))
        .catch(() => setCandidateExercises([]));
    }
  }, [visible]);

  useEffect(() => {
    if (!inputText.trim()) {
      setParsedList([]);
      return;
    }

    if (inputText.includes(",") && inputText.toLowerCase().includes("workout name")) {
      const csvResults = parseStrongCsv(inputText, candidateExercises);
      setParsedList(csvResults);
      setSelectedIdx(0);
      setTemplateName(csvResults[0]?.title ?? "");
    } else {
      const result = parseStrongText(inputText, candidateExercises);
      if (result.exercises.length > 0) {
        setParsedList([result]);
        setSelectedIdx(0);
        setTemplateName(result.title);
      } else {
        setParsedList([]);
      }
    }
  }, [inputText, candidateExercises]);

  const handlePasteClipboard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setInputText(text);
      }
    } catch {
      // ignore
    }
  };

  const resetForm = () => {
    setInputText("");
    setParsedList([]);
    setSelectedIdx(0);
    setImportProgress(null);
  };

  const handleImportAsWorkout = async () => {
    if (parsedList.length === 0) return;
    setImporting(true);
    setImportProgress(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    try {
      let imported = 0;
      for (let i = 0; i < parsedList.length; i++) {
        setImportProgress(`Importing workout ${i + 1} of ${parsedList.length}…`);
        await importStrongAsWorkout(parsedList[i], "local", db);
        imported++;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert(
        "Import Successful",
        `Imported ${imported} workout${imported === 1 ? "" : "s"} into your workout history!`,
        [
          {
            text: "Done",
            onPress: () => {
              resetForm();
              onClose();
              if (onImportSuccess) onImportSuccess();
            },
          },
        ]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert("Import Failed", err?.message || "Failed to import workout.");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleImportAsTemplate = async () => {
    if (!parsed) return;
    setImporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    try {
      await importStrongAsTemplate(parsed, "local", templateName.trim() || parsed.title, db);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert(
        "Template Created",
        `Created new routine template "${templateName || parsed.title}" with ${parsed.exercises.length} exercises!`,
        [
          {
            text: "Done",
            onPress: () => {
              resetForm();
              onClose();
              if (onImportSuccess) onImportSuccess();
            },
          },
        ]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert("Import Failed", err?.message || "Failed to create template.");
    } finally {
      setImporting(false);
    }
  };

  const totalSets = parsed
    ? parsed.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {/* Modal Top Bar */}
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-zinc-800/80 bg-zinc-950">
          <View className="flex-row items-center gap-2.5">
            <View className="h-8 w-8 rounded-lg bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
              <FileText size={18} color="#38BDF8" />
            </View>
            <View>
              <Text className="text-base font-black text-white">
                Strong App Importer
              </Text>
              <Text className="text-[11px] font-mono text-zinc-400">
                Paste plain-text share or CSV data
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onClose();
            }}
            activeOpacity={0.8}
            className="rounded-full bg-zinc-900 p-2 border border-zinc-800"
          >
            <X size={18} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {/* Paste Actions */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-black uppercase text-zinc-400 tracking-wider">
              Workout Export Text / CSV
            </Text>
            <TouchableOpacity
              onPress={handlePasteClipboard}
              activeOpacity={0.8}
              className="flex-row items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 border border-cyan-500/40"
            >
              <ClipboardPaste size={13} color="#38BDF8" />
              <Text className="text-xs font-bold text-cyan-400">
                Paste from Clipboard
              </Text>
            </TouchableOpacity>
          </View>

          {/* Text Input Area */}
          <View className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 mb-4">
            <TextInput
              testID="strong-import-input"
              value={inputText}
              onChangeText={setInputText}
              placeholder="Paste Strong workout share here...&#10;e.g.&#10;Day 4 Push 2&#10;Friday, August 28, 2026 at 20:01&#10;&#10;Shoulder Press (Machine)&#10;D: 240 lb × 6 reps&#10;Set 1: 210 lb × 5 reps"
              placeholderTextColor="#52525B"
              multiline
              numberOfLines={6}
              className="min-h-[140px] text-xs font-mono text-white"
              textAlignVertical="top"
            />
          </View>

          {/* Workout selector — shown when the CSV contained multiple workouts */}
          {parsedList.length > 1 && (
            <View className="mb-4">
              <Text className="text-xs font-black uppercase text-zinc-400 tracking-wider mb-2">
                {parsedList.length} workouts found — previewing {selectedIdx + 1} of {parsedList.length}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {parsedList.map((w, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedIdx(idx);
                      setTemplateName(w.title);
                    }}
                    activeOpacity={0.8}
                    className={`mr-2 rounded-xl border px-3 py-2 ${
                      idx === selectedIdx
                        ? "border-cyan-500/60 bg-cyan-500/15"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        idx === selectedIdx ? "text-cyan-300" : "text-zinc-400"
                      }`}
                      numberOfLines={1}
                    >
                      {w.title}
                    </Text>
                    <Text className="text-[10px] font-mono text-zinc-500">
                      {new Date(w.startedAt).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text className="mt-2 text-[11px] text-zinc-500">
                Importing as a workout log will import all {parsedList.length} workouts. Templates are created from the selected workout.
              </Text>
            </View>
          )}

          {/* Parsing Live Preview Card */}
          {parsed && (
            <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4 mb-5">
              <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                <View>
                  <Text className="text-sm font-black text-white">
                    {parsed.title}
                  </Text>
                  <Text className="text-[11px] font-mono text-zinc-400">
                    {new Date(parsed.startedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="rounded-lg bg-cyan-500/20 px-2 py-0.5 border border-cyan-500/30">
                    <Text className="text-[10px] font-mono font-bold text-cyan-300">
                      {parsed.exercises.length} Exercises
                    </Text>
                  </View>
                  <View className="rounded-lg bg-lime-400/20 px-2 py-0.5 border border-lime-400/30">
                    <Text className="text-[10px] font-mono font-bold text-[#CCFF00]">
                      {totalSets} Sets
                    </Text>
                  </View>
                </View>
              </View>

              {/* Exercise Items List */}
              <View className="gap-2">
                {parsed.exercises.map((exBlock, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center justify-between py-1.5 border-b border-zinc-800/60"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-bold text-white" numberOfLines={1}>
                        {exBlock.rawExerciseName}
                      </Text>
                      <Text className="text-[10px] font-mono text-zinc-400">
                        {exBlock.matchedExerciseId
                          ? `✓ Matched: ${exBlock.matchedExerciseName}`
                          : "+ Creates new movement"}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-xs font-mono font-bold text-cyan-400">
                        {exBlock.sets.length} {exBlock.sets.length === 1 ? "set" : "sets"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Template Name Input */}
              <View className="mt-4 pt-3 border-t border-zinc-800">
                <Text className="text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
                  Routine / Template Title
                </Text>
                <TextInput
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="e.g. Push Day Heavy"
                  placeholderTextColor="#71717A"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white"
                />
              </View>
            </View>
          )}

          {/* Import Action Buttons */}
          {parsed && (
            <View className="gap-2.5 pb-12">
              {importProgress && (
                <Text className="text-center text-xs font-mono text-cyan-400">
                  {importProgress}
                </Text>
              )}
              <TouchableOpacity
                testID="import-as-workout-btn"
                onPress={handleImportAsWorkout}
                disabled={importing}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-3.5 shadow-lg shadow-cyan-500/20"
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Dumbbell size={18} color="#000000" />
                    <Text className="text-sm font-black text-black uppercase tracking-wider">
                      Import{" "}
                      {parsedList.length > 1
                        ? `All ${parsedList.length} Workouts`
                        : "as Completed Workout Log"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="import-as-template-btn"
                onPress={handleImportAsTemplate}
                disabled={importing}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-900 border border-zinc-700 py-3.5"
              >
                <Layers size={18} color="#CCFF00" />
                <Text className="text-sm font-black text-[#CCFF00] uppercase tracking-wider">
                  {parsedList.length > 1
                    ? "Save Selected as Routine Template"
                    : "Save as Reusable Routine Template"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
