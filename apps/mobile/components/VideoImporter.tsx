import { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { createVideoPlayer } from "expo-video";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { useAuthStore } from "../store/useAuthStore";
import { upsertExercise } from "../db/queries";
import { Camera, Upload, Check, Wand2 } from "lucide-react-native";
import type { Exercise } from "../db/schema";

type VideoImporterProps = {
  onImported?: (exercise: Exercise) => void;
};

export function VideoImporter({ onImported }: VideoImporterProps) {
  const { apiUrl, sessionCookie } = useAuthStore();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!picked.canceled && picked.assets[0]) {
      await processVideo(picked.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const recorded = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!recorded.canceled && recorded.assets[0]) {
      await processVideo(recorded.assets[0].uri);
    }
  };

  const processVideo = async (uri: string) => {
    setVideoUri(uri);
    setThumbnails([]);
    setResult(null);
    setError(null);

    try {
      // Extract start, middle, and near-peak frames at fixed seconds.
      const times = [0, 2, 4];
      const player = createVideoPlayer(uri);
      const nativeThumbnails = await player.generateThumbnailsAsync(times);

      const frames = await Promise.all(
        nativeThumbnails.map(async (thumb) => {
          // Native thumbnail refs must be rendered/saved to a file URI before base64 encoding.
          const context = ImageManipulator.manipulate(thumb);
          const rendered = await context.renderAsync();
          const { uri: thumbUri } = await rendered.saveAsync();
          return thumbUri;
        })
      );

      setThumbnails(frames);
    } catch (err) {
      console.error("Thumbnail extraction failed", err);
      setError(err instanceof Error ? err.message : "Failed to extract frames.");
    }
  };

  const analyze = async () => {
    if (thumbnails.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const base64Frames = await Promise.all(
        thumbnails.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
          return `data:image/jpeg;base64,${base64}`;
        })
      );

      const response = await fetch(`${apiUrl}/api/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        },
        body: JSON.stringify({ frames: base64Frames }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const { data } = await response.json<{ data: Exercise }>();
      await upsertExercise(data);
      setResult(data);
      onImported?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4 dark:bg-gray-950">
      <Text className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        AI Exercise Import
      </Text>
      <Text className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Record or upload a short video of an exercise. AI will identify it and generate a diagram.
      </Text>

      <View className="mb-4 flex-row gap-3">
        <TouchableOpacity
          onPress={recordVideo}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 dark:bg-gray-800"
        >
          <Camera size={20} color="#6B7280" />
          <Text className="font-medium text-gray-700 dark:text-gray-300">Record</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={pickVideo}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 dark:bg-gray-800"
        >
          <Upload size={20} color="#6B7280" />
          <Text className="font-medium text-gray-700 dark:text-gray-300">Upload</Text>
        </TouchableOpacity>
      </View>

      {thumbnails.length > 0 && (
        <View className="mb-4 flex-row gap-2">
          {thumbnails.map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              className="h-24 flex-1 rounded-xl bg-gray-200"
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      {thumbnails.length > 0 && !result && (
        <TouchableOpacity
          onPress={analyze}
          disabled={loading}
          className="mb-4 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Wand2 size={20} color="white" />
          )}
          <Text className="font-semibold text-white">
            {loading ? "Analyzing..." : "Analyze with AI"}
          </Text>
        </TouchableOpacity>
      )}

      {error && (
        <View className="mb-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <Text className="text-sm text-red-700 dark:text-red-300">{error}</Text>
        </View>
      )}

      {result && (
        <View className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <View className="mb-2 flex-row items-center gap-2">
            <Check size={20} color="#22C55E" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {result.name}
            </Text>
          </View>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Equipment: {result.equipment ?? "Unknown"}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Muscles: {Array.isArray(result.primaryMuscles) ? result.primaryMuscles.join(", ") : "Unknown"}
          </Text>
          <Text className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            Saved privately. Pending admin review before it can be shared globally.
          </Text>
        </View>
      )}
    </View>
  );
}
