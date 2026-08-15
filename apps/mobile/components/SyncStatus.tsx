import { View, Text, TouchableOpacity } from "react-native";
import { useSync } from "../hooks/useSync";
import { RefreshCw, CloudOff, CheckCircle, Cloud } from "lucide-react-native";

export function SyncStatus() {
  const { status, lastSync, sync } = useSync();

  const icon =
    status === "syncing" ? (
      <RefreshCw size={18} color="#3B82F6" />
    ) : status === "error" ? (
      <CloudOff size={18} color="#EF4444" />
    ) : status === "ok" ? (
      <CheckCircle size={18} color="#22C55E" />
    ) : (
      <Cloud size={18} color="#6B7280" />
    );

  const label =
    status === "syncing"
      ? "Syncing..."
      : status === "error"
      ? "Sync failed"
      : status === "ok"
      ? "Synced"
      : "Offline";

  return (
    <TouchableOpacity
      onPress={sync}
      className="flex-row items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800"
    >
      {icon}
      <Text className="text-sm text-gray-700 dark:text-gray-300">{label}</Text>
      {lastSync && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(lastSync).toLocaleTimeString()}
        </Text>
      )}
    </TouchableOpacity>
  );
}
