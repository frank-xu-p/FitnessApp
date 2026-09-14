import { useState } from "react";
import { View, Text, Modal, TouchableOpacity, Switch, TextInput } from "react-native";
import { Zap, X, Check, HelpCircle } from "lucide-react-native";
import type { ProgressionModel, CadenceRate } from "../lib/progression";
import { useAuthStore } from "../store/useAuthStore";
import { kgToLb, lbToKg } from "../lib/units";

type OverloadCadenceModalProps = {
  visible: boolean;
  onClose: () => void;
  autoOverloadEnabled: boolean;
  cadenceModel: ProgressionModel;
  cadenceRate: CadenceRate;
  cadenceIncrementKg: number | null;
  onSave: (config: {
    autoOverloadEnabled: boolean;
    cadenceModel: ProgressionModel;
    cadenceRate: CadenceRate;
    cadenceIncrementKg: number | null;
  }) => void;
};

export function OverloadCadenceModal({
  visible,
  onClose,
  autoOverloadEnabled,
  cadenceModel,
  cadenceRate,
  cadenceIncrementKg,
  onSave,
}: OverloadCadenceModalProps) {
  const { displayUnit } = useAuthStore();
  const [enabled, setEnabled] = useState(autoOverloadEnabled);
  const [model, setModel] = useState<ProgressionModel>(cadenceModel);
  const [rate, setRate] = useState<CadenceRate>(cadenceRate);
  const [incrementDisplay, setIncrementDisplay] = useState(
    displayUnit === "lb"
      ? String(kgToLb(cadenceIncrementKg ?? 2.5).toFixed(1))
      : String(cadenceIncrementKg ?? 2.5)
  );

  const handleApply = () => {
    const num = parseFloat(incrementDisplay);
    const incKg = isNaN(num) ? 2.5 : displayUnit === "lb" ? lbToKg(num) : num;
    onSave({
      autoOverloadEnabled: enabled,
      cadenceModel: model,
      cadenceRate: rate,
      cadenceIncrementKg: incKg,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-3xl bg-white p-6 dark:bg-gray-900">
          <View className="mb-4 flex-row items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <View className="flex-row items-center gap-2">
              <Zap size={22} color="#EAB308" />
              <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Auto Progressive Overload
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="rounded-full p-1">
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Main Toggle */}
          <View className="mb-5 flex-row items-center justify-between rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
            <View className="flex-1 pr-4">
              <Text className="text-base font-semibold text-amber-900 dark:text-amber-200">
                Auto Progressive Overload Mode
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300">
                Automatically calculates weight increases for each set based on past performance and RPE.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
              thumbColor={enabled ? "#FFFFFF" : "#F3F4F6"}
            />
          </View>

          {enabled && (
            <View className="space-y-4">
              {/* Progression Model */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Progression Model
                </Text>
                <View className="space-y-2">
                  <TouchableOpacity
                    onPress={() => setModel("double_progression")}
                    className={`rounded-xl border p-3 ${
                      model === "double_progression"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-semibold text-gray-900 dark:text-gray-100">
                        Double Progression (Recommended)
                      </Text>
                      {model === "double_progression" && <Check size={18} color="#D97706" />}
                    </View>
                    <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Progress reps first within a range (e.g. 8–12). When top reps are hit with good RPE, weight increases and reps reset.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setModel("rpe_autoregulated")}
                    className={`mt-2 rounded-xl border p-3 ${
                      model === "rpe_autoregulated"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-semibold text-gray-900 dark:text-gray-100">
                        RPE Autoregulation
                      </Text>
                      {model === "rpe_autoregulated" && <Check size={18} color="#D97706" />}
                    </View>
                    <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Dynamically scales jumps based on effort: accelerates when easy (RPE ≤ 7), holds when near failure (RPE 9.5+).
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setModel("linear")}
                    className={`mt-2 rounded-xl border p-3 ${
                      model === "linear"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-semibold text-gray-900 dark:text-gray-100">
                        Linear Progression
                      </Text>
                      {model === "linear" && <Check size={18} color="#D97706" />}
                    </View>
                    <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Increases by a steady fixed increment on every scheduled cadence session.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cadence Rate */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Progression Cadence
                </Text>
                <View className="flex-row gap-2">
                  {(
                    [
                      { key: "session", label: "Every Session" },
                      { key: "weekly", label: "Weekly" },
                      { key: "biweekly", label: "Bi-Weekly" },
                    ] as const
                  ).map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setRate(item.key)}
                      className={`flex-1 rounded-xl py-2.5 px-2 items-center border ${
                        rate === item.key
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50"
                          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          rate === item.key
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Default Step Increment */}
              <View className="mb-6">
                <Text className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Weight Increment ({displayUnit})
                </Text>
                <TextInput
                  value={incrementDisplay}
                  onChangeText={setIncrementDisplay}
                  keyboardType="decimal-pad"
                  className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="2.5"
                />
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3 pt-2">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-3.5 items-center dark:border-gray-700"
            >
              <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              className="flex-1 rounded-xl bg-primary py-3.5 items-center"
            >
              <Text className="font-semibold text-white">Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
