import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { X, Check } from "lucide-react-native";
import { createExercise } from "../db/queries";
import { useCleanUI, cx } from "../lib/theme";
import {
  findMovementGroup,
  deriveVariantLabel,
  getMovementDisplayName,
  MOVEMENT_GROUPS,
} from "../lib/exerciseVariants";
import type { Exercise } from "../db/schema";

export type QuickCreateExerciseSheetProps = {
  visible: boolean;
  /** Prefilled from the picker's search box. */
  initialName?: string;
  /** Prefilled when the name matched a movement group. */
  initialGroupKey?: string | null;
  createdBy?: string;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
};

const EQUIPMENT_OPTIONS = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bands", label: "Bands" },
  { value: "e-z curl bar", label: "EZ Bar" },
  { value: "body only", label: "Bodyweight" },
  { value: "other", label: "Other" },
];

export function QuickCreateExerciseSheet({
  visible,
  initialName = "",
  initialGroupKey = null,
  createdBy = "quick_create",
  onClose,
  onCreated,
}: QuickCreateExerciseSheetProps) {
  const cleanUI = useCleanUI();
  const [name, setName] = useState(initialName);
  const [variantLabel, setVariantLabel] = useState("");
  const [variantTouched, setVariantTouched] = useState(false);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<string | null>(initialGroupKey);
  const [groupManuallySet, setGroupManuallySet] = useState(false);
  const [pickingGroup, setPickingGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setGroupKey(initialGroupKey);
      setGroupManuallySet(initialGroupKey != null);
      setVariantLabel("");
      setVariantTouched(false);
      setEquipment(null);
      setPickingGroup(false);
      setError(null);
    }
  }, [visible, initialName, initialGroupKey]);

  // Auto-detect the movement group + variant label as the name is typed,
  // unless the user already overrode them.
  useEffect(() => {
    if (!groupManuallySet) {
      setGroupKey(findMovementGroup(name));
    }
  }, [name, groupManuallySet]);

  useEffect(() => {
    if (!variantTouched && groupKey) {
      setVariantLabel(deriveVariantLabel(name, equipment, groupKey) ?? "");
    }
  }, [name, equipment, groupKey, variantTouched]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Give the exercise a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exercise = await createExercise({
        name: name.trim(),
        equipment,
        movementGroup: groupKey,
        variantLabel: variantLabel.trim() || null,
        createdBy,
      });
      onCreated(exercise);
    } catch (err) {
      console.error("Failed to create exercise", err);
      setError("Couldn't save the exercise. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className={cx(cleanUI, "flex-1 bg-black pt-12", "flex-1 bg-white pt-12 dark:bg-gray-950")}>
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
            New Exercise
          </Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={24} color={cleanUI ? "#98989F" : "#6B7280"} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          <Text
            className={cx(
              cleanUI,
              "text-[13px] text-[#98989F] mb-1.5",
              "text-[11px] font-bold text-gray-500 uppercase mb-1.5 dark:text-gray-400"
            )}
          >
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Triceps Extension (Rope)"
            placeholderTextColor={cleanUI ? "#636366" : "#9CA3AF"}
            className={cx(
              cleanUI,
              "rounded-xl bg-[#141414] px-3.5 py-3 text-[15px] text-white mb-4",
              "rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-900 mb-4 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            )}
          />

          <Text
            className={cx(
              cleanUI,
              "text-[13px] text-[#98989F] mb-1.5",
              "text-[11px] font-bold text-gray-500 uppercase mb-1.5 dark:text-gray-400"
            )}
          >
            Movement
          </Text>
          {pickingGroup ? (
            <View className="mb-4">
              {Object.entries(MOVEMENT_GROUPS).map(([key, display]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setGroupKey(key);
                    setGroupManuallySet(true);
                    setPickingGroup(false);
                  }}
                  activeOpacity={0.7}
                  className={cx(
                    cleanUI,
                    `flex-row items-center justify-between rounded-xl px-3 py-2.5 mb-1.5 ${
                      groupKey === key ? "bg-[#0A84FF]/15" : "bg-[#141414]"
                    }`,
                    "flex-row items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 mb-1.5 dark:border-gray-700"
                  )}
                >
                  <Text
                    className={cx(
                      cleanUI,
                      `text-[15px] ${groupKey === key ? "text-white font-medium" : "text-[#E5E5EA]"}`,
                      "text-[15px] text-gray-900 dark:text-gray-100"
                    )}
                  >
                    {display}
                  </Text>
                  {groupKey === key && <Check size={16} color={cleanUI ? "#0A84FF" : "#0EA5E9"} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  setGroupKey(null);
                  setGroupManuallySet(true);
                  setPickingGroup(false);
                }}
                activeOpacity={0.7}
                className={cx(
                  cleanUI,
                  "rounded-xl bg-[#141414] px-3 py-2.5",
                  "rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                )}
              >
                <Text
                  className={cx(
                    cleanUI,
                    "text-[15px] text-[#98989F]",
                    "text-[15px] text-gray-500 dark:text-gray-400"
                  )}
                >
                  No movement (standalone exercise)
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setPickingGroup(true)}
              activeOpacity={0.7}
              className={cx(
                cleanUI,
                "rounded-xl bg-[#141414] px-3.5 py-3 mb-4",
                "rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 mb-4 dark:border-gray-700 dark:bg-gray-900"
              )}
            >
              <Text
                className={cx(
                  cleanUI,
                  `text-[15px] ${groupKey ? "text-white" : "text-[#636366]"}`,
                  "text-[15px] text-gray-900 dark:text-gray-100"
                )}
              >
                {groupKey ? getMovementDisplayName(groupKey) : "No movement — tap to set"}
              </Text>
            </TouchableOpacity>
          )}

          {groupKey != null && (
            <>
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#98989F] mb-1.5",
                  "text-[11px] font-bold text-gray-500 uppercase mb-1.5 dark:text-gray-400"
                )}
              >
                Variant
              </Text>
              <TextInput
                value={variantLabel}
                onChangeText={(t) => {
                  setVariantLabel(t);
                  setVariantTouched(true);
                }}
                placeholder="e.g. Rope"
                placeholderTextColor={cleanUI ? "#636366" : "#9CA3AF"}
                className={cx(
                  cleanUI,
                  "rounded-xl bg-[#141414] px-3.5 py-3 text-[15px] text-white mb-4",
                  "rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-900 mb-4 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                )}
              />
            </>
          )}

          <Text
            className={cx(
              cleanUI,
              "text-[13px] text-[#98989F] mb-1.5",
              "text-[11px] font-bold text-gray-500 uppercase mb-1.5 dark:text-gray-400"
            )}
          >
            Equipment
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {EQUIPMENT_OPTIONS.map((opt) => {
              const selected = equipment === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setEquipment(selected ? null : opt.value)}
                  activeOpacity={0.7}
                  className={cx(
                    cleanUI,
                    `rounded-full px-3.5 py-2 ${selected ? "bg-[#0A84FF]" : "bg-[#141414]"}`,
                    `rounded-full border px-3.5 py-2 ${
                      selected ? "border-sky-500 bg-sky-500/15" : "border-gray-200 dark:border-gray-700"
                    }`
                  )}
                >
                  <Text
                    className={cx(
                      cleanUI,
                      `text-[13px] ${selected ? "text-white font-semibold" : "text-[#E5E5EA]"}`,
                      `text-[13px] ${selected ? "text-sky-500 font-semibold" : "text-gray-700 dark:text-gray-300"}`
                    )}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error && (
            <Text className="text-[13px] text-[#FF453A] mb-3">{error}</Text>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            className={cx(
              cleanUI,
              "rounded-xl bg-[#0A84FF] py-3.5 items-center mb-8 disabled:opacity-50",
              "rounded-xl bg-sky-500 py-3.5 items-center mb-8 disabled:opacity-50"
            )}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-semibold text-white">
                {groupKey && variantLabel.trim()
                  ? `Create ${getMovementDisplayName(groupKey)} · ${variantLabel.trim()}`
                  : "Create Exercise"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
