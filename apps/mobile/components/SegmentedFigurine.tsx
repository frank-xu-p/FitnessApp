import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SvgXml } from "react-native-svg";
import { Play, Pause, RotateCw, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { renderStickFigureSvg, type SkeletalPose } from "../lib/stickFigure";
import type { Exercise } from "../db/schema";

export type SegmentedFigurineProps = {
  exercise?: Exercise | null;
  customPoses?: SkeletalPose[];
  size?: number;
  autoPlay?: boolean;
  className?: string;
};

/**
 * Generates dynamic phase-based skeletal poses for standard gym movements.
 */
function getKinematicMotionFrames(
  exerciseName: string = "",
  primaryMuscles: string[] = [],
  equipment: string = ""
): SkeletalPose[] {
  const normName = exerciseName.toLowerCase();
  const eq = equipment.toLowerCase();
  const appType: SkeletalPose["apparatusType"] = eq.includes("barbell")
    ? "barbell"
    : eq.includes("dumbbell")
    ? "dumbbell"
    : eq.includes("cable")
    ? "cable"
    : eq.includes("machine")
    ? "machine"
    : "body";

  const isSquat = normName.includes("squat") || normName.includes("leg press");
  const isDeadlift = normName.includes("deadlift") || normName.includes("hinge");
  const isOverhead = normName.includes("shoulder press") || normName.includes("overhead") || normName.includes("military");
  const isLateralRaise = normName.includes("lateral raise");
  const isBicepCurl = normName.includes("curl");
  const isTricepPush = normName.includes("pushdown") || normName.includes("tricep") || normName.includes("extension");
  const isRow = normName.includes("row") || normName.includes("pull");
  const isChest = normName.includes("bench") || normName.includes("chest") || normName.includes("press") || normName.includes("fly");

  if (isSquat) {
    // 2-phase Squat kinematics
    return [
      {
        apparatusType: appType === "body" ? "barbell" : appType,
        primaryMuscles: ["quadriceps", "glutes"],
        joints: {
          head: { x: 0.5, y: 0.16 },
          leftShoulder: { x: 0.42, y: 0.22 },
          rightShoulder: { x: 0.58, y: 0.22 },
          leftElbow: { x: 0.38, y: 0.28 },
          rightElbow: { x: 0.62, y: 0.28 },
          leftWrist: { x: 0.42, y: 0.23 },
          rightWrist: { x: 0.58, y: 0.23 },
          leftIndex: { x: 0.42, y: 0.23 },
          rightIndex: { x: 0.58, y: 0.23 },
          hip: { x: 0.5, y: 0.48 },
          leftKnee: { x: 0.44, y: 0.66 },
          rightKnee: { x: 0.56, y: 0.66 },
          leftAnkle: { x: 0.42, y: 0.88 },
          rightAnkle: { x: 0.58, y: 0.88 },
          leftFootIndex: { x: 0.45, y: 0.90 },
          rightFootIndex: { x: 0.61, y: 0.90 },
        },
      },
      {
        apparatusType: appType === "body" ? "barbell" : appType,
        primaryMuscles: ["quadriceps", "glutes"],
        joints: {
          head: { x: 0.5, y: 0.32 },
          leftShoulder: { x: 0.41, y: 0.38 },
          rightShoulder: { x: 0.59, y: 0.38 },
          leftElbow: { x: 0.36, y: 0.44 },
          rightElbow: { x: 0.64, y: 0.44 },
          leftWrist: { x: 0.41, y: 0.39 },
          rightWrist: { x: 0.59, y: 0.39 },
          leftIndex: { x: 0.41, y: 0.39 },
          rightIndex: { x: 0.59, y: 0.39 },
          hip: { x: 0.5, y: 0.64 },
          leftKnee: { x: 0.34, y: 0.64 },
          rightKnee: { x: 0.66, y: 0.64 },
          leftAnkle: { x: 0.42, y: 0.88 },
          rightAnkle: { x: 0.58, y: 0.88 },
          leftFootIndex: { x: 0.45, y: 0.90 },
          rightFootIndex: { x: 0.61, y: 0.90 },
        },
      },
    ];
  }

  if (isOverhead) {
    // 2-phase Overhead Press
    return [
      {
        apparatusType: appType,
        primaryMuscles: ["shoulders", "triceps"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.36, y: 0.35 },
          rightElbow: { x: 0.64, y: 0.35 },
          leftWrist: { x: 0.38, y: 0.26 },
          rightWrist: { x: 0.62, y: 0.26 },
          leftIndex: { x: 0.38, y: 0.26 },
          rightIndex: { x: 0.62, y: 0.26 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.45, y: 0.68 },
          rightKnee: { x: 0.55, y: 0.68 },
          leftAnkle: { x: 0.44, y: 0.88 },
          rightAnkle: { x: 0.56, y: 0.88 },
          leftFootIndex: { x: 0.46, y: 0.90 },
          rightFootIndex: { x: 0.58, y: 0.90 },
        },
      },
      {
        apparatusType: appType,
        primaryMuscles: ["shoulders", "triceps"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.40, y: 0.14 },
          rightElbow: { x: 0.60, y: 0.14 },
          leftWrist: { x: 0.42, y: 0.05 },
          rightWrist: { x: 0.58, y: 0.05 },
          leftIndex: { x: 0.42, y: 0.05 },
          rightIndex: { x: 0.58, y: 0.05 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.45, y: 0.68 },
          rightKnee: { x: 0.55, y: 0.68 },
          leftAnkle: { x: 0.44, y: 0.88 },
          rightAnkle: { x: 0.56, y: 0.88 },
          leftFootIndex: { x: 0.46, y: 0.90 },
          rightFootIndex: { x: 0.58, y: 0.90 },
        },
      },
    ];
  }

  if (isLateralRaise) {
    // 2-phase Lateral Raise
    return [
      {
        apparatusType: "dumbbell",
        primaryMuscles: ["shoulders"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.41, y: 0.38 },
          rightElbow: { x: 0.59, y: 0.38 },
          leftWrist: { x: 0.43, y: 0.48 },
          rightWrist: { x: 0.57, y: 0.48 },
          leftIndex: { x: 0.43, y: 0.48 },
          rightIndex: { x: 0.57, y: 0.48 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.46, y: 0.68 },
          rightKnee: { x: 0.54, y: 0.68 },
          leftAnkle: { x: 0.45, y: 0.88 },
          rightAnkle: { x: 0.55, y: 0.88 },
          leftFootIndex: { x: 0.47, y: 0.90 },
          rightFootIndex: { x: 0.57, y: 0.90 },
        },
      },
      {
        apparatusType: "dumbbell",
        primaryMuscles: ["shoulders"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.27, y: 0.24 },
          rightElbow: { x: 0.73, y: 0.24 },
          leftWrist: { x: 0.16, y: 0.26 },
          rightWrist: { x: 0.84, y: 0.26 },
          leftIndex: { x: 0.16, y: 0.26 },
          rightIndex: { x: 0.84, y: 0.26 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.46, y: 0.68 },
          rightKnee: { x: 0.54, y: 0.68 },
          leftAnkle: { x: 0.45, y: 0.88 },
          rightAnkle: { x: 0.55, y: 0.88 },
          leftFootIndex: { x: 0.47, y: 0.90 },
          rightFootIndex: { x: 0.57, y: 0.90 },
        },
      },
    ];
  }

  if (isBicepCurl) {
    // 2-phase Bicep Curl
    return [
      {
        apparatusType: appType === "body" ? "dumbbell" : appType,
        primaryMuscles: ["biceps"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.41, y: 0.38 },
          rightElbow: { x: 0.59, y: 0.38 },
          leftWrist: { x: 0.42, y: 0.50 },
          rightWrist: { x: 0.58, y: 0.50 },
          leftIndex: { x: 0.42, y: 0.50 },
          rightIndex: { x: 0.58, y: 0.50 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.46, y: 0.68 },
          rightKnee: { x: 0.54, y: 0.68 },
          leftAnkle: { x: 0.45, y: 0.88 },
          rightAnkle: { x: 0.55, y: 0.88 },
          leftFootIndex: { x: 0.47, y: 0.90 },
          rightFootIndex: { x: 0.57, y: 0.90 },
        },
      },
      {
        apparatusType: appType === "body" ? "dumbbell" : appType,
        primaryMuscles: ["biceps"],
        joints: {
          head: { x: 0.5, y: 0.18 },
          leftShoulder: { x: 0.42, y: 0.25 },
          rightShoulder: { x: 0.58, y: 0.25 },
          leftElbow: { x: 0.41, y: 0.38 },
          rightElbow: { x: 0.59, y: 0.38 },
          leftWrist: { x: 0.41, y: 0.27 },
          rightWrist: { x: 0.59, y: 0.27 },
          leftIndex: { x: 0.41, y: 0.27 },
          rightIndex: { x: 0.59, y: 0.27 },
          hip: { x: 0.5, y: 0.50 },
          leftKnee: { x: 0.46, y: 0.68 },
          rightKnee: { x: 0.54, y: 0.68 },
          leftAnkle: { x: 0.45, y: 0.88 },
          rightAnkle: { x: 0.55, y: 0.88 },
          leftFootIndex: { x: 0.47, y: 0.90 },
          rightFootIndex: { x: 0.57, y: 0.90 },
        },
      },
    ];
  }

  // Default: Chest / Press / Push / General Biomechanics
  return [
    {
      apparatusType: appType,
      primaryMuscles: primaryMuscles.length > 0 ? primaryMuscles : ["chest", "triceps"],
      joints: {
        head: { x: 0.5, y: 0.18 },
        leftShoulder: { x: 0.42, y: 0.25 },
        rightShoulder: { x: 0.58, y: 0.25 },
        leftElbow: { x: 0.32, y: 0.28 },
        rightElbow: { x: 0.68, y: 0.28 },
        leftWrist: { x: 0.35, y: 0.26 },
        rightWrist: { x: 0.65, y: 0.26 },
        leftIndex: { x: 0.35, y: 0.26 },
        rightIndex: { x: 0.65, y: 0.26 },
        hip: { x: 0.5, y: 0.50 },
        leftKnee: { x: 0.45, y: 0.68 },
        rightKnee: { x: 0.55, y: 0.68 },
        leftAnkle: { x: 0.44, y: 0.88 },
        rightAnkle: { x: 0.56, y: 0.88 },
        leftFootIndex: { x: 0.46, y: 0.90 },
        rightFootIndex: { x: 0.58, y: 0.90 },
      },
    },
    {
      apparatusType: appType,
      primaryMuscles: primaryMuscles.length > 0 ? primaryMuscles : ["chest", "triceps"],
      joints: {
        head: { x: 0.5, y: 0.18 },
        leftShoulder: { x: 0.42, y: 0.25 },
        rightShoulder: { x: 0.58, y: 0.25 },
        leftElbow: { x: 0.40, y: 0.22 },
        rightElbow: { x: 0.60, y: 0.22 },
        leftWrist: { x: 0.42, y: 0.18 },
        rightWrist: { x: 0.58, y: 0.18 },
        leftIndex: { x: 0.42, y: 0.18 },
        rightIndex: { x: 0.58, y: 0.18 },
        hip: { x: 0.5, y: 0.50 },
        leftKnee: { x: 0.45, y: 0.68 },
        rightKnee: { x: 0.55, y: 0.68 },
        leftAnkle: { x: 0.44, y: 0.88 },
        rightAnkle: { x: 0.56, y: 0.88 },
        leftFootIndex: { x: 0.46, y: 0.90 },
        rightFootIndex: { x: 0.58, y: 0.90 },
      },
    },
  ];
}

export function SegmentedFigurine({
  exercise,
  customPoses,
  size = 320,
  autoPlay = true,
  className = "",
}: SegmentedFigurineProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  const frames =
    customPoses && customPoses.length > 0
      ? customPoses
      : getKinematicMotionFrames(
          exercise?.name || "",
          (exercise?.primaryMuscles as string[]) || [],
          exercise?.equipment || ""
        );

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const timer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 1100);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length]);

  const currentPose = frames[frameIdx] || frames[0];
  const svgXmlString = renderStickFigureSvg(currentPose, size);

  const handleTogglePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIsPlaying((prev) => !prev);
  };

  const handleStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setFrameIdx((prev) => (prev + 1) % frames.length);
  };

  return (
    <View
      className={`relative items-center justify-center overflow-hidden rounded-3xl bg-[#0B0F19] border border-zinc-800 ${className}`}
      style={{ width: "100%", height: size }}
    >
      {/* 2D Segmented Muscular Figurine Vector Render (Style 2) */}
      <SvgXml xml={svgXmlString} width="100%" height="100%" />

      {/* Top Floating Badge: Motion Phase */}
      <View className="absolute top-3 left-3 flex-row items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 border border-cyan-500/30">
        <Sparkles size={12} color="#38BDF8" />
        <Text className="text-[10px] font-mono font-bold uppercase text-cyan-400">
          Style 2 Vector · Phase {frameIdx + 1}/{frames.length}
        </Text>
      </View>

      {/* Bottom Floating Playback Controls */}
      <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-2xl bg-black/80 p-1.5 border border-zinc-700/60">
        <TouchableOpacity
          onPress={handleStep}
          activeOpacity={0.8}
          className="rounded-xl bg-zinc-900 p-2 border border-zinc-800"
        >
          <RotateCw size={14} color="#A1A1AA" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTogglePlay}
          activeOpacity={0.8}
          className="rounded-xl bg-cyan-500 p-2"
        >
          {isPlaying ? (
            <Pause size={14} color="#000000" />
          ) : (
            <Play size={14} color="#000000" fill="#000000" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
