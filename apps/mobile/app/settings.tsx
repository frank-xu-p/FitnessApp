import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { signOut } from "../lib/auth";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut } from "lucide-react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, displayUnit, setDisplayUnit, defaultBarWeightKg, setBarWeight, customPlates, setCustomPlates, apiUrl } =
    useAuthStore();

  const updatePlate = (index: number, value: string) => {
    const next = [...customPlates];
    next[index] = parseFloat(value) || 0;
    setCustomPlates(next);
  };

  const addPlate = () => {
    const step = displayUnit === "lb" ? 5 : 1.25;
    const max = customPlates.length > 0 ? Math.max(...customPlates) : 0;
    setCustomPlates([...customPlates, max + step]);
  };

  const removePlate = (index: number) => {
    const next = [...customPlates];
    next.splice(index, 1);
    setCustomPlates(next);
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950">
      <View className="flex-row items-center border-b border-gray-200 p-4 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-2 rounded-full p-2">
          <ChevronLeft size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</Text>
      </View>

      <View className="p-4">
        <View className="mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Units</Text>
          <View className="flex-row gap-3">
            {(["kg", "lb"] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => setDisplayUnit(unit)}
                className={`flex-1 rounded-lg py-2 ${
                  displayUnit === unit ? "bg-primary" : "bg-white dark:bg-gray-800"
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    displayUnit === unit ? "text-white" : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {unit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Bar Weight</Text>
          <TextInput
            value={String(defaultBarWeightKg)}
            onChangeText={(v) => setBarWeight(parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">Stored in kilograms</Text>
        </View>

        <View className="mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Plate Inventory ({displayUnit})
          </Text>
          {customPlates
            .sort((a, b) => b - a)
            .map((plate, index) => (
              <View key={index} className="mb-2 flex-row items-center gap-2">
                <TextInput
                  value={String(plate)}
                  onChangeText={(v) => updatePlate(index, v)}
                  keyboardType="decimal-pad"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <TouchableOpacity
                  onPress={() => removePlate(index)}
                  className="rounded-lg bg-red-100 px-3 py-2 dark:bg-red-900/30"
                >
                  <Text className="text-red-700 dark:text-red-300">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          <TouchableOpacity
            onPress={addPlate}
            className="mt-2 rounded-lg bg-white py-2 dark:bg-gray-800"
          >
            <Text className="text-center font-medium text-gray-900 dark:text-gray-100">Add Plate</Text>
          </TouchableOpacity>
        </View>

        {user && (
          <TouchableOpacity
            onPress={() => signOut(apiUrl)}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-red-600 py-3"
          >
            <LogOut size={20} color="white" />
            <Text className="font-semibold text-white">Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
