import React from "react";
import { Image } from "expo-image";
import { SegmentedFigurine } from "./SegmentedFigurine";
import {
  getDemoVideoSlug,
  getDemoPosterUrl,
  hasDemoPoster,
  getDemoGenderSync,
} from "../lib/demoVideos";
import type { Exercise } from "../db/schema";

type Props = {
  exercise: Exercise;
  size?: number;
};

/**
 * 3-tier exercise thumbnail: user-recorded GIF > bundle demo poster >
 * vector mannequin. Keeps list rows fast (static poster image, no video).
 */
export function ExerciseThumb({ exercise, size = 44 }: Props) {
  if (exercise.imageUrl?.endsWith(".gif")) {
    return (
      <Image
        source={{ uri: exercise.imageUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
      />
    );
  }
  const slug = getDemoVideoSlug(exercise.id);
  if (slug && hasDemoPoster(exercise.id)) {
    return (
      <Image
        source={{ uri: getDemoPosterUrl(slug, getDemoGenderSync()) }}
        style={{ width: size, height: size }}
        contentFit="cover"
      />
    );
  }
  return (
    <SegmentedFigurine
      exercise={exercise}
      size={size}
      interactive={false}
      animated={false}
    />
  );
}
