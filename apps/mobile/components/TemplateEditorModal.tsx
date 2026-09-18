import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { X, Plus, Trash2, ChevronUp, ChevronDown, Dumbbell, Zap, Check } from "lucide-react-native";
import { ExercisePicker } from "./ExercisePicker";
import { QuickCreateExerciseSheet } from "./QuickCreateExerciseSheet";
import { useAuthStore } from "../store/useAuthStore";
import { toDisplay, toCanonical, kgToLb, lbToKg } from "../lib/units";
import { useCleanUI, cx } from "../lib/theme";
import type { ProgressionModel, CadenceRate } from "../lib/progression";
import type { TemplateWithExercises } from "../db/queries";
import type { Exercise } from "../db/schema";
import { getExerciseDisplayName } from "../lib/exerciseVariants";

type TemplateEditorModalProps = {
  visible: boolean;
  template?: TemplateWithExercises | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    category: string;
    notes?: string;
    autoOverloadEnabled: boolean;
    cadenceModel: ProgressionModel;
    cadenceRate: CadenceRate;
    cadenceIncrementKg?: number | null;
    exercises: Array<{
      exerciseId: string;
      orderIndex: number;
      targetSets: number;
      targetReps?: number;
      targetWeightKg?: number | null;
      targetRpe?: number | null;
      restSeconds?: number;
      notes?: string;
    }>;
  }) => Promise<void>;
};

type EditableTemplateExercise = {
  exerciseId: string;
  /** Null when the referenced exercise was deleted — rendered as a placeholder. */
  exercise: Exercise | null;
  targetSets: number;
  targetReps: number;
  targetWeightDisplay: string;
  targetRpe: number;
};

const CATEGORIES = ["Push/Pull/Legs", "Upper/Lower", "Full Body", "Custom"] as const;

export function TemplateEditorModal({
  visible,
  template,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const { displayUnit } = useAuthStore();
  const cleanUI = useCleanUI();
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "Custom");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [autoOverloadEnabled, setAutoOverloadEnabled] = useState(
    template?.autoOverloadEnabled ?? true
  );
  const [cadenceModel, setCadenceModel] = useState<ProgressionModel>(
    template?.cadenceModel ?? "double_progression"
  );
  const [cadenceRate, setCadenceRate] = useState<CadenceRate>(
    template?.cadenceRate ?? "session"
  );
  // Display-unit string for the per-session increment. Blank = use the
  // equipment default. Stored back in kg via toCanonical on save.
  const [incrementDisplay, setIncrementDisplay] = useState(() =>
    template?.cadenceIncrementKg != null
      ? String(toDisplay(template.cadenceIncrementKg, displayUnit) ?? "")
      : ""
  );
  const [exercisesList, setExercisesList] = useState<EditableTemplateExercise[]>([]);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [createInitial, setCreateInitial] = useState<{ name: string; groupKey: string | null }>({
    name: "",
    groupKey: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setNotes(template.notes ?? "");
      setAutoOverloadEnabled(template.autoOverloadEnabled);
      setCadenceModel(template.cadenceModel);
      setCadenceRate(template.cadenceRate);
      setIncrementDisplay(
        template.cadenceIncrementKg != null
          ? String(toDisplay(template.cadenceIncrementKg, displayUnit) ?? "")
          : ""
      );
      setExercisesList(
        template.exercises.map((te) => ({
          exerciseId: te.exerciseId,
          exercise: te.exercise,
          targetSets: te.targetSets,
          targetReps: te.targetReps ?? 10,
          targetWeightDisplay:
            te.targetWeightKg != null
              ? String(toDisplay(te.targetWeightKg, displayUnit) ?? "")
              : "",
          targetRpe: te.targetRpe ?? 8,
        }))
      );
    } else {
      setName("");
      setCategory("Custom");
      setNotes("");
      setAutoOverloadEnabled(true);
      setCadenceModel("double_progression");
      setCadenceRate("session");
      setIncrementDisplay("");
      setExercisesList([]);
    }
  }, [template, displayUnit, visible]);

  const handleAddExercise = (exercise: Exercise) => {
    setExercisesList((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        exercise,
        targetSets: 3,
        targetReps: 10,
        targetWeightDisplay: "",
        targetRpe: 8,
      },
    ]);
    setPickingExercise(false);
  };

  const handleRemoveExercise = (index: number) => {
    setExercisesList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveExercise = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= exercisesList.length) return;
    const copy = [...exercisesList];
    const item = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = item;
    setExercisesList(copy);
  };

  const handleUpdateExercise = (
    index: number,
    patch: Partial<EditableTemplateExercise>
  ) => {
    setExercisesList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Rows whose exercise was deleted can't be saved meaningfully — drop
      // them (the user already saw the "unavailable" placeholder).
      const payloadExercises = exercisesList
        .filter((item) => item.exercise != null)
        .map((item, index) => {
        const weightNum = item.targetWeightDisplay
          ? parseFloat(item.targetWeightDisplay)
          : null;
        const weightKg =
          weightNum !== null && !isNaN(weightNum)
            ? toCanonical(weightNum, displayUnit)
            : null;

        return {
          exerciseId: item.exerciseId,
          orderIndex: index,
          targetSets: item.targetSets || 3,
          targetReps: item.targetReps || 10,
          targetWeightKg: weightKg,
          targetRpe: item.targetRpe || 8,
          restSeconds: 90,
        };
      });

      await onSave({
        name: name.trim(),
        category,
        notes: notes.trim() || undefined,
        autoOverloadEnabled,
        cadenceModel,
        cadenceRate,
        // Preserve the template's increment; blank = equipment default (null)
        cadenceIncrementKg:
          incrementDisplay.trim() === ""
            ? null
            : toCanonical(parseFloat(incrementDisplay), displayUnit),
        exercises: payloadExercises,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (pickingExercise) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => setPickingExercise(false)}>
        <View
          className={cx(
            cleanUI,
            "flex-1 bg-black pt-10",
            "flex-1 bg-white pt-10 dark:bg-gray-950"
          )}
        >
          <View
            className={cx(
              cleanUI,
              "flex-row items-center justify-between border-b border-[#2C2C2E] px-4 pb-3",
              "flex-row items-center justify-between border-b border-gray-200 px-4 pb-3 dark:border-gray-800"
            )}
          >
            <Text
              className={cx(
                cleanUI,
                "text-[17px] font-semibold text-white",
                "text-lg font-bold text-gray-900 dark:text-gray-100"
              )}
            >
              Add Exercise to Template
            </Text>
            <TouchableOpacity onPress={() => setPickingExercise(false)} className="p-1">
              <X size={24} color={cleanUI ? "#98989F" : "#6B7280"} />
            </TouchableOpacity>
          </View>
          <ExercisePicker
            onSelect={handleAddExercise}
            onCreate={(name, groupKey) => {
              setCreateInitial({ name, groupKey: groupKey ?? null });
              setCreatingExercise(true);
            }}
          />
          <QuickCreateExerciseSheet
            visible={creatingExercise}
            initialName={createInitial.name}
            initialGroupKey={createInitial.groupKey}
            createdBy="template_editor"
            onClose={() => setCreatingExercise(false)}
            onCreated={(exercise) => {
              setCreatingExercise(false);
              handleAddExercise(exercise);
            }}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        className={cx(
          cleanUI,
          "flex-1 bg-black pt-10",
          "flex-1 bg-white pt-10 dark:bg-gray-950"
        )}
      >
        {/* Header */}
        <View
          className={cx(
            cleanUI,
            "flex-row items-center justify-between border-b border-[#2C2C2E] px-4 pb-3",
            "flex-row items-center justify-between border-b border-gray-200 px-4 pb-3 dark:border-gray-800"
          )}
        >
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={24} color={cleanUI ? "#98989F" : "#6B7280"} />
          </TouchableOpacity>
          <Text
            className={cx(
              cleanUI,
              "text-[17px] font-semibold text-white",
              "text-lg font-bold text-gray-900 dark:text-gray-100"
            )}
          >
            {template ? "Edit Template" : "New Template"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!name.trim() || loading}
            className={cx(
              cleanUI,
              "rounded-xl bg-[#0A84FF] px-4 py-2 disabled:opacity-40",
              "rounded-xl bg-primary px-4 py-2 disabled:opacity-40"
            )}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text
                className={cx(
                  cleanUI,
                  "text-[15px] font-semibold text-white",
                  "font-semibold text-white"
                )}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* Template Name */}
          <View className="mb-4">
            <Text
              className={cx(
                cleanUI,
                "mb-1 text-[15px] font-medium text-white",
                "mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200"
              )}
            >
              Template Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Upper Body Hypertrophy"
              placeholderTextColor={cleanUI ? "#636366" : undefined}
              className={cx(
                cleanUI,
                "rounded-xl bg-[#1C1C1E] px-4 py-3 text-[16px] text-white",
                "rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              )}
            />
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text
              className={cx(
                cleanUI,
                "mb-2 text-[15px] font-medium text-white",
                "mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
              )}
            >
              Category
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={cx(
                    cleanUI,
                    `rounded-full px-3 py-1.5 ${category === cat ? "bg-[#0A84FF]" : "bg-[#1C1C1E]"}`,
                    `rounded-full px-3 py-1.5 border ${
                      category === cat
                        ? "border-primary bg-primary"
                        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                    }`
                  )}
                >
                  <Text
                    className={cx(
                      cleanUI,
                      `text-[13px] font-medium ${
                        category === cat ? "text-white" : "text-[#98989F]"
                      }`,
                      `text-xs font-semibold ${
                        category === cat ? "text-white" : "text-gray-700 dark:text-gray-300"
                      }`
                    )}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Auto Progressive Overload Switch */}
          <View
            className={cx(
              cleanUI,
              "mb-4 flex-row items-center justify-between rounded-xl bg-[#141414] p-4",
              "mb-5 flex-row items-center justify-between rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40"
            )}
          >
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-1.5">
                <Zap size={16} color="#F59E0B" />
                <Text
                  className={cx(
                    cleanUI,
                    "text-[16px] font-medium text-white",
                    "text-sm font-bold text-amber-900 dark:text-amber-200"
                  )}
                >
                  Auto Progressive Overload
                </Text>
              </View>
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#98989F] mt-0.5",
                  "text-xs text-amber-700 dark:text-amber-300"
                )}
              >
                Automatically loads progressive target weights for each session.
              </Text>
            </View>
            <Switch
              value={autoOverloadEnabled}
              onValueChange={setAutoOverloadEnabled}
              trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
              thumbColor={autoOverloadEnabled ? "#FFFFFF" : "#F3F4F6"}
            />
          </View>

          {autoOverloadEnabled && (
            <View
              className={cx(
                cleanUI,
                "mb-4 rounded-xl bg-[#141414] p-4",
                "mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              )}
            >
              <Text
                className={cx(
                  cleanUI,
                  "mb-1 text-[13px] text-[#98989F]",
                  "mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300"
                )}
              >
                Overload increment ({displayUnit}) — blank = equipment default
              </Text>
              <TextInput
                value={incrementDisplay}
                onChangeText={setIncrementDisplay}
                placeholder="e.g. 2.5"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className={cx(
                  cleanUI,
                  "rounded-xl bg-[#1C1C1E] px-3 py-2 text-[15px] text-white",
                  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                )}
              />
            </View>
          )}

          {/* Exercises Section */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text
              className={cx(
                cleanUI,
                "text-[17px] font-semibold text-white",
                "text-base font-bold text-gray-900 dark:text-gray-100"
              )}
            >
              Exercises ({exercisesList.length})
            </Text>
            <TouchableOpacity
              onPress={() => setPickingExercise(true)}
              className={cx(
                cleanUI,
                "flex-row items-center gap-1 rounded-xl bg-[#0A84FF]/20 px-3 py-1.5",
                "flex-row items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-950/40"
              )}
            >
              <Plus size={16} color={cleanUI ? "#0A84FF" : "#3B82F6"} />
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] font-medium text-[#0A84FF]",
                  "text-xs font-semibold text-primary"
                )}
              >
                Add Exercise
              </Text>
            </TouchableOpacity>
          </View>

          {exercisesList.length === 0 ? (
            <View
              className={cx(
                cleanUI,
                "items-center rounded-xl border border-dashed border-[#2C2C2E] p-8",
                "items-center rounded-2xl border border-dashed border-gray-300 p-8 dark:border-gray-700"
              )}
            >
              <Dumbbell size={32} color={cleanUI ? "#636366" : "#9CA3AF"} />
              <Text
                className={cx(
                  cleanUI,
                  "mt-2 text-[15px] text-[#98989F]",
                  "mt-2 text-sm text-gray-500 dark:text-gray-400"
                )}
              >
                No exercises added yet.
              </Text>
              <TouchableOpacity
                onPress={() => setPickingExercise(true)}
                className={cx(
                  cleanUI,
                  "mt-3 rounded-xl bg-[#0A84FF] px-4 py-2",
                  "mt-3 rounded-xl bg-primary px-4 py-2"
                )}
              >
                <Text
                  className={cx(
                    cleanUI,
                    "text-[15px] font-semibold text-white",
                    "text-xs font-semibold text-white"
                  )}
                >
                  + Add Exercise
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-3 pb-8">
              {exercisesList.map((item, index) => (
                <View
                  key={`${item.exerciseId}_${index}`}
                  className={cx(
                    cleanUI,
                    "rounded-xl bg-[#141414] p-4",
                    "rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
                  )}
                >
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text
                        className={cx(
                          cleanUI,
                          "text-[16px] font-semibold text-white",
                          "text-base font-bold text-gray-900 dark:text-gray-100"
                        )}
                      >
                        {index + 1}. {item.exercise ? getExerciseDisplayName(item.exercise) : "Exercise unavailable"}
                      </Text>
                      <Text
                        className={cx(
                          cleanUI,
                          "text-[13px] text-[#98989F]",
                          "text-xs text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {item.exercise
                          ? (item.exercise.equipment ?? "Free weight")
                          : "This exercise was deleted"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <TouchableOpacity
                        onPress={() => handleMoveExercise(index, "up")}
                        disabled={index === 0}
                        className="rounded p-1 disabled:opacity-20"
                      >
                        <ChevronUp size={20} color={cleanUI ? "#98989F" : "#6B7280"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveExercise(index, "down")}
                        disabled={index === exercisesList.length - 1}
                        className="rounded p-1 disabled:opacity-20"
                      >
                        <ChevronDown size={20} color={cleanUI ? "#98989F" : "#6B7280"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveExercise(index)}
                        className="rounded p-1 ml-1"
                      >
                        <Trash2 size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Target configuration inputs */}
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text
                        className={cx(
                          cleanUI,
                          "mb-1 text-[13px] text-[#98989F]",
                          "mb-1 text-xs text-gray-500 dark:text-gray-400"
                        )}
                      >
                        Sets
                      </Text>
                      <TextInput
                        value={String(item.targetSets)}
                        onChangeText={(val) =>
                          handleUpdateExercise(index, { targetSets: parseInt(val, 10) || 0 })
                        }
                        keyboardType="number-pad"
                        className={cx(
                          cleanUI,
                          "rounded-lg bg-[#1C1C1E] px-2 py-1.5 text-center text-[15px] text-white",
                          "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        )}
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className={cx(
                          cleanUI,
                          "mb-1 text-[13px] text-[#98989F]",
                          "mb-1 text-xs text-gray-500 dark:text-gray-400"
                        )}
                      >
                        Target Reps
                      </Text>
                      <TextInput
                        value={String(item.targetReps)}
                        onChangeText={(val) =>
                          handleUpdateExercise(index, { targetReps: parseInt(val, 10) || 0 })
                        }
                        keyboardType="number-pad"
                        className={cx(
                          cleanUI,
                          "rounded-lg bg-[#1C1C1E] px-2 py-1.5 text-center text-[15px] text-white",
                          "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        )}
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className={cx(
                          cleanUI,
                          "mb-1 text-[13px] text-[#98989F]",
                          "mb-1 text-xs text-gray-500 dark:text-gray-400"
                        )}
                      >
                        Base Wt ({displayUnit})
                      </Text>
                      <TextInput
                        value={item.targetWeightDisplay}
                        onChangeText={(val) =>
                          handleUpdateExercise(index, { targetWeightDisplay: val })
                        }
                        keyboardType="decimal-pad"
                        placeholder="0"
                        className={cx(
                          cleanUI,
                          "rounded-lg bg-[#1C1C1E] px-2 py-1.5 text-center text-[15px] text-white",
                          "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        )}
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className={cx(
                          cleanUI,
                          "mb-1 text-[13px] text-[#98989F]",
                          "mb-1 text-xs text-gray-500 dark:text-gray-400"
                        )}
                      >
                        Target RPE
                      </Text>
                      <TextInput
                        value={String(item.targetRpe)}
                        onChangeText={(val) =>
                          handleUpdateExercise(index, { targetRpe: parseFloat(val) || 8 })
                        }
                        keyboardType="decimal-pad"
                        className={cx(
                          cleanUI,
                          "rounded-lg bg-[#1C1C1E] px-2 py-1.5 text-center text-[15px] text-white",
                          "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        )}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
