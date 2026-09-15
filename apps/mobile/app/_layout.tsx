import "../global.css";
import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, LogBox, Alert } from "react-native";
import { initDatabase } from "../db/client";
import { loadSessionCookie, getSession } from "../lib/auth";
import { useAuthStore } from "../store/useAuthStore";
import { useWorkoutStore } from "../store/useWorkoutStore";
import {
  getLatestUnfinishedWorkout,
  getSetsForWorkout,
  deleteWorkout,
} from "../db/queries";

// Suppress the known NativeWind/css-interop upgrade warning that fires during
// initial render when it tries to serialize router/navigation props via JSON.stringify.
// This is a known issue with react-native-css-interop@0.1.x + expo-router v6.
LogBox.ignoreLogs([
  "Couldn't find a navigation context",
  "CssInterop upgrade warning",
]);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { apiUrl } = useAuthStore();
  const router = useRouter();
  const recoveryPromptShown = useRef(false);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        // B3: cold-start recovery. First try the persisted active workout;
        // otherwise offer to resume the latest unfinished workout from SQLite.
        const store = useWorkoutStore.getState();
        const restoredId = await store.hydrateActiveWorkout();
        if (restoredId || recoveryPromptShown.current) return;
        recoveryPromptShown.current = true;

        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;
        const unfinished = await getLatestUnfinishedWorkout(userId);
        if (!unfinished) return;

        const started = new Date(unfinished.startedAt).toLocaleDateString();
        Alert.alert(
          "Unfinished workout",
          `You have an unfinished workout from ${started} ("${unfinished.title}"). Resume it?`,
          [
            {
              text: "Discard",
              style: "destructive",
              onPress: async () => {
                await deleteWorkout(unfinished.id);
              },
            },
            { text: "Later", style: "cancel" },
            {
              text: "Resume",
              onPress: async () => {
                const rows = await getSetsForWorkout(unfinished.id);
                const exIds = Array.from(new Set(rows.map((s) => s.exerciseId)));
                useWorkoutStore.getState().setActiveWorkout(unfinished, exIds);
                router.push(`/workout/${unfinished.id}`);
              },
            },
          ]
        );
      })
      .catch((err) => {
        console.error("Failed to initialize database", err);
      });
  }, [router]);

  useEffect(() => {
    loadSessionCookie()
      .then((cookie) => (cookie ? getSession(apiUrl) : null))
      .catch((err) => {
        console.warn("Session restore skipped", err);
      });
  }, [apiUrl]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: "Workout" }} />
        <Stack.Screen name="auth" options={{ title: "Sign in" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="import-video" options={{ title: "Import exercise" }} />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}
