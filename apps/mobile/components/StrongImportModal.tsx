import React, { useState, useEffect, useMemo } from "react";
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
  Check,
  ChevronRight,
  ChevronDown,
  Plus,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  parseStrongText,
  parseStrongCsv,
  importStrongAsWorkout,
  importStrongAsTemplate,
  type ParsedWorkout,
  type ParsedExerciseBlock,
} from "../lib/importers/strongImporter";
import { db } from "../db/client";
import { getExercises } from "../db/queries";
import type { Exercise } from "../db/schema";
import { useCleanUI, cx, Clean } from "../lib/theme";

export type StrongImportModalProps = {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
};

type Choice =
  | { type: "existing"; id: string; name: string }
  | { type: "new" };

/** Resolution state of one parsed exercise block. */
function resolveBlock(
  block: ParsedExerciseBlock,
  choice: Choice | undefined
): { status: "exact" | "chosen" | "new" | "unresolved"; label: string } {
  if (block.matchedExerciseId) {
    return { status: "exact", label: block.matchedExerciseName ?? "Matched" };
  }
  if (choice?.type === "existing") {
    return { status: "chosen", label: choice.name };
  }
  if (choice?.type === "new" || block.suggestions.length === 0) {
    return { status: "new", label: "New exercise" };
  }
  return { status: "unresolved", label: "Needs review" };
}

export function StrongImportModal({
  visible,
  onClose,
  onImportSuccess,
}: StrongImportModalProps) {
  const cleanUI = useCleanUI();
  const [inputText, setInputText] = useState("");
  const [candidateExercises, setCandidateExercises] = useState<Exercise[]>([]);
  const [parsedList, setParsedList] = useState<ParsedWorkout[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

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

  /** Blocks needing a user decision across every parsed workout. */
  const unresolvedCount = useMemo(() => {
    const seen = new Set<string>();
    let n = 0;
    for (const w of parsedList) {
      for (const b of w.exercises) {
        if (seen.has(b.rawExerciseName)) continue;
        seen.add(b.rawExerciseName);
        if (resolveBlock(b, choices[b.rawExerciseName]).status === "unresolved") {
          n++;
        }
      }
    }
    return n;
  }, [parsedList, choices]);

  const applyChoices = (list: ParsedWorkout[]): ParsedWorkout[] =>
    list.map((w) => ({
      ...w,
      exercises: w.exercises.map((b) => {
        const c = choices[b.rawExerciseName];
        return {
          ...b,
          chosenExerciseId: c?.type === "existing" ? c.id : null,
          createNewExercise:
            c?.type === "new" || (!b.matchedExerciseId && b.suggestions.length === 0)
              ? true
              : undefined,
        };
      }),
    }));

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
    setChoices({});
    setExpanded(null);
  };

  const pick = (rawName: string, choice: Choice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setChoices((prev) => ({ ...prev, [rawName]: choice }));
    setExpanded(null);
  };

  const handleImportAsWorkout = async () => {
    if (parsedList.length === 0 || unresolvedCount > 0) return;
    setImporting(true);
    setImportProgress(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    try {
      const resolved = applyChoices(parsedList);
      let imported = 0;
      for (let i = 0; i < resolved.length; i++) {
        setImportProgress(`Importing workout ${i + 1} of ${resolved.length}…`);
        await importStrongAsWorkout(resolved[i], "local", db);
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
    if (!parsed || unresolvedCount > 0) return;
    setImporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    try {
      const [resolved] = applyChoices([parsed]);
      await importStrongAsTemplate(resolved, "local", templateName.trim() || parsed.title, db);
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

  const canImport = !!parsed && unresolvedCount === 0 && !importing;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={cx(cleanUI, "flex-1 bg-black", "flex-1 bg-black")}>
        {/* Header */}
        <View
          className={cx(
            cleanUI,
            "flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-[#2C2C2E]",
            "flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-zinc-800/80 bg-zinc-950"
          )}
        >
          <View>
            <Text
              className={cx(
                cleanUI,
                "text-lg font-semibold text-white",
                "text-base font-black text-white"
              )}
            >
              Import Workout
            </Text>
            <Text
              className={cx(
                cleanUI,
                "text-[13px] text-[#98989F]",
                "text-[11px] font-mono text-zinc-400"
              )}
            >
              From Strong · paste text or CSV
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onClose();
            }}
            activeOpacity={0.7}
            className={cx(
              cleanUI,
              "rounded-full bg-[#1C1C1E] p-2",
              "rounded-full bg-zinc-900 p-2 border border-zinc-800"
            )}
          >
            <X size={18} color={cleanUI ? "#98989F" : "#A1A1AA"} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Paste row */}
          <View className="flex-row items-center justify-between mb-2">
            <Text
              className={cx(
                cleanUI,
                "text-[13px] font-medium text-[#98989F]",
                "text-xs font-black uppercase text-zinc-400 tracking-wider"
              )}
            >
              Workout export
            </Text>
            <TouchableOpacity
              onPress={handlePasteClipboard}
              activeOpacity={0.7}
              className={cx(
                cleanUI,
                "rounded-full bg-[#1C1C1E] px-3 py-1.5",
                "flex-row items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 border border-cyan-500/40"
              )}
            >
              <View className="flex-row items-center gap-1">
                <ClipboardPaste size={13} color={cleanUI ? Clean.accent : "#38BDF8"} />
                <Text
                  className={cx(
                    cleanUI,
                    "text-[13px] font-medium text-[#0A84FF]",
                    "text-xs font-bold text-cyan-400"
                  )}
                >
                  Paste
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View
            className={cx(
              cleanUI,
              "rounded-xl bg-[#1C1C1E] p-3 mb-4",
              "rounded-2xl border border-zinc-800 bg-zinc-900 p-3 mb-4"
            )}
          >
            <TextInput
              testID="strong-import-input"
              value={inputText}
              onChangeText={setInputText}
              placeholder="Paste Strong workout share here..."
              placeholderTextColor={cleanUI ? "#636366" : "#52525B"}
              multiline
              numberOfLines={6}
              className={cx(
                cleanUI,
                "min-h-[140px] text-[15px] text-white",
                "min-h-[140px] text-xs font-mono text-white"
              )}
              textAlignVertical="top"
            />
          </View>

          {/* Workout selector */}
          {parsedList.length > 1 && (
            <View className="mb-4">
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#98989F] mb-2",
                  "text-xs font-black uppercase text-zinc-400 tracking-wider mb-2"
                )}
              >
                {parsedList.length} workouts found
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {parsedList.map((w, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedIdx(idx);
                      setTemplateName(w.title);
                    }}
                    activeOpacity={0.7}
                    className={cx(
                      cleanUI,
                      `mr-2 rounded-xl px-3 py-2 ${idx === selectedIdx ? "bg-[#0A84FF]" : "bg-[#1C1C1E]"}`,
                      `mr-2 rounded-xl border px-3 py-2 ${
                        idx === selectedIdx
                          ? "border-cyan-500/60 bg-cyan-500/15"
                          : "border-zinc-800 bg-zinc-900"
                      }`
                    )}
                  >
                    <Text
                      className={cx(
                        cleanUI,
                        `text-[13px] font-medium ${idx === selectedIdx ? "text-white" : "text-[#98989F]"}`,
                        `text-xs font-bold ${idx === selectedIdx ? "text-cyan-300" : "text-zinc-400"}`
                      )}
                      numberOfLines={1}
                    >
                      {w.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Preview */}
          {parsed && (
            <View
              className={cx(
                cleanUI,
                "rounded-xl bg-[#141414] p-4 mb-5",
                "rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4 mb-5"
              )}
            >
              <View
                className={cx(
                  cleanUI,
                  "flex-row items-baseline justify-between mb-1",
                  "flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5"
                )}
              >
                <View className="flex-1 pr-2">
                  <Text
                    className={cx(
                      cleanUI,
                      "text-[17px] font-semibold text-white",
                      "text-sm font-black text-white"
                    )}
                    numberOfLines={1}
                  >
                    {parsed.title}
                  </Text>
                  <Text
                    className={cx(
                      cleanUI,
                      "text-[13px] text-[#98989F]",
                      "text-[11px] font-mono text-zinc-400"
                    )}
                  >
                    {new Date(parsed.startedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {parsed.exercises.length} exercises · {totalSets} sets
                  </Text>
                </View>
              </View>

              {unresolvedCount > 0 && (
                <View className="flex-row items-center gap-1.5 mb-2 mt-1">
                  <AlertCircle size={14} color="#FF9F0A" />
                  <Text className="text-[13px] text-[#FF9F0A]">
                    {unresolvedCount} exercise{unresolvedCount === 1 ? "" : "s"} need{unresolvedCount === 1 ? "s" : ""} your review
                  </Text>
                </View>
              )}

              <View>
                {parsed.exercises.map((block, idx) => {
                  const key = block.rawExerciseName;
                  const r = resolveBlock(block, choices[key]);
                  const isOpen = expanded === key;
                  return (
                    <View
                      key={`${key}-${idx}`}
                      className={cx(
                        cleanUI,
                        "border-b border-[#2C2C2E] last:border-b-0",
                        "border-b border-zinc-800/60 last:border-b-0"
                      )}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          r.status === "unresolved" || r.status === "chosen"
                            ? setExpanded(isOpen ? null : key)
                            : undefined
                        }
                        activeOpacity={r.status === "unresolved" || r.status === "chosen" ? 0.7 : 1}
                        className="flex-row items-center justify-between py-2.5"
                      >
                        <View className="flex-1 pr-2">
                          <Text
                            className={cx(
                              cleanUI,
                              "text-[15px] text-white",
                              "text-xs font-bold text-white"
                            )}
                            numberOfLines={1}
                          >
                            {block.rawExerciseName}
                          </Text>
                          <Text
                            className={cx(
                              cleanUI,
                              `text-[13px] ${
                                r.status === "exact"
                                  ? "text-[#98989F]"
                                  : r.status === "unresolved"
                                    ? "text-[#FF9F0A]"
                                    : "text-[#0A84FF]"
                              }`,
                              "text-[10px] font-mono text-zinc-400"
                            )}
                            numberOfLines={1}
                          >
                            {r.status === "exact" && `✓ ${r.label}`}
                            {r.status === "chosen" && `✓ ${r.label}`}
                            {r.status === "new" && `+ ${r.label}`}
                            {r.status === "unresolved" && "Tap to match or create new"}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            className={cx(
                              cleanUI,
                              "text-[13px] text-[#98989F]",
                              "text-xs font-mono font-bold text-cyan-400"
                            )}
                          >
                            {block.sets.length}×
                          </Text>
                          {(r.status === "unresolved" || r.status === "chosen") &&
                            (isOpen ? (
                              <ChevronDown size={16} color={cleanUI ? "#98989F" : "#71717A"} />
                            ) : (
                              <ChevronRight size={16} color={cleanUI ? "#98989F" : "#71717A"} />
                            ))}
                        </View>
                      </TouchableOpacity>

                      {isOpen && (
                        <View className="pb-3">
                          {block.suggestions.map((s) => {
                            const selected =
                              choices[key]?.type === "existing" &&
                              choices[key].id === s.id;
                            return (
                              <TouchableOpacity
                                key={s.id}
                                onPress={() =>
                                  pick(key, { type: "existing", id: s.id, name: s.name })
                                }
                                activeOpacity={0.7}
                                className={cx(
                                  cleanUI,
                                  `flex-row items-center justify-between rounded-xl px-3 py-2.5 mb-1.5 ${
                                    selected ? "bg-[#0A84FF]/15" : "bg-[#1C1C1E]"
                                  }`,
                                  `flex-row items-center justify-between rounded-xl border px-3 py-2.5 mb-1.5 ${
                                    selected ? "border-cyan-500/60 bg-cyan-500/10" : "border-zinc-800 bg-zinc-950"
                                  }`
                                )}
                              >
                                <Text
                                  className={cx(
                                    cleanUI,
                                    `text-[15px] ${selected ? "text-white font-medium" : "text-[#E5E5EA]"}`,
                                    `text-xs ${selected ? "text-white font-bold" : "text-zinc-300"}`
                                  )}
                                  numberOfLines={1}
                                >
                                  {s.name}
                                </Text>
                                {selected && (
                                  <Check size={16} color={cleanUI ? "#0A84FF" : "#38BDF8"} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            onPress={() => pick(key, { type: "new" })}
                            activeOpacity={0.7}
                            className={cx(
                              cleanUI,
                              `flex-row items-center justify-between rounded-xl px-3 py-2.5 ${
                                choices[key]?.type === "new" ? "bg-[#0A84FF]/15" : "bg-[#1C1C1E]"
                              }`,
                              `flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                                choices[key]?.type === "new"
                                  ? "border-cyan-500/60 bg-cyan-500/10"
                                  : "border-zinc-800 bg-zinc-950"
                              }`
                            )}
                          >
                            <View className="flex-row items-center gap-2">
                              <Plus size={15} color={cleanUI ? "#0A84FF" : "#CCFF00"} />
                              <Text
                                className={cx(
                                  cleanUI,
                                  "text-[15px] text-[#E5E5EA]",
                                  "text-xs font-bold text-zinc-300"
                                )}
                              >
                                Create new exercise
                              </Text>
                            </View>
                            {choices[key]?.type === "new" && (
                              <Check size={16} color={cleanUI ? "#0A84FF" : "#38BDF8"} />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Template name */}
              <View className={cx(cleanUI, "mt-3 pt-3 border-t border-[#2C2C2E]", "mt-4 pt-3 border-t border-zinc-800")}>
                <Text
                  className={cx(
                    cleanUI,
                    "text-[13px] text-[#98989F] mb-1.5",
                    "text-[11px] font-bold text-zinc-400 uppercase mb-1.5"
                  )}
                >
                  Template name
                </Text>
                <TextInput
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="e.g. Push Day Heavy"
                  placeholderTextColor={cleanUI ? "#636366" : "#71717A"}
                  className={cx(
                    cleanUI,
                    "rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-[15px] text-white",
                    "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white"
                  )}
                />
              </View>
            </View>
          )}

          {/* Actions */}
          {parsed && (
            <View className="gap-2.5 pb-12">
              {importProgress && (
                <Text
                  className={cx(
                    cleanUI,
                    "text-center text-[13px] text-[#0A84FF]",
                    "text-center text-xs font-mono text-cyan-400"
                  )}
                >
                  {importProgress}
                </Text>
              )}
              <TouchableOpacity
                testID="import-as-workout-btn"
                onPress={handleImportAsWorkout}
                disabled={!canImport}
                activeOpacity={0.8}
                className={cx(
                  cleanUI,
                  `rounded-xl py-3.5 items-center ${canImport ? "bg-[#0A84FF]" : "bg-[#1C1C1E] opacity-60"}`,
                  `flex-row items-center justify-center gap-2 rounded-2xl py-3.5 ${
                    canImport ? "bg-cyan-500 shadow-lg shadow-cyan-500/20" : "bg-zinc-800 opacity-60"
                  }`
                )}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    className={cx(
                      cleanUI,
                      "text-[16px] font-semibold text-white",
                      "text-sm font-black text-black uppercase tracking-wider"
                    )}
                  >
                    {parsedList.length > 1
                      ? `Import all ${parsedList.length} workouts`
                      : "Import as workout"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="import-as-template-btn"
                onPress={handleImportAsTemplate}
                disabled={!canImport}
                activeOpacity={0.8}
                className={cx(
                  cleanUI,
                  `rounded-xl py-3.5 items-center ${canImport ? "bg-[#1C1C1E]" : "bg-[#1C1C1E] opacity-60"}`,
                  "flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-900 border border-zinc-700 py-3.5"
                )}
              >
                <Text
                  className={cx(
                    cleanUI,
                    "text-[16px] font-semibold text-[#0A84FF]",
                    "text-sm font-black text-[#CCFF00] uppercase tracking-wider"
                  )}
                >
                  {parsedList.length > 1 ? "Save selected as template" : "Save as template"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
