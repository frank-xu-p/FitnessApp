import React from "react";
import { View, StyleSheet, DimensionValue } from "react-native";
import { SvgXml } from "react-native-svg";
import { Image } from "expo-image";
import { renderStickFigureSvg, SkeletalPose } from "../lib/stickFigure";

type StickFigureViewProps = {
  svgContent?: string;
  pose?: SkeletalPose;
  imageUrl?: string;
  width?: DimensionValue;
  height?: DimensionValue;
};

export function StickFigureView({
  svgContent,
  pose,
  imageUrl,
  width = "100%",
  height = "100%",
}: StickFigureViewProps) {
  // If raw SVG string or pose provided, render crisp vector SvgXml
  const xml = svgContent ?? (pose ? renderStickFigureSvg(pose) : null);

  if (xml && xml.trim().startsWith("<svg")) {
    return (
      <View style={[styles.container, { width, height }]}>
        <SvgXml xml={xml} width="100%" height="100%" />
      </View>
    );
  }

  // Fallback to Image / URI if provided
  if (imageUrl) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          transition={100}
        />
      </View>
    );
  }

  // Default empty stick figure
  const defaultXml = renderStickFigureSvg({
    joints: {},
    primaryMuscles: ["chest"],
    apparatusType: "body",
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <SvgXml xml={defaultXml} width="100%" height="100%" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0B0F19",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
