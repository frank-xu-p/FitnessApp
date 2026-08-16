import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { Play, Pause, RotateCcw, Bell } from "lucide-react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type RestTimerProps = {
  defaultSeconds?: number;
  onComplete?: () => void;
};

export function RestTimer({ defaultSeconds = 120, onComplete }: RestTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            onComplete?.();
            return 0;
          }
          if (prev === 4) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onComplete]);

  const start = useCallback(() => {
    setIsRunning(true);
    scheduleNotification(totalSeconds).catch(() => undefined);
  }, [totalSeconds]);

  const pause = useCallback(() => {
    setIsRunning(false);
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  }, []);

  const reset = useCallback((newSeconds = defaultSeconds) => {
    setIsRunning(false);
    setTotalSeconds(newSeconds);
    setSecondsLeft(newSeconds);
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  }, [defaultSeconds]);

  const scheduleNotification = async (seconds: number) => {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      if (requested.status !== "granted") return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rest timer done",
        body: "Time for your next set!",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View className="rounded-xl bg-gray-900 p-4 dark:bg-gray-100">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Bell size={20} color="#FFFFFF" />
          <Text className="text-lg font-semibold text-white dark:text-gray-900">
            Rest: {formatTime(secondsLeft)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={isRunning ? pause : start}
            className="rounded-lg bg-primary p-2"
          >
            {isRunning ? (
              <Pause size={20} color="#FFFFFF" />
            ) : (
              <Play size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => reset()} className="rounded-lg bg-gray-700 p-2 dark:bg-gray-300">
            <RotateCcw size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {[30, 60, 90, 120, 180, 300].map((preset) => (
          <TouchableOpacity
            key={preset}
            onPress={() => reset(preset)}
            className={`rounded-full px-3 py-1 ${
              totalSeconds === preset ? "bg-primary" : "bg-gray-700 dark:bg-gray-300"
            }`}
          >
            <Text className="text-sm text-white dark:text-gray-900">
              {preset >= 60 ? `${preset / 60}m` : `${preset}s`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
