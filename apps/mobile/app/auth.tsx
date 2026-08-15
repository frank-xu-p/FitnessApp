import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/useAuthStore";
import { signIn, signUp } from "../lib/auth";

export default function AuthScreen() {
  const router = useRouter();
  const { apiUrl } = useAuthStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp(apiUrl, email, password, name);
      } else {
        await signIn(apiUrl, email, password);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6 dark:bg-gray-950">
      <Text className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        {mode === "signin" ? "Welcome back" : "Create account"}
      </Text>
      <Text className="mb-8 text-gray-500 dark:text-gray-400">
        Sign in to sync your workouts across devices.
      </Text>

      {mode === "signup" && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          autoCapitalize="words"
          className="mb-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholderTextColor="#9CA3AF"
        />
      )}

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        className="mb-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        placeholderTextColor="#9CA3AF"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        placeholderTextColor="#9CA3AF"
      />

      {error && (
        <View className="mb-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <Text className="text-sm text-red-700 dark:text-red-300">{error}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading}
        className="mb-4 flex-row items-center justify-center rounded-xl bg-primary py-3 disabled:opacity-50"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-lg font-semibold text-white">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
        <Text className="text-center text-primary">
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/")}
        className="mt-6"
      >
        <Text className="text-center text-gray-500 dark:text-gray-400">Continue offline</Text>
      </TouchableOpacity>
    </View>
  );
}
