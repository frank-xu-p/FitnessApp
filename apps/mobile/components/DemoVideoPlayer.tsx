import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  getDemoVideoSlug,
  getDemoVideoUrl,
  getDemoPosterUrl,
  hasDemoFemaleVideo,
  hasDemoMaleVideo,
  getDemoGender,
  setDemoGender,
  type DemoGender,
} from "../lib/demoVideos";

type Props = {
  exerciseId: string;
  height?: number;
  testID?: string;
};

/**
 * Auto-playing, looping, muted demonstration video from the free animated
 * exercise bundle, with a male/female model toggle (only the models the
 * bundle has for this exercise). The toggle persists via AsyncStorage.
 * Falls back to the other model if the preferred stream errors.
 */
export function DemoVideoPlayer({ exerciseId, height = 280, testID }: Props) {
  const slug = getDemoVideoSlug(exerciseId);
  const maleAvailable = hasDemoMaleVideo(exerciseId);
  const femaleAvailable = hasDemoFemaleVideo(exerciseId);
  const [gender, setGender] = useState<DemoGender>(
    maleAvailable ? "male" : "female",
  );
  const [ready, setReady] = useState(false);
  // Only auto-fallback to the other model once per exercise — otherwise a
  // stream that errors on both models would ping-pong forever.
  const autoFallbackDone = useRef(false);

  useEffect(() => {
    autoFallbackDone.current = false;
    setReady(false);
  }, [exerciseId]);

  useEffect(() => {
    getDemoGender().then((g) => {
      if (g === "female" && femaleAvailable) setGender("female");
      else if (g === "male" && maleAvailable) setGender("male");
      else setGender(maleAvailable ? "male" : "female");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!slug) return null;
  const uri = getDemoVideoUrl(slug, gender);
  const posterUri = getDemoPosterUrl(slug, gender);
  const showToggle = maleAvailable && femaleAvailable;

  const handleGenderChange = (g: DemoGender) => {
    setGender(g);
    setDemoGender(g);
  };

  // Preferred stream missing/blocked: fall back to the other model, once.
  const handleStreamError = () => {
    if (autoFallbackDone.current) return;
    autoFallbackDone.current = true;
    const fallback: DemoGender | null =
      gender === "female" && maleAvailable
        ? "male"
        : gender === "male" && femaleAvailable
          ? "female"
          : null;
    if (fallback) handleGenderChange(fallback);
  };

  return (
    <PlayerBody
      uri={uri}
      posterUri={posterUri}
      height={height}
      testID={testID}
      gender={gender}
      showToggle={showToggle}
      onGenderChange={handleGenderChange}
      onStreamError={handleStreamError}
      onReady={() => setReady(true)}
      ready={ready}
      onNotReady={() => setReady(false)}
    />
  );
}

function PlayerBody({
  uri,
  posterUri,
  height,
  testID,
  gender,
  showToggle,
  onGenderChange,
  onStreamError,
  onReady,
  onNotReady,
  ready,
}: {
  uri: string;
  posterUri: string;
  height: number;
  testID?: string;
  gender: DemoGender;
  showToggle: boolean;
  onGenderChange: (g: DemoGender) => void;
  onStreamError: () => void;
  onReady: () => void;
  onNotReady: () => void;
  ready: boolean;
}) {
  // NOTE: useVideoPlayer already tears down and recreates the player whenever
  // `uri` changes (it's keyed on the source). Do NOT call player.replace()
  // manually here — the manual call races the hook's release and crashes with
  // "Cannot use shared object that was already released".
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Show the poster/spinner again while the new model's stream buffers.
  useEffect(() => {
    onNotReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  useEffect(() => {
    const sub = player.addListener("statusChange", (payload: any) => {
      if (payload?.status === "readyToPlay") onReady();
      else if (payload?.status === "error") onStreamError();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <View testID={testID}>
      <View
        className="w-full rounded-3xl overflow-hidden bg-black border border-zinc-800 relative"
        style={{ height }}
      >
        {/* Poster shows instantly while the stream buffers */}
        <Image
          source={{ uri: posterUri }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          contentFit="contain"
        />
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
        {!ready && (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator size="small" color="#38BDF8" />
          </View>
        )}
      </View>

      <View className="mt-2.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-[#CCFF00]" />
          <Text className="text-[11px] font-mono font-bold text-zinc-400">
            Motion Demo
          </Text>
        </View>
        {showToggle && (
          <View className="flex-row rounded-full bg-zinc-900 border border-zinc-800 p-0.5">
            {(["male", "female"] as const).map((g) => (
              <TouchableOpacity
                key={g}
                testID={`demo-gender-${g}`}
                onPress={() => onGenderChange(g)}
                activeOpacity={0.8}
                className={`px-3 py-1 rounded-full ${
                  gender === g ? "bg-cyan-500" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-[11px] font-black uppercase ${
                    gender === g ? "text-black" : "text-zinc-400"
                  }`}
                >
                  {g === "male" ? "M" : "F"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
