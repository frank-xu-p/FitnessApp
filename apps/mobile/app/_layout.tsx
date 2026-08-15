import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { initDatabase } from "../db/client";
import { loadSessionCookie, getSession } from "../lib/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const { apiUrl, user } = useAuthStore();

  useEffect(() => {
    initDatabase().catch((err) => {
      console.error("Failed to initialize database", err);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSessionCookie().then(async (cookie) => {
      if (!mounted) return;
      if (cookie) {
        await getSession(apiUrl);
      }
      const current = segments[0];
      if (!cookie && current !== "auth") {
        router.replace("/auth");
      }
    });
    return () => {
      mounted = false;
    };
  }, [apiUrl, router, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: "Workout" }} />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}
