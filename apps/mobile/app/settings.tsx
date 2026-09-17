import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { signOut } from "../lib/auth";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut } from "lucide-react-native";
import { sortInventory } from "../lib/plates";
import { useTheme, cx } from "../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { cleanUI, setCleanUI } = useTheme();
  const {
    user,
    displayUnit,
    setDisplayUnit,
    barByUnit,
    setBarWeight,
    inventoryByUnit,
    addPlate,
    updatePlate,
    removePlate,
    apiUrl,
  } = useAuthStore();

  const inventory = sortInventory(inventoryByUnit[displayUnit]);
  const barWeight = barByUnit[displayUnit];

  return (
    <ScrollView className={cx(cleanUI, "flex-1 bg-black", "flex-1 bg-white dark:bg-gray-950")}>
      <View
        className={cx(
          cleanUI,
          "flex-row items-center border-b border-[#2C2C2E] p-4 pt-12",
          "flex-row items-center border-b border-gray-200 p-4 dark:border-gray-800"
        )}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-2 rounded-full p-2">
          <ChevronLeft size={24} color={cleanUI ? "#98989F" : "#6B7280"} />
        </TouchableOpacity>
        <Text
          className={cx(
            cleanUI,
            "text-[20px] font-semibold text-white",
            "text-xl font-bold text-gray-900 dark:text-gray-100"
          )}
        >
          Settings
        </Text>
      </View>

      <View className="p-4">
        <View
          className={cx(
            cleanUI,
            "mb-4 rounded-xl bg-[#141414] p-4",
            "mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900"
          )}
        >
          <Text
            className={cx(
              cleanUI,
              "mb-3 text-[17px] font-semibold text-white",
              "mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
            )}
          >
            Units
          </Text>
          <View className="flex-row gap-3">
            {(["kg", "lb"] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => setDisplayUnit(unit)}
                className={cx(
                  cleanUI,
                  `flex-1 rounded-xl py-2.5 ${displayUnit === unit ? "bg-[#0A84FF]" : "bg-[#1C1C1E]"}`,
                  `flex-1 rounded-lg py-2 ${
                    displayUnit === unit ? "bg-primary" : "bg-white dark:bg-gray-800"
                  }`
                )}
              >
                <Text
                  className={cx(
                    cleanUI,
                    `text-center text-[15px] font-semibold ${
                      displayUnit === unit ? "text-white" : "text-[#98989F]"
                    }`,
                    `text-center font-semibold ${
                      displayUnit === unit ? "text-white" : "text-gray-900 dark:text-gray-100"
                    }`
                  )}
                >
                  {unit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Clean interface toggle */}
        <View
          className={cx(
            cleanUI,
            "mb-4 rounded-xl bg-[#141414] p-4",
            "mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900"
          )}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text
                className={cx(
                  cleanUI,
                  "text-[16px] font-medium text-white",
                  "text-sm font-bold text-gray-900 dark:text-gray-100"
                )}
              >
                Clean interface
              </Text>
              <Text
                className={cx(
                  cleanUI,
                  "text-[13px] text-[#98989F] mt-0.5",
                  "text-xs text-gray-500 dark:text-gray-400"
                )}
              >
                Calm, Strong-like design. Turn off for the classic neon look.
              </Text>
            </View>
            <Switch
              testID="clean-ui-toggle"
              value={cleanUI}
              onValueChange={setCleanUI}
              trackColor={{ false: "#3A3A3C", true: "#0A84FF" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View
          className={cx(
            cleanUI,
            "mb-4 rounded-xl bg-[#141414] p-4",
            "mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900"
          )}
        >
          <Text
            className={cx(
              cleanUI,
              "mb-3 text-[17px] font-semibold text-white",
              "mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
            )}
          >
            Bar Weight ({displayUnit})
          </Text>
          <TextInput
            value={String(barWeight)}
            onChangeText={(value) => setBarWeight(parseFloat(value) || 0)}
            keyboardType="decimal-pad"
            className={cx(
              cleanUI,
              "rounded-xl bg-[#1C1C1E] px-3 py-2 text-[16px] text-white",
              "rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            )}
          />
          <Text
            className={cx(
              cleanUI,
              "mt-1 text-[13px] text-[#98989F]",
              "mt-1 text-xs text-gray-500 dark:text-gray-400"
            )}
          >
            Defaults to {displayUnit === "lb" ? "45 lb" : "20 kg"}
          </Text>
        </View>

        <View
          className={cx(
            cleanUI,
            "mb-4 rounded-xl bg-[#141414] p-4",
            "mb-6 rounded-xl bg-gray-100 p-4 dark:bg-gray-900"
          )}
        >
          <Text
            className={cx(
              cleanUI,
              "mb-3 text-[17px] font-semibold text-white",
              "mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
            )}
          >
            Plate Inventory ({displayUnit})
          </Text>
          <View className="mb-2 flex-row gap-2">
            <Text
              className={cx(
                cleanUI,
                "flex-1 text-[13px] text-[#98989F]",
                "flex-1 text-xs text-gray-500"
              )}
            >
              Weight
            </Text>
            <Text
              className={cx(
                cleanUI,
                "w-16 text-[13px] text-[#98989F]",
                "w-16 text-xs text-gray-500"
              )}
            >
              Count
            </Text>
            <Text className="w-20" />
          </View>
          {inventory.map((plate) => (
            <View key={plate.id} className="mb-2 flex-row items-center gap-2">
              <TextInput
                value={String(plate.weight)}
                onChangeText={(value) => updatePlate(plate.id, { weight: parseFloat(value) || 0 })}
                keyboardType="decimal-pad"
                className={cx(
                  cleanUI,
                  "flex-1 rounded-xl bg-[#1C1C1E] px-3 py-2 text-[16px] text-white",
                  "flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                )}
              />
              <TextInput
                value={String(plate.count)}
                onChangeText={(value) =>
                  updatePlate(plate.id, { count: Math.max(0, parseInt(value, 10) || 0) })
                }
                keyboardType="number-pad"
                className={cx(
                  cleanUI,
                  "w-16 rounded-xl bg-[#1C1C1E] px-3 py-2 text-[16px] text-white",
                  "w-16 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                )}
              />
              <TouchableOpacity
                onPress={() => removePlate(plate.id)}
                className={cx(
                  cleanUI,
                  "rounded-xl bg-[#1C1C1E] px-3 py-2",
                  "rounded-lg bg-red-100 px-3 py-2 dark:bg-red-900/30"
                )}
              >
                <Text
                  className={cx(
                    cleanUI,
                    "text-[#FF453A]",
                    "text-red-700 dark:text-red-300"
                  )}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => addPlate()}
            className={cx(
              cleanUI,
              "mt-2 rounded-xl bg-[#1C1C1E] py-2.5",
              "mt-2 rounded-lg bg-white py-2 dark:bg-gray-800"
            )}
          >
            <Text
              className={cx(
                cleanUI,
                "text-center text-[15px] font-medium text-[#0A84FF]",
                "text-center font-medium text-gray-900 dark:text-gray-100"
              )}
            >
              Add Plate
            </Text>
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
