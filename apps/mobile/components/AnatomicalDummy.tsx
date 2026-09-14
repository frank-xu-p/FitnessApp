import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Path, G, Rect, Circle } from "react-native-svg";
import { X } from "lucide-react-native";

export type MuscleGroup =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abdominals"
  | "lats"
  | "traps"
  | "lower back"
  | "middle back"
  | "glutes"
  | "quadriceps"
  | "hamstrings"
  | "calves";

export type AnatomicalDummyProps = {
  selectedMuscle?: string | null;
  onSelectMuscle: (muscle: string | null) => void;
  className?: string;
};

export function AnatomicalDummy({
  selectedMuscle,
  onSelectMuscle,
  className,
}: AnatomicalDummyProps) {
  const [view, setView] = useState<"front" | "back">("front");

  const isSelected = (muscle: string) => {
    if (!selectedMuscle) return false;
    const norm = selectedMuscle.toLowerCase();
    if (norm === muscle) return true;
    if (muscle === "traps" && (norm === "trapezius" || norm === "neck")) return true;
    if (muscle === "lats" && (norm === "latissimus dorsi" || norm === "back")) return true;
    if (muscle === "quadriceps" && (norm === "quads" || norm === "legs")) return true;
    if (muscle === "abdominals" && (norm === "abs" || norm === "core")) return true;
    return false;
  };

  const handleToggle = (muscle: string) => {
    if (isSelected(muscle)) {
      onSelectMuscle(null);
    } else {
      onSelectMuscle(muscle);
    }
  };

  const getFill = (muscle: string) => {
    return isSelected(muscle) ? "#38BDF8" : "#1E293B";
  };

  const getStroke = (muscle: string) => {
    return isSelected(muscle) ? "#BAE6FD" : "#475569";
  };

  return (
    <View className={`rounded-3xl border border-gray-800 bg-gray-900/95 p-4 shadow-xl ${className ?? ""}`}>
      {/* Header controls: View switcher + Selected Label */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row rounded-xl bg-gray-800 p-1 border border-gray-700/50">
          <TouchableOpacity
            testID="anatomical-dummy-front-btn"
            onPress={() => setView("front")}
            activeOpacity={0.8}
            className={`rounded-lg px-3 py-1 ${
              view === "front" ? "bg-sky-500" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-black uppercase ${
                view === "front" ? "text-white" : "text-gray-400"
              }`}
            >
              Front
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="anatomical-dummy-back-btn"
            onPress={() => setView("back")}
            activeOpacity={0.8}
            className={`rounded-lg px-3 py-1 ${
              view === "back" ? "bg-sky-500" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-black uppercase ${
                view === "back" ? "text-white" : "text-gray-400"
              }`}
            >
              Back
            </Text>
          </TouchableOpacity>
        </View>

        {selectedMuscle ? (
          <TouchableOpacity
            testID="anatomical-dummy-clear-btn"
            onPress={() => onSelectMuscle(null)}
            activeOpacity={0.8}
            className="flex-row items-center gap-1.5 rounded-xl bg-sky-500/20 px-2.5 py-1 border border-sky-500/40"
          >
            <Text className="text-xs font-black capitalize text-sky-400">
              {selectedMuscle}
            </Text>
            <X size={13} color="#38BDF8" />
          </TouchableOpacity>
        ) : (
          <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Tap muscle to filter
          </Text>
        )}
      </View>

      {/* SVG Interactive Canvas */}
      <View className="items-center justify-center py-2">
        <Svg width={220} height={260} viewBox="0 0 220 260">
          {/* Head & Neck silhouette */}
          <Circle cx="110" cy="22" r="14" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
          <Rect x="105" y="34" width="10" height="10" fill="#0F172A" />

          {view === "front" ? (
            /* FRONT VIEW */
            <G testID="anatomical-dummy-front-view">
              {/* Traps / Neck */}
              <Path
                testID="muscle-front-traps"
                d="M 94 38 L 105 34 L 115 34 L 126 38 L 120 48 L 100 48 Z"
                fill={getFill("traps")}
                stroke={getStroke("traps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("traps")}
              />

              {/* Shoulders / Deltoids (Left & Right) */}
              <Path
                testID="muscle-front-shoulders-left"
                d="M 72 48 C 65 52, 60 64, 62 76 C 68 76, 75 66, 78 56 Z"
                fill={getFill("shoulders")}
                stroke={getStroke("shoulders")}
                strokeWidth="1.5"
                onPress={() => handleToggle("shoulders")}
              />
              <Path
                testID="muscle-front-shoulders-right"
                d="M 148 48 C 155 52, 160 64, 158 76 C 152 76, 145 66, 142 56 Z"
                fill={getFill("shoulders")}
                stroke={getStroke("shoulders")}
                strokeWidth="1.5"
                onPress={() => handleToggle("shoulders")}
              />

              {/* Chest / Pectorals (Left & Right) */}
              <Path
                testID="muscle-front-chest"
                d="M 78 54 C 88 52, 106 52, 108 62 C 108 78, 88 84, 76 80 C 72 70, 74 60, 78 54 Z"
                fill={getFill("chest")}
                stroke={getStroke("chest")}
                strokeWidth="1.5"
                onPress={() => handleToggle("chest")}
              />
              <Path
                testID="muscle-front-chest-r"
                d="M 142 54 C 132 52, 114 52, 112 62 C 112 78, 132 84, 144 80 C 148 70, 146 60, 142 54 Z"
                fill={getFill("chest")}
                stroke={getStroke("chest")}
                strokeWidth="1.5"
                onPress={() => handleToggle("chest")}
              />

              {/* Biceps (Left & Right) */}
              <Path
                testID="muscle-front-biceps"
                d="M 58 78 C 54 86, 54 100, 60 108 C 66 108, 68 94, 66 82 Z"
                fill={getFill("biceps")}
                stroke={getStroke("biceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("biceps")}
              />
              <Path
                testID="muscle-front-biceps-r"
                d="M 162 78 C 166 86, 166 100, 160 108 C 154 108, 152 94, 154 82 Z"
                fill={getFill("biceps")}
                stroke={getStroke("biceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("biceps")}
              />

              {/* Forearms (Left & Right) */}
              <Path
                testID="muscle-front-forearms"
                d="M 56 112 C 50 124, 46 142, 50 152 C 54 152, 60 138, 62 120 Z"
                fill={getFill("forearms")}
                stroke={getStroke("forearms")}
                strokeWidth="1.5"
                onPress={() => handleToggle("forearms")}
              />
              <Path
                testID="muscle-front-forearms-r"
                d="M 164 112 C 170 124, 174 142, 170 152 C 166 152, 160 138, 158 120 Z"
                fill={getFill("forearms")}
                stroke={getStroke("forearms")}
                strokeWidth="1.5"
                onPress={() => handleToggle("forearms")}
              />

              {/* Abdominals / Core */}
              <Path
                testID="muscle-front-abdominals"
                d="M 88 86 L 132 86 L 128 132 L 110 140 L 92 132 Z"
                fill={getFill("abdominals")}
                stroke={getStroke("abdominals")}
                strokeWidth="1.5"
                onPress={() => handleToggle("abdominals")}
              />

              {/* Quadriceps (Left & Right) */}
              <Path
                testID="muscle-front-quadriceps"
                d="M 88 144 C 80 158, 76 186, 82 208 C 92 208, 104 186, 106 150 Z"
                fill={getFill("quadriceps")}
                stroke={getStroke("quadriceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("quadriceps")}
              />
              <Path
                testID="muscle-front-quadriceps-r"
                d="M 132 144 C 140 158, 144 186, 138 208 C 128 208, 116 186, 114 150 Z"
                fill={getFill("quadriceps")}
                stroke={getStroke("quadriceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("quadriceps")}
              />

              {/* Calves (Front Shin / Calves) */}
              <Path
                testID="muscle-front-calves"
                d="M 82 214 C 78 226, 78 244, 82 254 C 88 254, 94 242, 94 220 Z"
                fill={getFill("calves")}
                stroke={getStroke("calves")}
                strokeWidth="1.5"
                onPress={() => handleToggle("calves")}
              />
              <Path
                testID="muscle-front-calves-r"
                d="M 138 214 C 142 226, 142 244, 138 254 C 132 254, 126 242, 126 220 Z"
                fill={getFill("calves")}
                stroke={getStroke("calves")}
                strokeWidth="1.5"
                onPress={() => handleToggle("calves")}
              />
            </G>
          ) : (
            /* BACK VIEW */
            <G testID="anatomical-dummy-back-view">
              {/* Upper Traps / Neck */}
              <Path
                testID="muscle-back-traps"
                d="M 92 38 L 128 38 L 122 62 L 110 74 L 98 62 Z"
                fill={getFill("traps")}
                stroke={getStroke("traps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("traps")}
              />

              {/* Rear Deltoids */}
              <Path
                testID="muscle-back-shoulders-left"
                d="M 72 48 C 65 52, 60 64, 62 76 C 68 76, 75 66, 78 56 Z"
                fill={getFill("shoulders")}
                stroke={getStroke("shoulders")}
                strokeWidth="1.5"
                onPress={() => handleToggle("shoulders")}
              />
              <Path
                testID="muscle-back-shoulders-right"
                d="M 148 48 C 155 52, 160 64, 158 76 C 152 76, 145 66, 142 56 Z"
                fill={getFill("shoulders")}
                stroke={getStroke("shoulders")}
                strokeWidth="1.5"
                onPress={() => handleToggle("shoulders")}
              />

              {/* Triceps (Left & Right) */}
              <Path
                testID="muscle-back-triceps"
                d="M 58 78 C 54 86, 54 100, 60 108 C 66 108, 68 94, 66 82 Z"
                fill={getFill("triceps")}
                stroke={getStroke("triceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("triceps")}
              />
              <Path
                testID="muscle-back-triceps-r"
                d="M 162 78 C 166 86, 166 100, 160 108 C 154 108, 152 94, 154 82 Z"
                fill={getFill("triceps")}
                stroke={getStroke("triceps")}
                strokeWidth="1.5"
                onPress={() => handleToggle("triceps")}
              />

              {/* Lats / Upper & Middle Back */}
              <Path
                testID="muscle-back-lats"
                d="M 78 68 C 90 74, 104 74, 108 80 L 108 116 C 96 114, 84 102, 78 86 Z"
                fill={getFill("lats")}
                stroke={getStroke("lats")}
                strokeWidth="1.5"
                onPress={() => handleToggle("lats")}
              />
              <Path
                testID="muscle-back-lats-r"
                d="M 142 68 C 130 74, 116 74, 112 80 L 112 116 C 124 114, 136 102, 142 86 Z"
                fill={getFill("lats")}
                stroke={getStroke("lats")}
                strokeWidth="1.5"
                onPress={() => handleToggle("lats")}
              />

              {/* Lower Back */}
              <Path
                testID="muscle-back-lower-back"
                d="M 94 118 L 126 118 L 122 136 L 110 142 L 98 136 Z"
                fill={getFill("lower back")}
                stroke={getStroke("lower back")}
                strokeWidth="1.5"
                onPress={() => handleToggle("lower back")}
              />

              {/* Glutes (Left & Right) */}
              <Path
                testID="muscle-back-glutes"
                d="M 86 142 C 78 152, 78 168, 86 176 C 98 178, 106 166, 108 144 Z"
                fill={getFill("glutes")}
                stroke={getStroke("glutes")}
                strokeWidth="1.5"
                onPress={() => handleToggle("glutes")}
              />
              <Path
                testID="muscle-back-glutes-r"
                d="M 134 142 C 142 152, 142 168, 134 176 C 122 178, 114 166, 112 144 Z"
                fill={getFill("glutes")}
                stroke={getStroke("glutes")}
                strokeWidth="1.5"
                onPress={() => handleToggle("glutes")}
              />

              {/* Hamstrings (Left & Right) */}
              <Path
                testID="muscle-back-hamstrings"
                d="M 86 180 C 80 192, 80 206, 86 214 C 96 214, 104 200, 106 180 Z"
                fill={getFill("hamstrings")}
                stroke={getStroke("hamstrings")}
                strokeWidth="1.5"
                onPress={() => handleToggle("hamstrings")}
              />
              <Path
                testID="muscle-back-hamstrings-r"
                d="M 134 180 C 140 192, 140 206, 134 214 C 124 214, 116 200, 114 180 Z"
                fill={getFill("hamstrings")}
                stroke={getStroke("hamstrings")}
                strokeWidth="1.5"
                onPress={() => handleToggle("hamstrings")}
              />

              {/* Calves (Back Gastrocnemius / Soleus) */}
              <Path
                testID="muscle-back-calves"
                d="M 82 218 C 76 228, 76 244, 82 254 C 90 254, 96 244, 94 222 Z"
                fill={getFill("calves")}
                stroke={getStroke("calves")}
                strokeWidth="1.5"
                onPress={() => handleToggle("calves")}
              />
              <Path
                testID="muscle-back-calves-r"
                d="M 138 218 C 144 228, 144 244, 138 254 C 130 254, 124 244, 126 222 Z"
                fill={getFill("calves")}
                stroke={getStroke("calves")}
                strokeWidth="1.5"
                onPress={() => handleToggle("calves")}
              />
            </G>
          )}
        </Svg>
      </View>
    </View>
  );
}
