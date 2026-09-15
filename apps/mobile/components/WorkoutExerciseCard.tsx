import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import {
  Link2,
  MoreHorizontal,
  Check,
  Zap,
  Trash2,
  Calculator,
  RefreshCw,
  ArrowUpDown,
  Split,
  Layers,
} from "lucide-react-native";

import { useAuthStore } from "../store/useAuthStore";
import { useWorkoutStore } from "../store/useWorkoutStore";
import {
  createSet,
  updateSet,
  deleteSet,
  getExerciseHistory,
  updateExerciseTrackingMode,
} from "../db/queries";
import { toDisplay, toCanonical, formatWeight } from "../lib/units";
import {
  effectiveWeightKg,
  effectiveReps,
  isUnilateralSet,
  hasRequiredDataForCompletion,
} from "../lib/unilateral";
import {
  suggestNextSetWeight,
  computeProgressionSuggestion,
  defaultEquipmentIncrement,
} from "../lib/progression";
import { SetTypeModal, SET_TYPE_CONFIG, type SetType } from "./SetTypeModal";
import { PlateCalculatorModal } from "./PlateCalculatorModal";
import type { Set as WorkoutSet, Exercise } from "../db/schema";

function SetNumberInput({
  initialValue,
  placeholder,
  keyboardType = "decimal-pad",
  className,
  onCommit,
}: {
  initialValue: number | null | undefined;
  placeholder?: string;
  keyboardType?: "decimal-pad" | "number-pad";
  className?: string;
  onCommit: (val: number | null) => void;
}) {
  const [text, setText] = useState(
    initialValue != null ? String(initialValue) : ""
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setText(initialValue != null ? String(initialValue) : "");
    }
  }, [initialValue]);

  const handleChangeText = (newText: string) => {
    const cleaned =
      keyboardType === "number-pad"
        ? newText.replace(/[^0-9]/g, "")
        : newText.replace(/[^0-9.]/g, "");
    setText(cleaned);

    const num = cleaned === "" ? null : parseFloat(cleaned);
    const validNum = num !== null && !isNaN(num) ? num : null;
    onCommit(validNum);
  };

  return (
    <TextInput
      value={text}
      onChangeText={handleChangeText}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={() => {
        isFocused.current = false;
        const num = text === "" ? null : parseFloat(text);
        const validNum = num !== null && !isNaN(num) ? num : null;
        onCommit(validNum);
      }}
      keyboardType={keyboardType}
      placeholder={placeholder ?? "0"}
      placeholderTextColor="#64748B"
      textAlign="center"
      textAlignVertical="center"
      multiline={false}
      scrollEnabled={false}
      numberOfLines={1}
      selectTextOnFocus
      style={{
        textAlign: "center",
        textAlignVertical: "center",
        includeFontPadding: false,
        paddingVertical: 0,
      }}
      className={className}
    />
  );
}


type WorkoutExerciseCardProps = {
  workoutId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  onSetsChange: () => void;
  onRemoveExercise: () => void;
  onReplaceExercise?: () => void;
  onTriggerRestTimer: (seconds: number) => void;
  defaultRestSeconds?: number;
  /** When true the card renders completed history: no add/toggle/edit. */
  readOnly?: boolean;
};

export function WorkoutExerciseCard({
  workoutId,
  exercise,
  sets,
  onSetsChange,
  onRemoveExercise,
  onReplaceExercise,
  onTriggerRestTimer,
  defaultRestSeconds = 120,
  readOnly = false,
}: WorkoutExerciseCardProps) {
  const { displayUnit } = useAuthStore();
  const { autoOverloadEnabled, cadenceModel, cadenceRate, cadenceIncrementKg } =
    useWorkoutStore();

  const [isIsolateral, setIsIsolateral] = useState(
    exercise.trackingMode === "unilateral"
  );

  // Toggle isolateral mode — persisted to the exercise row so per-side
  // inputs stay reachable across remounts and app restarts (B2).
  const handleToggleIsolateral = useCallback(async () => {
    const next = !isIsolateral;
    setIsIsolateral(next);
    setShowOptionsMenu(false);
    try {
      await updateExerciseTrackingMode(
        exercise.id,
        next ? "unilateral" : "bilateral"
      );
    } catch (err) {
      console.error("Failed to persist tracking mode", err);
    }
  }, [isIsolateral, exercise.id]);
  const [activeTypeSet, setActiveTypeSet] = useState<WorkoutSet | null>(null);
  const [plateSet, setPlateSet] = useState<WorkoutSet | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [prevPerformanceMap, setPrevPerformanceMap] = useState<
    Record<number, string>
  >({});
  const [restSecondsPerSet, setRestSecondsPerSet] = useState<
    Record<string, number>
  >({});

  // Load previous performance history for this exercise
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const history = await getExerciseHistory(exercise.id, 1, workoutId);

        if (mounted && history.length > 0 && history[0].sets.length > 0) {
          const map: Record<number, string> = {};
          history[0].sets.forEach((s) => {
            const dispW = toDisplay(effectiveWeightKg(s), displayUnit);
            const r = effectiveReps(s);
            const tag =
              s.setType === "drop"
                ? " [D]"
                : s.setType === "failure"
                ? " [F]"
                : s.setType === "warmup"
                ? " [W]"
                : "";
            // Unilateral sets show the effective per-side weight, flagged L/R
            const sideTag = isUnilateralSet(s) ? " L/R" : "";
            if (dispW != null) {
              map[s.setNumber] = `${dispW} ${displayUnit} × ${r ?? 0}${sideTag}${tag}`;
            } else if (r != null) {
              map[s.setNumber] = `/ × ${r}${sideTag}${tag}`;
            } else {
              map[s.setNumber] = "/";
            }
          });
          setPrevPerformanceMap(map);
        }

      } catch (err) {
        console.error("Failed to load exercise history", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [exercise.id, displayUnit]);

  // Format rest time in m:ss or s
  const formatRest = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) {
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return `0:${s.toString().padStart(2, "0")}`;
  };

  // Add a new set
  const handleAddSet = async () => {
    const nextNumber = sets.length + 1;
    const lastSet = sets[sets.length - 1];

    let nextWeightKg = lastSet?.weightKg ?? null;
    // New sets are provisional — reps stay blank until the user enters them
    let nextReps = lastSet?.reps ?? null;

    // Apply auto progressive overload suggestion if enabled
    if (autoOverloadEnabled && sets.length > 0) {
      const suggested = suggestNextSetWeight(
        sets,
        {
          targetReps: 8,
          incrementKg:
            cadenceIncrementKg ??
            defaultEquipmentIncrement(exercise.equipment, displayUnit),
          model: cadenceModel,
          cadenceRate,
        },
        displayUnit
      );
      if (suggested !== null) {
        nextWeightKg = suggested;
      }
    }

    const restSec = lastSet?.restSeconds ?? defaultRestSeconds;

    const defaults = {
      weightKg: nextWeightKg,
      reps: nextReps,
      leftWeightKg: lastSet?.leftWeightKg ?? null,
      leftReps: lastSet?.leftReps ?? null,
      rightWeightKg: lastSet?.rightWeightKg ?? null,
      rightReps: lastSet?.rightReps ?? null,
      setType: "standard" as const,
      restSeconds: restSec,
    };

    await createSet(workoutId, exercise.id, nextNumber, defaults);
    onSetsChange();
  };

  // Update set
  const handleUpdateSet = async (
    setId: string,
    patch: Partial<WorkoutSet>
  ) => {
    await updateSet(setId, patch);
    onSetsChange();
  };

  // Toggle complete set — H4: a set can only be marked complete when it
  // actually has the required data for the exercise's tracking mode.
  const handleToggleComplete = async (set: WorkoutSet) => {
    const isCompleted = !!set.completedAt;
    const now = Date.now();
    if (isCompleted) {
      await updateSet(set.id, { completedAt: null });
    } else {
      const mode = isIsolateral ? "unilateral" : "bilateral";
      if (!hasRequiredDataForCompletion(set, mode)) {
        Alert.alert(
          "Incomplete set",
          mode === "unilateral"
            ? "Enter weight and reps for both sides before completing this set."
            : "Enter weight and reps before completing this set."
        );
        return;
      }
      await updateSet(set.id, { completedAt: now });
      const restSec = set.restSeconds ?? defaultRestSeconds;
      onTriggerRestTimer(restSec);
    }
    onSetsChange();
  };

  // Delete set
  const handleDeleteSet = async (setId: string) => {
    await deleteSet(setId);
    onSetsChange();
  };

  // Change weight input
  const handleWeightChange = (
    set: WorkoutSet,
    text: string,
    side?: "left" | "right"
  ) => {
    const num = text === "" ? null : parseFloat(text);
    const kg = num === null || isNaN(num) ? null : toCanonical(num, displayUnit);
    if (side === "left") handleUpdateSet(set.id, { leftWeightKg: kg });
    else if (side === "right") handleUpdateSet(set.id, { rightWeightKg: kg });
    else handleUpdateSet(set.id, { weightKg: kg });
  };

  // Change reps input
  const handleRepsChange = (
    set: WorkoutSet,
    text: string,
    side?: "left" | "right"
  ) => {
    const num = text === "" ? null : parseInt(text, 10);
    const reps = num === null || isNaN(num) ? null : num;
    if (side === "left") handleUpdateSet(set.id, { leftReps: reps });
    else if (side === "right") handleUpdateSet(set.id, { rightReps: reps });
    else handleUpdateSet(set.id, { reps });
  };

  // Pre-fill from previous performance
  const handlePrefillPrevious = (set: WorkoutSet) => {
    const prevStr = prevPerformanceMap[set.setNumber];
    if (!prevStr) return;
    const match = prevStr.match(/^([\d.]+)\s*(?:kg|lb)?\s*×\s*(\d+)/i);
    if (match) {
      const w = parseFloat(match[1]);
      const r = parseInt(match[2], 10);
      const kg = toCanonical(w, displayUnit);
      handleUpdateSet(set.id, {
        weightKg: kg,
        reps: r,
        leftWeightKg: isIsolateral ? kg : null,
        leftReps: isIsolateral ? r : null,
        rightWeightKg: isIsolateral ? kg : null,
        rightReps: isIsolateral ? r : null,
      });
    }
  };

  return (
    <View className="mb-6 rounded-3xl border border-gray-800 bg-gray-900/90 p-4 shadow-lg">
      {/* Exercise Title Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-black text-sky-400 tracking-wide">
            {exercise.name}
          </Text>
          {isIsolateral && (
            <Text className="text-[10px] font-bold text-amber-400 uppercase">
              Isolateral (Left / Right)
            </Text>
          )}
        </View>

        {/* Action icons */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Superset", "Link this exercise into a superset with the next movement.");
            }}
            className="rounded-full bg-gray-800 p-2"
          >
            <Link2 size={16} color="#38BDF8" />
          </TouchableOpacity>

          {!readOnly && (
          <TouchableOpacity
            onPress={() => setShowOptionsMenu(true)}
            className="rounded-full bg-gray-800 p-2"
          >
            <MoreHorizontal size={16} color="#38BDF8" />
          </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Table Column Headers */}
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="w-9 text-center text-[11px] font-black uppercase text-gray-400">
          SET
        </Text>
        <Text className="flex-1 text-center text-[11px] font-black uppercase text-gray-400">
          PREVIOUS
        </Text>
        <Text className="w-20 text-center text-[11px] font-black uppercase text-gray-400">
          {displayUnit.toUpperCase()}
        </Text>
        <Text className="w-16 text-center text-[11px] font-black uppercase text-gray-400">
          REPS
        </Text>
        <Text className="w-9 text-center text-[11px] font-black uppercase text-gray-400">
          ✓
        </Text>
      </View>

      {/* Set Rows — pointer events disabled in read-only mode (H11) */}
      <View pointerEvents={readOnly ? "none" : "auto"}>
      {sets.map((set, index) => {
        const isCompleted = !!set.completedAt;
        const setType = (set.setType ?? "standard") as SetType;
        const typeCfg = SET_TYPE_CONFIG[setType] || SET_TYPE_CONFIG.standard;
        const prevText = prevPerformanceMap[set.setNumber] || "/";
        const dispWeight = toDisplay(set.weightKg, displayUnit);
        const leftDispWeight = toDisplay(set.leftWeightKg, displayUnit);
        const rightDispWeight = toDisplay(set.rightWeightKg, displayUnit);
        const restSec = set.restSeconds ?? defaultRestSeconds;

        return (
          <View key={set.id}>
            {/* Main Set Row */}
            <View
              className={`mb-2 flex-row items-center justify-between rounded-2xl p-1.5 ${
                isCompleted ? "bg-emerald-950/20 border border-emerald-800/40" : ""
              }`}
            >
              {/* Column 1: SET Type Badge */}
              <TouchableOpacity
                onPress={() => setActiveTypeSet(set)}
                className="h-9 w-9 items-center justify-center rounded-xl font-bold"
                style={{
                  backgroundColor:
                    setType === "standard" ? "transparent" : typeCfg.color,
                }}
              >
                <Text
                  className="text-sm font-black"
                  style={{
                    color: setType === "standard" ? "#E2E8F0" : "#FFFFFF",
                  }}
                >
                  {setType === "standard" ? index + 1 : typeCfg.badge}
                </Text>
              </TouchableOpacity>

              {/* Column 2: PREVIOUS Performance */}
              <TouchableOpacity
                onPress={() => handlePrefillPrevious(set)}
                className="flex-1 items-center justify-center px-1"
              >
                <Text
                  className="text-xs font-semibold text-gray-400 text-center"
                  numberOfLines={1}
                >
                  {prevText}
                </Text>
              </TouchableOpacity>

              {/* Column 3 & 4: Inputs (Standard or Isolateral) */}
              {!isIsolateral ? (
                <View className="flex-row items-center gap-2">
                  {/* Weight Input */}
                  <View className="w-20">
                    <SetNumberInput
                      initialValue={dispWeight}
                      onCommit={(val) => {
                        const kg = val !== null ? toCanonical(val, displayUnit) : null;
                        handleUpdateSet(set.id, { weightKg: kg });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      className="h-10 rounded-xl bg-gray-800 px-1 text-center text-base font-bold text-white border border-gray-700 items-center justify-center"
                    />
                  </View>

                  {/* Reps Input */}
                  <View className="w-16">
                    <SetNumberInput
                      initialValue={set.reps}
                      onCommit={(val) => {
                        handleUpdateSet(set.id, { reps: val });
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                      className="h-10 rounded-xl bg-gray-800 px-1 text-center text-base font-bold text-white border border-gray-700 items-center justify-center"
                    />
                  </View>
                </View>
              ) : (
                /* Isolateral Dual Inputs */
                <View className="flex-row items-center gap-1.5">
                  <View className="w-20">
                    <SetNumberInput
                      initialValue={leftDispWeight ?? dispWeight}
                      onCommit={(val) => {
                        const kg = val !== null ? toCanonical(val, displayUnit) : null;
                        handleUpdateSet(set.id, { leftWeightKg: kg });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="L: 0"
                      className="h-9 rounded-xl bg-gray-800 px-1 text-center text-xs font-bold text-white border border-gray-700 items-center justify-center"
                    />
                  </View>
                  <View className="w-16">
                    <SetNumberInput
                      initialValue={set.leftReps ?? set.reps}
                      onCommit={(val) => {
                        handleUpdateSet(set.id, { leftReps: val });
                      }}
                      keyboardType="number-pad"
                      placeholder="L: 0"
                      className="h-9 rounded-xl bg-gray-800 px-1 text-center text-xs font-bold text-white border border-gray-700 items-center justify-center"
                    />
                  </View>
                </View>
              )}

              {/* Column 5: Checkmark Completion Toggle */}
              <TouchableOpacity
                onPress={() => handleToggleComplete(set)}
                className={`ml-2 h-9 w-9 items-center justify-center rounded-xl border ${
                  isCompleted
                    ? "bg-[#CCFF00] border-[#CCFF00]"
                    : "bg-zinc-800/80 border-zinc-700"
                }`}
              >
                <Check
                  size={18}
                  color={isCompleted ? "#000000" : "#71717A"}
                  strokeWidth={3}
                />
              </TouchableOpacity>
            </View>

            {/* Isolateral Right Side Row if applicable */}
            {isIsolateral && (
              <View className="mb-2 flex-row items-center justify-end pr-11 gap-1.5">
                <View className="w-20">
                  <SetNumberInput
                    initialValue={rightDispWeight ?? dispWeight}
                    onCommit={(val) => {
                      const kg = val !== null ? toCanonical(val, displayUnit) : null;
                      handleUpdateSet(set.id, { rightWeightKg: kg });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="R: 0"
                    className="h-9 rounded-xl bg-gray-800 px-1 text-center text-xs font-bold text-white border border-gray-700 items-center justify-center"
                  />
                </View>
                <View className="w-16">
                  <SetNumberInput
                    initialValue={set.rightReps ?? set.reps}
                    onCommit={(val) => {
                      handleUpdateSet(set.id, { rightReps: val });
                    }}
                    keyboardType="number-pad"
                    placeholder="R: 0"
                    className="h-9 rounded-xl bg-gray-800 px-1 text-center text-xs font-bold text-white border border-gray-700 items-center justify-center"
                  />
                </View>
              </View>
            )}


            {/* Inline Proximity to Failure (RIR) Rating */}
            {isCompleted && (
              <View className="mb-2 mt-0.5 rounded-xl bg-gray-950/70 px-2.5 py-1.5 border border-gray-800/80">

                <View className="mb-1 flex-row items-center justify-between px-0.5">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    How close to failure?
                  </Text>
                  {set.rir !== null && set.rir !== undefined ? (
                    <Text className="text-[10px] font-black text-sky-400">
                      {set.rir === 0 ? "🔥 0 RIR (Failure)" : `${set.rir} Reps in Reserve`}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row gap-1">
                  {[
                    { rir: 0, rpe: 10, label: "0 (Failure)", color: "#EF4444" },
                    { rir: 1, rpe: 9, label: "1 RIR", color: "#F97316" },
                    { rir: 2, rpe: 8, label: "2 RIR", color: "#F59E0B" },
                    { rir: 3, rpe: 7, label: "3 RIR", color: "#3B82F6" },
                    { rir: 4, rpe: 6, label: "4+ RIR", color: "#64748B" },
                  ].map((option) => {
                    const isSelected = set.rir === option.rir;
                    return (
                      <TouchableOpacity
                        key={option.rir}
                        onPress={() =>
                          handleUpdateSet(set.id, {
                            rir: isSelected ? null : option.rir,
                            rpe: isSelected ? null : option.rpe,
                          })
                        }
                        className="flex-1 items-center justify-center rounded-lg py-1 border"
                        style={{
                          backgroundColor: isSelected ? `${option.color}33` : "#1F2937",
                          borderColor: isSelected ? option.color : "#374151",
                        }}
                      >
                        <Text
                          className="text-[10px] font-black"
                          style={{
                            color: isSelected ? option.color : "#9CA3AF",
                          }}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Inter-set Rest Duration Divider */}

            {index < sets.length - 1 && (
              <View className="my-1.5 flex-row items-center justify-center">
                <View className="h-[1px] flex-1 bg-gray-800" />
                <TouchableOpacity
                  onPress={() => {
                    const options = [60, 90, 120, 180, 240];
                    const nextRest =
                      options[(options.indexOf(restSec) + 1) % options.length] || 120;
                    handleUpdateSet(set.id, { restSeconds: nextRest });
                  }}
                  className="px-3"
                >
                  <Text className="text-xs font-bold text-sky-400 font-mono">
                    {formatRest(restSec)}
                  </Text>
                </TouchableOpacity>
                <View className="h-[1px] flex-1 bg-gray-800" />
              </View>
            )}
          </View>
        );
      })}
      </View>

      {/* Add Set Button */}
      {!readOnly && (
      <View className="mt-3 items-center">
        <TouchableOpacity
          onPress={handleAddSet}
          className="py-2 px-4 rounded-xl"
        >
          <Text className="text-sm font-black text-sky-400 tracking-wider uppercase">
            ADD SET ({formatRest(defaultRestSeconds)})
          </Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Set Type Picker Modal */}
      {activeTypeSet && (
        <SetTypeModal
          visible={!!activeTypeSet}
          currentType={(activeTypeSet.setType ?? "standard") as SetType}
          setNumber={activeTypeSet.setNumber}
          onSelect={(type) => {
            handleUpdateSet(activeTypeSet.id, { setType: type as any });
            setActiveTypeSet(null);
          }}
          onClose={() => setActiveTypeSet(null)}
        />
      )}

      {/* Plate Calculator Modal */}
      {plateSet && (
        <PlateCalculatorModal
          visible={!!plateSet}
          targetWeightKg={plateSet.weightKg ?? 60}
          onApply={(weightKg, setType) => {
            handleUpdateSet(plateSet.id, { weightKg, setType });
            setPlateSet(null);
          }}
          onClose={() => setPlateSet(null)}
        />
      )}


      {/* Exercise Options More Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
          className="flex-1 items-center justify-center bg-black/70 p-4"
        >
          <View className="w-full max-w-sm rounded-3xl bg-gray-900 p-5 border border-gray-800">
            <Text className="mb-4 text-base font-black text-white">
              {exercise.name} Options
            </Text>

            {/* Toggle Isolateral Mode */}
            <TouchableOpacity
              onPress={handleToggleIsolateral}
              className="flex-row items-center gap-3 py-3 border-b border-gray-800"
            >
              <Split size={18} color="#38BDF8" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">
                  {isIsolateral ? "Disable Isolateral Mode" : "Enable Isolateral (L / R) Mode"}
                </Text>
                <Text className="text-xs text-gray-400">
                  Track independent left and right side weights and reps
                </Text>
              </View>
            </TouchableOpacity>


            {/* Plate Calculator */}
            <TouchableOpacity
              onPress={() => {
                setShowOptionsMenu(false);
                if (sets.length > 0) setPlateSet(sets[0]);
              }}
              className="flex-row items-center gap-3 py-3 border-b border-gray-800"
            >
              <Calculator size={18} color="#38BDF8" />
              <Text className="text-sm font-bold text-white">
                Plate Calculator
              </Text>
            </TouchableOpacity>

            {/* Replace Exercise */}
            {onReplaceExercise && (
              <TouchableOpacity
                onPress={() => {
                  setShowOptionsMenu(false);
                  onReplaceExercise();
                }}
                className="flex-row items-center gap-3 py-3 border-b border-gray-800"
              >
                <RefreshCw size={18} color="#38BDF8" />
                <Text className="text-sm font-bold text-white">
                  Replace Exercise
                </Text>
              </TouchableOpacity>
            )}

            {/* Delete Exercise */}
            <TouchableOpacity
              onPress={() => {
                setShowOptionsMenu(false);
                Alert.alert(
                  "Remove Exercise",
                  `Are you sure you want to remove "${exercise.name}" from this workout?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: onRemoveExercise,
                    },
                  ]
                );
              }}
              className="flex-row items-center gap-3 py-3"
            >
              <Trash2 size={18} color="#EF4444" />
              <Text className="text-sm font-bold text-red-400">
                Remove Exercise from Session
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
