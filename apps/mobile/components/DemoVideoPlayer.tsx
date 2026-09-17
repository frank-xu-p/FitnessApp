import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  getDemoVideoSlug,
  getDemoVideoUrl,
  getDemoPosterUrl,
  hasDemoFemaleVideo,
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
 * exercise bundle, with a male/female model toggle (female only when the
 * bundle has one for this exercise). The toggle persists via AsyncStorage.
 * Falls back to the male model if the female stream errors.
 */
export function DemoVideoPlayer({ exerciseId, height = 280, testID }: Props) {
  const slug = getDemoVideoSlug(exerciseId);
  const femaleAvailable = hasDemoFemaleVideo(exerciseId);
  const [gender, setGender] = useState<DemoGender>("male");
  const [ready, setReady] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    getDemoGender().then((g) => {
      setGender(g === "female" && femaleAvailable ? "female" : "male");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!slug) return null;
  const uri = getDemoVideoUrl(slug, gender);
  const posterUri = getDemoPosterUrl(slug, gender);

  return (
    <PlayerBody
      uri={uri}
      posterUri={posterUri}
      height={height}
      testID={testID}
      gender={gender}
      femaleAvailable={femaleAvailable}
      onGenderChange={(g) => {
        setGender(g);
        setDemoGender(g);
      }}
      onReady={() => setReady(true)}
      ready={ready}
      onNotReady={() => setReady(false)}
      firstRender={firstRender}
    />
  );
}

function PlayerBody({
  uri,
  posterUri,
  height,
  testID,
  gender,
  femaleAvailable,
  onGenderChange,
  onReady,
  onNotReady,
  ready,
  firstRender,
}: {
  uri: string;
  posterUri: string;
  height: number;
  testID?: string;
  gender: DemoGender;
  femaleAvailable: boolean;
  onGenderChange: (g: DemoGender) => void;
  onReady: () => void;
  onNotReady: () => void;
  ready: boolean;
  firstRender: React.MutableRefObject<boolean>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Swap the model without remounting the player.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onNotReady();
    try {
      player.replace({ uri });
      player.play();
    } catch {
      // player not ready yet; the hook source update covers it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  useEffect(() => {
    const sub = player.addListener("statusChange", (payload: any) => {
      if (payload?.status === "readyToPlay") onReady();
      else if (payload?.status === "error" && gender === "female") {
        // Female stream missing/blocked: fall back to the male model.
        onGenderChange("male");
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, gender]);

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
          allowsFullscreen={false}
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
        {femaleAvailable && (
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
