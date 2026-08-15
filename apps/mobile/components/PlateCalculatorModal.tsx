import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { X, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react-native";
import { toDisplay, toCanonical, kgToLb, lbToKg } from "../lib/units";
import { calculatePlatesPerSide, recommendDropSetWeight } from "../lib/plates";
import type { WeightUnit } from "../lib/units";

type PlateCalculatorModalProps = {
  visible: boolean;
  targetWeightKg: number;
  barWeightKg: number;
  availablePlates: number[];
  displayUnit: WeightUnit;
  onClose: () => void;
  onApply: (weightKg: number, setType: "drop" | "standard") => void;
};

export function PlateCalculatorModal({
  visible,
  targetWeightKg,
  barWeightKg,
  availablePlates,
  displayUnit,
  onClose,
  onApply,
}: PlateCalculatorModalProps) {
  const [displayWeight, setDisplayWeight] = useState(toDisplay(targetWeightKg, displayUnit) ?? 0);
  const [barDisplay, setBarDisplay] = useState(toDisplay(barWeightKg, displayUnit) ?? 0);
  const [plates, setPlates] = useState<number[]>(availablePlates);
  const [showInventory, setShowInventory] = useState(false);

  const targetKg = useMemo(
    () => toCanonical(displayWeight, displayUnit) ?? 0,
    [displayWeight, displayUnit]
  );
  const barKg = useMemo(
    () => toCanonical(barDisplay, displayUnit) ?? 0,
    [barDisplay, displayUnit]
  );

  const result = useMemo(
    () => calculatePlatesPerSide(targetKg, barKg, plates),
    [targetKg, barKg, plates]
  );

  const dropRecommendation = useMemo(() => recommendDropSetWeight(targetKg), [targetKg]);
  const dropDisplay = toDisplay(dropRecommendation, displayUnit) ?? 0;

  const addPlate = () => {
    const step = displayUnit === "lb" ? 5 : 1.25;
    const max = plates.length > 0 ? Math.max(...plates) : 0;
    setPlates([...plates, max + step]);
  };

  const removePlate = (index: number) => {
    const next = [...plates];
    next.splice(index, 1);
    setPlates(next);
  };

  const updatePlate = (index: number, value: number) => {
    const next = [...plates];
    next[index] = value;
    setPlates(next);
  };

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
                  value={String(displayWeight)}
                  onChangeText={(v) => setDisplayWeight(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                  Bar ({displayUnit})
                </Text>
                <TextInput
                  value={String(barDisplay)}
                  onChangeText={(v) => setBarDisplay(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </View>
            </View>

            <View className="mb-4 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
              <Text className="text-sm text-gray-500 dark:text-gray-400">Per side</Text>
              <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {toDisplay(result?.perSideKg ?? 0, displayUnit)?.toFixed(displayUnit === "lb" ? 0 : 1) ?? 0}{" "}
                {displayUnit}
              </Text>
              <Text className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                Plates: {result && result.plates.length > 0
                  ? result.plates.map((p) => `${displayUnit === "lb" ? Math.round(kgToLb(p) * 10) / 10 : p} ${displayUnit}`).join(" + ")
                  : "Bar only"}
              </Text>
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
                {plates
                  .sort((a, b) => b - a)
                  .map((plate, index) => (
                    <View
                      key={index}
                      className="mb-2 flex-row items-center gap-2"
                    >
                      <TextInput
                        value={String(
                          displayUnit === "lb" ? Math.round(kgToLb(plate) * 10) / 10 : plate
                        )}
                        onChangeText={(v) =>
                          updatePlate(
                            index,
                            displayUnit === "lb" ? lbToKg(parseFloat(v) || 0) : parseFloat(v) || 0
                          )
                        }
                        keyboardType="decimal-pad"
                        className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{displayUnit}</Text>
                      <TouchableOpacity
                        onPress={() => removePlate(index)}
                        className="rounded-lg bg-red-100 p-2 dark:bg-red-900"
                      >
                        <Minus size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                <TouchableOpacity
                  onPress={addPlate}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-gray-200 py-2 dark:bg-gray-700"
                >
                  <Plus size={18} color="#6B7280" />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Add plate</Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <Text className="text-sm text-purple-700 dark:text-purple-300">
                Drop-set recommendation: {dropDisplay.toFixed(displayUnit === "lb" ? 0 : 1)}{" "}
                {displayUnit} (17.5% less)
              </Text>
            </View>
          </ScrollView>

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                onApply(dropRecommendation, "drop");
              }}
              className="flex-1 rounded-xl bg-purple-600 py-3"
            >
              <Text className="text-center font-semibold text-white">Apply Drop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onApply(targetKg, "standard")}
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
