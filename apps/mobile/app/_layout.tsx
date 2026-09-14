import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, LogBox } from "react-native";
import { initDatabase } from "../db/client";
import { loadSessionCookie, getSession } from "../lib/auth";
import { useAuthStore } from "../store/useAuthStore";

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

  useEffect(() => {
    initDatabase().catch((err) => {
      console.error("Failed to initialize database", err);
    });
  }, []);

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
