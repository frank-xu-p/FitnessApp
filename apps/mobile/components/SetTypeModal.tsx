import { Modal, View, Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import { SET_TYPE_CONFIG, type SetType } from "../lib/set-types";
export { SET_TYPE_CONFIG };
export type { SetType };


type SetTypeModalProps = {
  visible: boolean;
  currentType: SetType;
  setNumber: number;
  onSelect: (type: SetType) => void;
  onClose: () => void;
};

export function SetTypeModal({
  visible,
  currentType,
  setNumber,
  onSelect,
  onClose,
}: SetTypeModalProps) {
  const types: SetType[] = ["standard", "drop", "failure", "warmup", "rest_pause"];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/70 p-4">
        <View className="w-full max-w-sm rounded-3xl bg-gray-900 p-5 border border-gray-800 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-black text-white">Select Set Type</Text>
              <Text className="text-xs text-gray-400">Set #{setNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="rounded-full bg-gray-800 p-2">
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Type Options */}
          <View className="gap-2">
            {types.map((type) => {
              const cfg = SET_TYPE_CONFIG[type];
              const isSelected = currentType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    onSelect(type);
                    onClose();
                  }}
                  className={`flex-row items-center justify-between rounded-2xl p-3 border ${
                    isSelected
                      ? "border-primary bg-primary/20"
                      : "border-gray-800 bg-gray-800/60"
                  }`}

                >
                  <View className="flex-row items-center gap-3 flex-1">
                    {/* Badge */}
                    <View
                      className="h-9 w-9 items-center justify-center rounded-xl font-bold"
                      style={{ backgroundColor: cfg.color }}
                    >
                      <Text className="text-sm font-black text-white">
                        {type === "standard" ? setNumber : cfg.badge}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-white">{cfg.label}</Text>
                      <Text className="text-[11px] text-gray-400">{cfg.description}</Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
