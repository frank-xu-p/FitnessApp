import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { X, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react-native";
import { toDisplay, toCanonical } from "../lib/units";
import {
  calculatePlatesPerSide,
  formatPlateCounts,
  recommendDropSetWeight,
  sortInventory,
} from "../lib/plates";
import { useAuthStore } from "../store/useAuthStore";
import type { WeightUnit } from "../lib/units";

type PlateCalculatorModalProps = {
  visible: boolean;
  targetWeightKg: number;
  onClose: () => void;
  onApply: (weightKg: number, setType: "drop" | "standard") => void;
};

export function PlateCalculatorModal({
  visible,
  targetWeightKg,
  onClose,
  onApply,
}: PlateCalculatorModalProps) {
  const {
    displayUnit,
    barByUnit,
    inventoryByUnit,
    setBarWeight,
    addPlate,
    updatePlate,
    removePlate,
  } = useAuthStore();

  const [displayWeight, setDisplayWeight] = useState("0");
  const [barInput, setBarInput] = useState("0");
  const [showInventory, setShowInventory] = useState(false);

  const inventory = inventoryByUnit[displayUnit];
  const barWeight = barByUnit[displayUnit];

  useEffect(() => {
    if (!visible) return;
    const target = toDisplay(targetWeightKg, displayUnit) ?? 0;
    setDisplayWeight(String(roundForUnit(target, displayUnit)));
    setBarInput(String(barWeight));
  }, [visible, targetWeightKg, displayUnit, barWeight]);

  const targetValue = parseFloat(displayWeight) || 0;
  const barValue = parseFloat(barInput) || 0;

  const result = useMemo(
    () => calculatePlatesPerSide(targetValue, barValue, inventory),
    [targetValue, barValue, inventory]
  );

  const dropRecommendation = useMemo(
    () => recommendDropSetWeight(targetValue),
    [targetValue]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-3xl bg-white p-4 dark:bg-gray-900">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Plate Calculator
            </Text>
            <TouchableOpacity onPress={onClose} className="rounded-full p-2">
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1">
            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                  Target ({displayUnit})
                </Text>
                <TextInput
                  value={displayWeight}
                  onChangeText={setDisplayWeight}
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                  Bar ({displayUnit})
                </Text>
                <TextInput
                  value={barInput}
                  onChangeText={(value) => {
                    setBarInput(value);
                    const parsed = parseFloat(value);
                    if (!Number.isNaN(parsed)) setBarWeight(parsed);
                  }}
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </View>
            </View>

            <View className="mb-4 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Per side</Text>
              <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {roundForUnit(result.perSide, displayUnit)} {displayUnit}
              </Text>
              <Text className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                Plates: {formatPlateCounts(result.plates, displayUnit)}
              </Text>
              {result.error ? (
                <Text className="mt-2 text-sm text-red-600 dark:text-red-400">{result.error}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setShowInventory(!showInventory)}
              className="mb-4 flex-row items-center justify-between rounded-xl bg-gray-100 p-3 dark:bg-gray-800"
            >
              <Text className="font-medium text-gray-900 dark:text-gray-100">Plate inventory</Text>
              {showInventory ? (
                <ChevronUp size={20} color="#6B7280" />
              ) : (
                <ChevronDown size={20} color="#6B7280" />
              )}
            </TouchableOpacity>

            {showInventory && (
              <View className="mb-4">
                {sortInventory(inventory).map((plate) => (
                  <View key={plate.id} className="mb-2 flex-row items-center gap-2">
                    <TextInput
                      value={String(plate.weight)}
                      onChangeText={(value) =>
                        updatePlate(plate.id, { weight: parseFloat(value) || 0 })
                      }
                      keyboardType="decimal-pad"
                      className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <TextInput
                      value={String(plate.count)}
                      onChangeText={(value) =>
                        updatePlate(plate.id, { count: Math.max(0, parseInt(value, 10) || 0) })
                      }
                      keyboardType="number-pad"
                      className="w-16 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{displayUnit}</Text>
                    <TouchableOpacity
                      onPress={() => removePlate(plate.id)}
                      className="rounded-lg bg-red-100 p-2 dark:bg-red-900"
                    >
                      <Minus size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => addPlate()}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-gray-200 py-2 dark:bg-gray-700"
                >
                  <Plus size={18} color="#6B7280" />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Add plate</Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <Text className="text-sm text-purple-700 dark:text-purple-300">
                Drop-set recommendation: {roundForUnit(dropRecommendation, displayUnit)}{" "}
                {displayUnit} (17.5% less)
              </Text>
            </View>
          </ScrollView>

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                const kg = toCanonical(dropRecommendation, displayUnit) ?? 0;
                onApply(kg, "drop");
              }}
              className="flex-1 rounded-xl bg-purple-600 py-3"
            >
              <Text className="text-center font-semibold text-white">Apply Drop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const kg = toCanonical(targetValue, displayUnit) ?? 0;
                onApply(kg, "standard");
              }}
              className="flex-1 rounded-xl bg-primary py-3"
            >
              <Text className="text-center font-semibold text-white">Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function roundForUnit(value: number, unit: WeightUnit): number {
  const digits = unit === "lb" ? 1 : 2;
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
