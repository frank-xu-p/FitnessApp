import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { VideoImporter } from "../components/VideoImporter";
import { X } from "lucide-react-native";

export default function ImportVideoScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-gray-800/80 px-4 pt-12 pb-3.5 bg-gray-950">
        <View>
          <Text className="text-base font-black text-white">Create Custom Exercise</Text>
          <Text className="text-[11px] text-gray-400">AI Figurine Demonstration Engine</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-full bg-gray-900 border border-gray-800"
        >
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <VideoImporter
        onImported={(exercise) => {
          // Keep exercise in state/callback
        }}
      />
    </View>
  );
}

