import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Check, Trash2, Calculator, ChevronDown, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/useAuthStore";
import { toDisplay, toCanonical } from "../lib/units";
import type { Set, Exercise } from "../db/schema";

type SetRowProps = {
  set: Set;
  exercise: Exercise;
  index: number;
  previousPerformance?: string | null;
  isAutoOverloaded?: boolean;
  onUpdate: (patch: Partial<Set>) => void;
  onComplete: (completedAt: number) => void;
  onDelete: () => void;
  onOpenPlateCalculator: (set: Set) => void;
};

const SET_TYPES = ["standard", "warmup", "drop", "failure"] as const;

export function SetRow({
  set,
  exercise,
  index,
  previousPerformance,
  isAutoOverloaded,
  onUpdate,
  onComplete,
  onDelete,
  onOpenPlateCalculator,
}: SetRowProps) {
  const { displayUnit } = useAuthStore();
  const [showRpe, setShowRpe] = useState(false);
  const isUnilateral = exercise.trackingMode === "unilateral";
  const isCompleted = !!set.completedAt;

  const handleWeightChange = (value: string, side?: "left" | "right") => {
    const num = value === "" ? null : parseFloat(value);
    const kg = num === null || isNaN(num) ? null : toCanonical(num, displayUnit);
    if (side === "left") onUpdate({ leftWeightKg: kg });
    else if (side === "right") onUpdate({ rightWeightKg: kg });
    else onUpdate({ weightKg: kg });
  };

  const handleRepsChange = (value: string, side?: "left" | "right") => {
    const num = value === "" ? null : parseInt(value, 10);
    const reps = num === null || isNaN(num) ? null : num;
    if (side === "left") onUpdate({ leftReps: reps });
    else if (side === "right") onUpdate({ rightReps: reps });
    else onUpdate({ reps });
  };

  const toggleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (isCompleted) {
      onUpdate({ completedAt: null });
    } else {
      const now = Date.now();
      onUpdate({ completedAt: now });
      onComplete(now);
      setShowRpe(true);
    }
  };

  const displayWeight = toDisplay(set.weightKg, displayUnit);
  const leftDisplay = toDisplay(set.leftWeightKg, displayUnit);
  const rightDisplay = toDisplay(set.rightWeightKg, displayUnit);

  return (
    <View
      className={`mb-3 rounded-2xl border p-3.5 ${
        isCompleted
          ? "border-lime-400/40 bg-zinc-900/90"
          : "border-zinc-800/80 bg-zinc-900"
      }`}
    >
      <View className="mb-2.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base font-black text-white font-mono">
              Set {index + 1}
            </Text>
            {isAutoOverloaded && (
              <View className="flex-row items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/20">
                <Zap size={10} color="#F59E0B" />
                <Text className="text-[10px] font-bold text-amber-400">
                  OVERLOAD
                </Text>
              </View>
            )}
          </View>

          {/* Set Type Pill */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              const idx = SET_TYPES.indexOf(set.setType);
              const next = SET_TYPES[(idx + 1) % SET_TYPES.length];
              onUpdate({ setType: next });
            }}
            className={`rounded-full px-2.5 py-0.5 border ${
              set.setType === "warmup"
                ? "bg-amber-500/20 border-amber-500/40"
                : set.setType === "drop"
                ? "bg-purple-500/20 border-purple-500/40"
                : set.setType === "failure"
                ? "bg-red-500/20 border-red-500/40"
                : "bg-zinc-800 border-zinc-700/60"
            }`}
          >
            <View className="flex-row items-center gap-1">
              <Text
                className={`text-[11px] font-mono font-bold capitalize ${
                  set.setType === "warmup"
                    ? "text-amber-400"
                    : set.setType === "drop"
                    ? "text-purple-400"
                    : set.setType === "failure"
                    ? "text-red-400"
                    : "text-zinc-300"
                }`}
              >
                {set.setType}
              </Text>
              <ChevronDown size={11} color="#71717A" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-1">
          {previousPerformance && (
            <Text className="mr-1 text-xs text-zinc-400 font-mono">
              Prev: {previousPerformance}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onOpenPlateCalculator(set);
            }}
            className="rounded-lg p-1.5"
          >
            <Calculator size={17} color="#71717A" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onDelete();
            }}
            className="rounded-lg p-1.5"
          >
            <Trash2 size={17} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {isUnilateral ? (
        <View className="mb-2 flex-row gap-3">
          <SideInputs
            label="Left"
            weight={leftDisplay != null ? String(leftDisplay) : ""}
            reps={set.leftReps != null ? String(set.leftReps) : ""}
            onWeightChange={(v) => handleWeightChange(v, "left")}
            onRepsChange={(v) => handleRepsChange(v, "left")}
            displayUnit={displayUnit}
          />
          <SideInputs
            label="Right"
            weight={rightDisplay != null ? String(rightDisplay) : ""}
            reps={set.rightReps != null ? String(set.rightReps) : ""}
            onWeightChange={(v) => handleWeightChange(v, "right")}
            onRepsChange={(v) => handleRepsChange(v, "right")}
            displayUnit={displayUnit}
          />
        </View>
      ) : (
        <View className="mb-2.5 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1 text-[11px] font-bold uppercase text-zinc-400 font-mono">
              Weight ({displayUnit})
            </Text>
            <TextInput
              value={displayWeight != null ? String(displayWeight) : ""}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-lg font-mono font-bold text-white"
              placeholder="0"
              placeholderTextColor="#52525B"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-[11px] font-bold uppercase text-zinc-400 font-mono">
              Reps
            </Text>
            <TextInput
              value={set.reps != null ? String(set.reps) : ""}
              onChangeText={handleRepsChange}
              keyboardType="number-pad"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-lg font-mono font-bold text-white"
              placeholder="0"
              placeholderTextColor="#52525B"
            />
          </View>
        </View>
      )}

      {/* RPE Selector */}
      {(isCompleted || showRpe) && (
        <View className="mb-2.5">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold text-zinc-400 uppercase font-mono">
              RPE (Rate of Perceived Exertion)
            </Text>
            {set.rpe != null && (
              <Text className="text-xs font-mono font-bold text-cyan-400">
                RPE {set.rpe}
              </Text>
            )}
          </View>
          <View className="flex-row gap-1">
            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpeVal) => (
              <TouchableOpacity
                key={rpeVal}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  onUpdate({ rpe: rpeVal });
                }}
                className={`flex-1 rounded-lg py-1.5 border ${
                  set.rpe === rpeVal
                    ? "bg-cyan-500 border-cyan-400"
                    : "bg-zinc-950 border-zinc-800"
                }`}
              >
                <Text
                  className={`text-center text-[11px] font-mono font-bold ${
                    set.rpe === rpeVal
                      ? "text-black"
                      : "text-zinc-400"
                  }`}
                >
                  {rpeVal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Completed Set Check Badge with Neon Lime */}
      <TouchableOpacity
        onPress={toggleComplete}
        activeOpacity={0.8}
        className={`flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
          isCompleted
            ? "bg-[#CCFF00] shadow-md shadow-[#CCFF00]/20"
            : "bg-zinc-800 border border-zinc-700"
        }`}
      >
        <Check size={18} color={isCompleted ? "#000000" : "#A1A1AA"} strokeWidth={3} />
        <Text
          className={`font-mono text-xs font-black uppercase tracking-wider ${
            isCompleted ? "text-black" : "text-zinc-200"
          }`}
        >
          {isCompleted ? "Completed ✓" : "Complete Set"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SideInputs({
  label,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  displayUnit,
}: {
  label: string;
  weight: string;
  reps: string;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  displayUnit: "kg" | "lb";
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-xs font-mono font-bold text-zinc-400">
        {label}
      </Text>
      <View className="flex-row gap-2">
        <TextInput
          value={weight}
          onChangeText={onWeightChange}
          keyboardType="decimal-pad"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-base font-mono font-bold text-white"
          placeholder={displayUnit}
          placeholderTextColor="#52525B"
        />
        <TextInput
          value={reps}
          onChangeText={onRepsChange}
          keyboardType="number-pad"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-base font-mono font-bold text-white"
          placeholder="reps"
          placeholderTextColor="#52525B"
        />
      </View>
    </View>
  );
}
