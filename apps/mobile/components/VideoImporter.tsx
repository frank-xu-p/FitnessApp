import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";

import { useAuthStore } from "../store/useAuthStore";
import { upsertExercise } from "../db/queries";
import { findMovementGroup, deriveVariantLabel } from "../lib/exerciseVariants";
import { SegmentedFigurine } from "./SegmentedFigurine";
import { SvgXml } from "react-native-svg";
import { renderStickFigureSvg, SkeletalPose } from "../lib/stickFigure";
import { decode as decodeJpeg } from "jpeg-js";
import {
  computeGifPlan,
  encodeGif,
  base64ToBytes,
  bytesToBase64,
  resizeRgbaBilinear,
  type RgbaFrame,
} from "../lib/gifExport";
import {
  Camera,
  Upload,
  Images,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Play,
  Scissors,
  Clock,
  Trash2,
  Film,
} from "lucide-react-native";
import type { Exercise } from "../db/schema";

type WizardStep = "input" | "keyframes" | "processing" | "preview" | "saved";

type KeyframePhase = {
  label: string;
  badge: string;
  description: string;
};

const PHASES: KeyframePhase[] = [
  { label: "Setup", badge: "Phase 1", description: "Starting posture & grip" },
  { label: "Stretch", badge: "Phase 2", description: "Deep eccentric stretch / inflection" },
  { label: "Contraction", badge: "Phase 3", description: "Peak concentric lockout" },
];

type VideoImporterProps = {
  onImported?: (exercise: Exercise) => void;
};

/** Decode a backend-AI SVG frame (raw `<svg` or data-URI) to raw SVG markup. */
function decodeSvgFrame(frame?: string | null): string | null {
  if (!frame) return null;
  if (frame.startsWith("<svg")) return frame;
  if (frame.startsWith("data:image/svg+xml")) {
    const comma = frame.indexOf(",");
    const payload = comma >= 0 ? frame.slice(comma + 1) : frame;
    try {
      return decodeURIComponent(payload);
    } catch {
      return payload;
    }
  }
  return null;
}

export function VideoImporter({ onImported }: VideoImporterProps) {
  const router = useRouter();
  const { apiUrl, sessionCookie } = useAuthStore();

  const [step, setStep] = useState<WizardStep>("input");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [hints, setHints] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Review & Quick Edit State
  const [exerciseId, setExerciseId] = useState<string>("");
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState("");
  const [parentCategory, setParentCategory] = useState("other");
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const [animationFrames, setAnimationFrames] = useState<string[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  // Poses for the unified vector renderer (local kinematic fallback path)
  const [previewPoses, setPreviewPoses] = useState<SkeletalPose[] | null>(null);
  // Exported motion GIF (real video frames) — saved as the exercise imageUrl
  const [gifUri, setGifUri] = useState<string | null>(null);
  const [gifExporting, setGifExporting] = useState(false);

  // Auto-play animation loop in preview
  useEffect(() => {
    if (animationFrames.length <= 1) return;
    const interval = setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % animationFrames.length);
    }, 750);
    return () => clearInterval(interval);
  }, [animationFrames]);

  // Validate video duration under 10s limit
  const validateVideoDuration = (durationInSecondsOrMs?: number | null): boolean => {
    if (durationInSecondsOrMs == null) return true;
    const sec = durationInSecondsOrMs > 100 ? durationInSecondsOrMs / 1000 : durationInSecondsOrMs;
    if (sec > 10.5) {
      setError(
        `Video is ${Math.round(sec)}s long. Please trim or clip the video to under 10 seconds showing 1 complete rep from start to finish.`
      );
      return false;
    }
    return true;
  };

  // Pick Video from Media Library
  const handlePickVideo = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permission to access media library is required.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 10,
      quality: 0.8,
    });

    if (!picked.canceled && picked.assets && picked.assets[0]) {
      const asset = picked.assets[0];
      const dur = asset.duration != null ? (asset.duration > 100 ? asset.duration / 1000 : asset.duration) : null;
      setVideoDuration(dur);

      if (!validateVideoDuration(asset.duration)) {
        return;
      }
      await extractKeyframesFromVideo(asset.uri, dur);
    }
  };

  // Record Video with Camera
  const handleRecordVideo = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Permission to access camera is required.");
      return;
    }

    const recorded = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 10,
      quality: 0.8,
    });

    if (!recorded.canceled && recorded.assets && recorded.assets[0]) {
      const asset = recorded.assets[0];
      const dur = asset.duration != null ? (asset.duration > 100 ? asset.duration / 1000 : asset.duration) : null;
      setVideoDuration(dur);

      if (!validateVideoDuration(asset.duration)) {
        return;
      }
      await extractKeyframesFromVideo(asset.uri, dur);
    }
  };

  // Pick Multiple Sequential Photos (2-4 photos)
  const handlePickPhotos = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permission to access photos is required.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });

    if (!picked.canceled && picked.assets && picked.assets.length > 0) {
      const uris = picked.assets.map((a) => a.uri);
      setThumbnails(uris);
      setVideoUri(null);
      setGifUri(null);
      setPreviewPoses(null);
      setStep("keyframes");
    }
  };

  // Robust Keyframe Extractor using expo-video-thumbnails
  const extractKeyframesFromVideo = async (uri: string, durationSec: number | null) => {
    setVideoUri(uri);
    setThumbnails([]);
    setGifUri(null);
    setPreviewPoses(null);
    setError(null);
    setLoading(true);

    try {
      const totalDurMs = durationSec ? Math.min(durationSec * 1000, 10000) : 4000;
      // Extract 3 points: Setup (300ms), Stretch (50% mark), Contraction (85% mark)
      const targetTimeMs = [
        300,
        Math.max(800, Math.floor(totalDurMs * 0.5)),
        Math.max(1500, Math.floor(totalDurMs * 0.85)),
      ];

      const extracted: string[] = [];

      for (const timeMs of targetTimeMs) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
            time: timeMs,
            quality: 0.8,
          });

          if (thumb && typeof thumb.uri === "string") {
            const manip = await ImageManipulator.manipulateAsync(
              thumb.uri,
              [{ resize: { width: 480 } }],
              { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
            );
            extracted.push(manip.uri);
          }
        } catch (thumbErr) {
          console.warn(`Thumbnail at ${timeMs}ms failed`, thumbErr);
        }
      }

      if (extracted.length === 0) {
        // Fallback: try 0ms
        const single = await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.8 });
        if (single?.uri) extracted.push(single.uri);
      }

      if (extracted.length === 0) {
        throw new Error("Could not extract video keyframes. Please try picking 2–4 sequential photos instead.");
      }

      setThumbnails(extracted);
      setStep("keyframes");
    } catch (err) {
      console.error("Keyframe extraction failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to extract keyframes. Please ensure video is under 10s and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Run AI Figurine Synthesis
  // Smart On-Device Kinematic Inferencer (Fallback when backend AI is offline or unreachable)
  const inferLocalExercise = () => {
    const cleanHints = hints.trim();
    let inferredName = "Custom Exercise";
    let inferredEquip = "Free Weight";
    let inferredCategory = "other";
    let inferredMuscles = ["chest"];

    if (cleanHints.length > 0) {
      inferredName = cleanHints.split(",")[0].trim();
      const lower = cleanHints.toLowerCase();
      if (lower.includes("machine") || lower.includes("pendulum") || lower.includes("smith") || lower.includes("hack")) {
        inferredEquip = "Machine";
        inferredCategory = "machine";
      } else if (lower.includes("cable") || lower.includes("pulley") || lower.includes("lat pulldown")) {
        inferredEquip = "Cable";
        inferredCategory = "cable";
      } else if (lower.includes("dumbbell") || lower.includes("db")) {
        inferredEquip = "Dumbbell";
        inferredCategory = "dumbbell";
      } else if (lower.includes("barbell") || lower.includes("bb") || lower.includes("squat") || lower.includes("bench")) {
        inferredEquip = "Barbell";
        inferredCategory = "barbell";
      } else if (lower.includes("pull-up") || lower.includes("push-up") || lower.includes("dip") || lower.includes("body")) {
        inferredEquip = "Body Only";
        inferredCategory = "body only";
      }


      if (lower.includes("chest") || lower.includes("bench") || lower.includes("push")) {
        inferredMuscles = ["chest", "triceps"];
      } else if (lower.includes("leg") || lower.includes("squat") || lower.includes("quad")) {
        inferredMuscles = ["quadriceps", "glutes"];
      } else if (lower.includes("back") || lower.includes("row") || lower.includes("pull")) {
        inferredMuscles = ["lats", "biceps"];
      } else if (lower.includes("shoulder") || lower.includes("delt")) {
        inferredMuscles = ["shoulders"];
      } else if (lower.includes("arm") || lower.includes("bicep") || lower.includes("curl")) {
        inferredMuscles = ["biceps"];
      }
    }

    const appType: SkeletalPose["apparatusType"] =

      inferredCategory === "barbell"
        ? "barbell"
        : inferredCategory === "dumbbell"
        ? "dumbbell"
        : inferredCategory === "cable"
        ? "cable"
        : inferredCategory === "machine"
        ? "machine"
        : inferredCategory === "body only"
        ? "body"
        : "other";

    const isLowerBody = inferredMuscles.some((m) =>
      m.includes("quad") || m.includes("glute") || m.includes("leg") || m.includes("calf")
    );

    const poses: SkeletalPose[] = isLowerBody
      ? [
          {
            joints: {
              head: { x: 0.5, y: 0.18 },
              neck: { x: 0.5, y: 0.25 },
              leftShoulder: { x: 0.44, y: 0.27 },
              rightShoulder: { x: 0.56, y: 0.27 },
              leftElbow: { x: 0.42, y: 0.36 },
              rightElbow: { x: 0.58, y: 0.36 },
              leftWrist: { x: 0.44, y: 0.3 },
              rightWrist: { x: 0.56, y: 0.3 },
              spine: { x: 0.5, y: 0.4 },
              hip: { x: 0.5, y: 0.52 },
              leftKnee: { x: 0.48, y: 0.7 },
              rightKnee: { x: 0.52, y: 0.7 },
              leftAnkle: { x: 0.48, y: 0.9 },
              rightAnkle: { x: 0.52, y: 0.9 },
              apparatusStart: { x: 0.3, y: 0.28 },
              apparatusEnd: { x: 0.7, y: 0.28 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
          {
            joints: {
              head: { x: 0.5, y: 0.3 },
              neck: { x: 0.5, y: 0.37 },
              leftShoulder: { x: 0.44, y: 0.39 },
              rightShoulder: { x: 0.56, y: 0.39 },
              leftElbow: { x: 0.42, y: 0.48 },
              rightElbow: { x: 0.58, y: 0.48 },
              leftWrist: { x: 0.44, y: 0.42 },
              rightWrist: { x: 0.56, y: 0.42 },
              spine: { x: 0.5, y: 0.5 },
              hip: { x: 0.5, y: 0.68 },
              leftKnee: { x: 0.38, y: 0.7 },
              rightKnee: { x: 0.62, y: 0.7 },
              leftAnkle: { x: 0.46, y: 0.9 },
              rightAnkle: { x: 0.54, y: 0.9 },
              apparatusStart: { x: 0.3, y: 0.4 },
              apparatusEnd: { x: 0.7, y: 0.4 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
          {
            joints: {
              head: { x: 0.5, y: 0.16 },
              neck: { x: 0.5, y: 0.23 },
              leftShoulder: { x: 0.44, y: 0.25 },
              rightShoulder: { x: 0.56, y: 0.25 },
              leftElbow: { x: 0.42, y: 0.34 },
              rightElbow: { x: 0.58, y: 0.34 },
              leftWrist: { x: 0.44, y: 0.28 },
              rightWrist: { x: 0.56, y: 0.28 },
              spine: { x: 0.5, y: 0.38 },
              hip: { x: 0.5, y: 0.5 },
              leftKnee: { x: 0.48, y: 0.69 },
              rightKnee: { x: 0.52, y: 0.69 },
              leftAnkle: { x: 0.48, y: 0.9 },
              rightAnkle: { x: 0.52, y: 0.9 },
              apparatusStart: { x: 0.3, y: 0.26 },
              apparatusEnd: { x: 0.7, y: 0.26 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
        ]
      : [
          {
            joints: {
              head: { x: 0.5, y: 0.18 },
              neck: { x: 0.5, y: 0.26 },
              leftShoulder: { x: 0.44, y: 0.28 },
              rightShoulder: { x: 0.56, y: 0.28 },
              leftElbow: { x: 0.42, y: 0.4 },
              rightElbow: { x: 0.58, y: 0.4 },
              leftWrist: { x: 0.44, y: 0.52 },
              rightWrist: { x: 0.56, y: 0.52 },
              spine: { x: 0.5, y: 0.42 },
              hip: { x: 0.5, y: 0.54 },
              leftKnee: { x: 0.48, y: 0.72 },
              rightKnee: { x: 0.52, y: 0.72 },
              leftAnkle: { x: 0.48, y: 0.9 },
              rightAnkle: { x: 0.52, y: 0.9 },
              apparatusStart: { x: 0.35, y: 0.52 },
              apparatusEnd: { x: 0.65, y: 0.52 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
          {
            joints: {
              head: { x: 0.5, y: 0.2 },
              neck: { x: 0.5, y: 0.28 },
              leftShoulder: { x: 0.44, y: 0.3 },
              rightShoulder: { x: 0.56, y: 0.3 },
              leftElbow: { x: 0.34, y: 0.46 },
              rightElbow: { x: 0.66, y: 0.46 },
              leftWrist: { x: 0.42, y: 0.4 },
              rightWrist: { x: 0.58, y: 0.4 },
              spine: { x: 0.5, y: 0.44 },
              hip: { x: 0.5, y: 0.56 },
              leftKnee: { x: 0.48, y: 0.72 },
              rightKnee: { x: 0.52, y: 0.72 },
              leftAnkle: { x: 0.48, y: 0.9 },
              rightAnkle: { x: 0.52, y: 0.9 },
              apparatusStart: { x: 0.3, y: 0.4 },
              apparatusEnd: { x: 0.7, y: 0.4 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
          {
            joints: {
              head: { x: 0.5, y: 0.16 },
              neck: { x: 0.5, y: 0.24 },
              leftShoulder: { x: 0.44, y: 0.26 },
              rightShoulder: { x: 0.56, y: 0.26 },
              leftElbow: { x: 0.44, y: 0.28 },
              rightElbow: { x: 0.56, y: 0.28 },
              leftWrist: { x: 0.46, y: 0.14 },
              rightWrist: { x: 0.54, y: 0.14 },
              spine: { x: 0.5, y: 0.4 },
              hip: { x: 0.5, y: 0.52 },
              leftKnee: { x: 0.48, y: 0.72 },
              rightKnee: { x: 0.52, y: 0.72 },
              leftAnkle: { x: 0.48, y: 0.9 },
              rightAnkle: { x: 0.52, y: 0.9 },
              apparatusStart: { x: 0.32, y: 0.14 },
              apparatusEnd: { x: 0.68, y: 0.14 },
            },
            apparatusType: appType,
            primaryMuscles: inferredMuscles,
          },
        ];

    const generatedSvgs = poses.map((p) => renderStickFigureSvg(p));

    return {
      id: `custom_${Date.now()}`,
      name: inferredName,
      equipment: inferredEquip,
      parentCategory: inferredCategory,
      primaryMuscles: inferredMuscles,
      secondaryMuscles: ["core"],
      cues: [
        "Set up with stable posture and tight core.",
        "Control the eccentric stretch smoothly.",
        "Drive through full range of motion to peak contraction.",
      ],
      animationFrames: generatedSvgs,
      poses,
    };
  };


  // Export real video frames as an animated GIF (even sampling across full clip)
  const handleExportGif = async () => {
    if (!videoUri) {
      setError("Pick a video first to export a motion GIF.");
      return;
    }
    if (!videoDuration || videoDuration <= 0) {
      setError("Could not read the video duration.");
      return;
    }
    setGifExporting(true);
    setError(null);
    try {
      const durationMs = videoDuration * 1000;

      // Pass 1: measure aspect from the first frame so output dims are exact.
      const firstThumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1 });
      const firstManip = await ImageManipulator.manipulateAsync(
        firstThumb.uri,
        [{ resize: { width: 320 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85, base64: true }
      );
      if (!firstManip.base64 || !firstManip.width || !firstManip.height) {
        throw new Error("Could not decode the first video frame.");
      }
      const firstDecoded = decodeJpeg(base64ToBytes(firstManip.base64), { useTArray: true });

      const plan = computeGifPlan(durationMs, {
        aspectRatio: firstDecoded.width / firstDecoded.height,
      });

      // Pass 2: evenly sample the full clip (segment centers), preserving order.
      // The pass-1 probe frame is aspect measurement only — every output frame
      // comes from plan.sampleTimesMs, starting at index 0.
      const frames: RgbaFrame[] = [];
      for (let i = 0; i < plan.sampleTimesMs.length; i++) {
        const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: plan.sampleTimesMs[i],
        });
        const manip = await ImageManipulator.manipulateAsync(
          thumb.uri,
          [{ resize: { width: 320 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85, base64: true }
        );
        if (!manip.base64) throw new Error(`Could not decode frame ${i + 1}.`);
        const decoded = decodeJpeg(base64ToBytes(manip.base64), { useTArray: true });
        frames.push({
          data: resizeRgbaBilinear(
            decoded.data as Uint8Array,
            decoded.width,
            decoded.height,
            plan.width,
            plan.height
          ),
          width: plan.width,
          height: plan.height,
        });
      }

      const gifBytes = encodeGif(frames, plan.frameDelayMs);

      const dir = `${FileSystem.documentDirectory}exercise_gifs/`;
      const dirInfo = await FileSystem.getInfoAsync(dir).catch(() => null);
      if (!dirInfo?.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      const outPath = `${dir}gif_${Date.now()}.gif`;
      await FileSystem.writeAsStringAsync(outPath, bytesToBase64(gifBytes), {
        encoding: FileSystem.EncodingType.Base64,
      });

      setGifUri(outPath);
      // GIF path skips AI synthesis: seed the editable metadata from hints.
      if (!name.trim() && hints.trim()) {
        setName(hints.split(",")[0].trim());
      }
      setStep("preview");
    } catch (err) {
      console.error("GIF export failed", err);
      setError("Could not export the motion GIF. Try a shorter clip or the 2D demo instead.");
    } finally {
      setGifExporting(false);
    }
  };


  // Run AI Figurine Synthesis with Resilient Fallback
  const handleRunAiAnalysis = async () => {
    if (thumbnails.length === 0) return;
    setStep("processing");
    setLoading(true);
    setError(null);
    setProcessingStage(1);

    try {
      const base64Frames = await Promise.all(
        thumbnails.map(async (uri) => {
          try {
            const manip = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: 480 } }],
              { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true }
            );
            if (manip.base64) {
              return `data:image/jpeg;base64,${manip.base64}`;
            }
          } catch {}

          try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return `data:image/jpeg;base64,${base64}`;
          } catch {}

          return uri;
        })
      );


      setProcessingStage(2);

      let exerciseData: any = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${apiUrl}/api/ai/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          },
          body: JSON.stringify({
            frames: base64Frames,
            hints: hints.trim().length > 0 ? hints.trim() : undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          exerciseData = json.data;
        } else {
          const errJson = await response.json().catch(() => null);
          console.warn("Backend AI returned status:", response.status, errJson);
          exerciseData = inferLocalExercise();
        }
      } catch (fetchErr) {
        console.warn("Backend AI fetch failed, activating on-device kinematic fallback:", fetchErr);
        exerciseData = inferLocalExercise();
      }

      setProcessingStage(3);

      if (!exerciseData) {
        exerciseData = inferLocalExercise();
      }

      setExerciseId(exerciseData.id);
      setName(exerciseData.name || "Custom Movement");
      setEquipment(exerciseData.equipment || "Free Weight");
      setParentCategory(exerciseData.parentCategory || "other");
      setPrimaryMuscles(Array.isArray(exerciseData.primaryMuscles) ? exerciseData.primaryMuscles : ["chest"]);
      setSecondaryMuscles(Array.isArray(exerciseData.secondaryMuscles) ? exerciseData.secondaryMuscles : []);
      setCues(Array.isArray(exerciseData.cues) ? exerciseData.cues : []);

      const frames = Array.isArray(exerciseData.animationFrames) && exerciseData.animationFrames.length > 0
        ? exerciseData.animationFrames
        : exerciseData.imageUrl
        ? [exerciseData.imageUrl]
        : thumbnails;
      setAnimationFrames(frames);
      // Local fallback carries poses for the unified vector renderer;
      // backend AI frames are SVG strings rendered inline.
      setPreviewPoses(
        Array.isArray(exerciseData.poses) && exerciseData.poses.length > 0
          ? exerciseData.poses
          : null
      );

      setStep("preview");
    } catch (err) {
      console.error("AI Analysis error:", err);
      // Even on unexpected error, activate fallback so user can proceed
      const fallback = inferLocalExercise();
      setExerciseId(fallback.id);
      setName(fallback.name);
      setEquipment(fallback.equipment);
      setParentCategory(fallback.parentCategory);
      setPrimaryMuscles(fallback.primaryMuscles);
      setSecondaryMuscles(fallback.secondaryMuscles);
      setCues(fallback.cues);
      setAnimationFrames(fallback.animationFrames);
      setPreviewPoses(fallback.poses ?? null);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };


  // Save Finalized Exercise to Database
  const handleSaveExercise = async () => {
    if (!name.trim()) {
      setError("Please provide an exercise name.");
      return;
    }

    setLoading(true);
    try {
      const now = Date.now();
      const finalName = name.trim();
      const finalEquipment = equipment.trim() || null;
      const movementGroup = findMovementGroup(finalName);
      const row: Exercise = {
        id: exerciseId || `custom_${now}`,
        name: finalName,
        equipment: finalEquipment,
        primaryMuscles,
        secondaryMuscles,
        cues,
        // Real motion GIF wins; vector-demo customs need no imageUrl;
        // backend-AI SVG frames keep legacy storage.
        imageUrl: gifUri ?? (previewPoses ? null : animationFrames[0] ?? null),
        movementGroup,
        variantLabel: movementGroup
          ? deriveVariantLabel(finalName, finalEquipment, movementGroup)
          : null,
        trackingMode: "bilateral",
        source: "community",
        visibility: "private",
        reviewStatus: "pending",
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        clientTimestamp: now,
        isDeleted: false,
      };

      await upsertExercise(row);
      onImported?.(row);
      setStep("saved");
    } catch (err) {
      console.error("Failed to save exercise", err);
      setError("Failed to save exercise locally.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-2">
      {/* Error Alert */}
      {error && (
        <View className="mb-4 rounded-2xl bg-red-950/70 p-4 border border-red-800">
          <View className="flex-row items-center gap-2.5 mb-1">
            <AlertCircle size={20} color="#EF4444" />
            <Text className="text-xs font-bold text-red-300">Video Requirement</Text>
          </View>
          <Text className="text-xs text-red-200 leading-relaxed">{error}</Text>
        </View>
      )}

      {/* STEP 1: Input Selection Screen */}
      {step === "input" && (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Instruction Card */}
          <View className="mb-4 rounded-3xl bg-gray-900/90 p-5 border border-gray-800">
            <View className="flex-row items-center gap-2.5 mb-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-500/30">
                <Sparkles size={18} color="#38BDF8" />
              </View>
              <Text className="text-lg font-black text-white">AI Figurine Creator</Text>
            </View>
            <Text className="text-xs text-gray-400 leading-relaxed mb-3">
              Upload a short clip or photos of any movement. AI will analyze the motion kinematics and synthesize a matching 2D vector mannequin demonstration.
            </Text>

            {/* 10-Second Clipping Prompt Banner */}
            <View className="flex-row items-center gap-2.5 rounded-2xl bg-sky-950/40 p-3 border border-sky-500/30">
              <Clock size={16} color="#38BDF8" />
              <Text className="flex-1 text-[11px] font-bold text-sky-300">
                Limit video to ~5–10s showing 1 full rep from start to finish.
              </Text>
            </View>
          </View>

          {/* Action Cards */}
          <View className="gap-3 mb-6">
            <TouchableOpacity
              testID="btn-record-video"
              onPress={handleRecordVideo}
              activeOpacity={0.8}
              className="flex-row items-center gap-4 rounded-2xl bg-gray-900 p-4 border border-gray-800 shadow-sm"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20">
                <Camera size={24} color="#38BDF8" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Record Video Clip</Text>
                <Text className="text-xs text-gray-400">Capture 3–10 seconds with camera (1 rep)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-upload-video"
              onPress={handlePickVideo}
              activeOpacity={0.8}
              className="flex-row items-center gap-4 rounded-2xl bg-gray-900 p-4 border border-gray-800 shadow-sm"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <Upload size={24} color="#C084FC" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Upload Short Video</Text>
                <Text className="text-xs text-gray-400">Select a clipped video under 10 seconds</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-pick-photos"
              onPress={handlePickPhotos}
              activeOpacity={0.8}
              className="flex-row items-center gap-4 rounded-2xl bg-gray-900 p-4 border border-gray-800 shadow-sm"
            >
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Images size={24} color="#34D399" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Pick 2–4 Sequential Photos</Text>
                <Text className="text-xs text-gray-400">Setup, bottom stretch, & lockout photos</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* STEP 2: Keyframe Curation Screen */}
      {step === "keyframes" && (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm font-black text-white">Review Motion Phases</Text>
            {videoDuration && (
              <View className="flex-row items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5">
                <Clock size={10} color="#9CA3AF" />
                <Text className="text-[10px] font-bold text-gray-400">{videoDuration.toFixed(1)}s clip</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Extracted keyframes representing Setup, Stretch, and Contraction.
          </Text>

          {/* Phase Keyframe Grid */}
          <View className="gap-3 mb-5">
            {thumbnails.map((uri, index) => {
              const phase = PHASES[index] ?? {
                label: `Phase ${index + 1}`,
                badge: `Step ${index + 1}`,
                description: "Motion inflection point",
              };

              return (
                <View
                  key={index}
                  className="flex-row items-center gap-3 rounded-2xl bg-gray-900 p-3 border border-gray-800"
                >
                  <Image
                    source={{ uri }}
                    style={{ width: 80, height: 80, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="rounded-full bg-sky-500/20 px-2 py-0.5 border border-sky-500/30">
                        <Text className="text-[10px] font-black text-sky-400 uppercase">
                          {phase.badge}
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-white">{phase.label}</Text>
                    </View>
                    <Text className="text-[11px] text-gray-400">{phase.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Optional Movement Hints */}
          <View className="mb-6 rounded-2xl bg-gray-900 p-4 border border-gray-800">
            <Text className="text-xs font-bold text-gray-300 mb-1.5">
              Equipment or Technique Notes (Optional)
            </Text>
            <TextInput
              value={hints}
              onChangeText={setHints}
              placeholder="e.g. Landmine attachment, Pendulum machine, focus on rear delts"
              placeholderTextColor="#64748B"
              className="rounded-xl bg-gray-950 px-3.5 py-2.5 text-xs text-white border border-gray-800"
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-3 pb-8">
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setStep("input")}
                activeOpacity={0.8}
                className="flex-1 items-center justify-center rounded-2xl bg-gray-900 py-3.5 border border-gray-800"
              >
                <Text className="text-xs font-bold text-gray-300">Choose Different</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="btn-generate-ai"
                onPress={handleRunAiAnalysis}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-sky-500 py-3.5 shadow-lg shadow-sky-500/30"
              >
                <Sparkles size={16} color="white" />
                <Text className="text-xs font-black text-white">Synthesize 2D Demo</Text>
              </TouchableOpacity>
            </View>

            {videoUri && (
              <TouchableOpacity
                testID="btn-export-gif"
                onPress={handleExportGif}
                disabled={gifExporting}
                activeOpacity={0.8}
                className={`flex-row items-center justify-center gap-2 rounded-2xl py-3.5 border ${
                  gifExporting
                    ? "bg-gray-900 border-gray-800"
                    : "bg-emerald-500/15 border-emerald-500/40"
                }`}
              >
                {gifExporting ? (
                  <ActivityIndicator size="small" color="#34D399" />
                ) : (
                  <Film size={16} color="#34D399" />
                )}
                <Text className="text-xs font-black text-emerald-300">
                  {gifExporting ? "Exporting Motion GIF…" : "Export Motion GIF"}
                </Text>
              </TouchableOpacity>
            )}
            {videoUri && (
              <Text className="text-[11px] text-gray-500 text-center -mt-1">
                Samples 10 frames evenly across the full clip into a looping GIF.
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* STEP 3: AI Processing State */}
      {step === "processing" && (
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/20 border border-sky-500/40 mb-6">
            <ActivityIndicator size="large" color="#38BDF8" />
          </View>
          <Text className="text-base font-black text-white mb-2">AI Figurine Synthesis</Text>
          <Text className="text-xs text-gray-400 text-center mb-8">
            Analyzing video kinematics and rendering matching 2D vector mannequin demonstration...
          </Text>

          {/* Progress Milestones */}
          <View className="w-full gap-3">
            <View
              className={`flex-row items-center gap-3 rounded-2xl p-3.5 border ${
                processingStage >= 1
                  ? "bg-sky-950/40 border-sky-500/40"
                  : "bg-gray-900/40 border-gray-800"
              }`}
            >
              <CheckCircle2
                size={18}
                color={processingStage >= 1 ? "#38BDF8" : "#475569"}
              />
              <Text
                className={`text-xs font-bold ${
                  processingStage >= 1 ? "text-sky-300" : "text-gray-500"
                }`}
              >
                1. Kinematic Vision & Joint Angle Extraction
              </Text>
            </View>

            <View
              className={`flex-row items-center gap-3 rounded-2xl p-3.5 border ${
                processingStage >= 2
                  ? "bg-sky-950/40 border-sky-500/40"
                  : "bg-gray-900/40 border-gray-800"
              }`}
            >
              <CheckCircle2
                size={18}
                color={processingStage >= 2 ? "#38BDF8" : "#475569"}
              />
              <Text
                className={`text-xs font-bold ${
                  processingStage >= 2 ? "text-sky-300" : "text-gray-500"
                }`}
              >
                2. Apparatus & Target Muscle Identification
              </Text>
            </View>

            <View
              className={`flex-row items-center gap-3 rounded-2xl p-3.5 border ${
                processingStage >= 3
                  ? "bg-sky-950/40 border-sky-500/40"
                  : "bg-gray-900/40 border-gray-800"
              }`}
            >
              <CheckCircle2
                size={18}
                color={processingStage >= 3 ? "#38BDF8" : "#475569"}
              />
              <Text
                className={`text-xs font-bold ${
                  processingStage >= 3 ? "text-sky-300" : "text-gray-500"
                }`}
              >
                3. 2D Vector Figurine Demonstration Rendering
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* STEP 4: Interactive Demonstration Preview & Quick Edit */}
      {step === "preview" && (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Top Looping Demonstration Hero */}
          <View className="mb-5 overflow-hidden rounded-3xl bg-gray-900 border border-gray-800">
            <View className="h-56 w-full items-center justify-center bg-[#0B0F19]">
              {gifUri ? (
                <Image
                  source={{ uri: gifUri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              ) : previewPoses && previewPoses.length > 0 ? (
                <SegmentedFigurine customPoses={previewPoses} size={224} />
              ) : animationFrames.length > 0 ? (
                (() => {
                  const frame = animationFrames[activeFrameIndex];
                  const svg = decodeSvgFrame(frame);
                  if (svg) {
                    return <SvgXml xml={svg} width="100%" height="100%" />;
                  }
                  if (frame) {
                    return (
                      <Image
                        source={{ uri: frame }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                      />
                    );
                  }
                  return <Dumbbell size={48} color="#64748B" />;
                })()
              ) : (
                <Dumbbell size={48} color="#64748B" />
              )}


              {/* Looping Badge Indicator */}
              <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 border border-gray-700">
                <Play size={10} color="#38BDF8" fill="#38BDF8" />
                <Text className="text-[10px] font-black text-sky-400">
                  {gifUri
                    ? "Motion GIF"
                    : previewPoses && previewPoses.length > 0
                    ? "Vector Demo"
                    : `Frame ${activeFrameIndex + 1}/${animationFrames.length}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Edit Form */}
          <View className="gap-4 mb-6">
            {/* Exercise Name */}
            <View className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
              <Text className="text-xs font-bold text-gray-400 mb-1.5">Exercise Name</Text>
              <TextInput
                testID="input-exercise-name"
                value={name}
                onChangeText={setName}
                className="text-base font-black text-white"
                placeholder="Exercise Name"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Equipment & Category */}
            <View className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-gray-400">Equipment</Text>
                <View className="rounded-full bg-sky-500/20 px-2.5 py-0.5 border border-sky-500/30">
                  <Text className="text-[10px] font-black text-sky-400 uppercase">
                    Category: {parentCategory}
                  </Text>
                </View>
              </View>
              <TextInput
                testID="input-exercise-equipment"
                value={equipment}
                onChangeText={setEquipment}
                className="text-sm font-bold text-white"
                placeholder="e.g. Pendulum Squat Machine, Landmine"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Primary Muscles */}
            <View className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
              <Text className="text-xs font-bold text-gray-400 mb-2">Target Muscles</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {primaryMuscles.map((muscle, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 border border-sky-500/40"
                  >
                    <Text className="text-xs font-bold capitalize text-sky-400">{muscle}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setPrimaryMuscles(primaryMuscles.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 size={12} color="#38BDF8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Step-by-Step Form Cues */}
            <View className="rounded-2xl bg-gray-900 p-4 border border-gray-800">
              <Text className="text-xs font-bold text-gray-400 mb-2">Execution Cues</Text>
              {cues.map((cue, idx) => (
                <View key={idx} className="flex-row items-start gap-2 mb-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-gray-800 mt-0.5">
                    <Text className="text-[10px] font-bold text-gray-400">{idx + 1}</Text>
                  </View>
                  <Text className="flex-1 text-xs text-gray-300 leading-relaxed">{cue}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 pb-8">
            <TouchableOpacity
              onPress={() => setStep("keyframes")}
              activeOpacity={0.8}
              className="flex-1 items-center justify-center rounded-2xl bg-gray-900 py-3.5 border border-gray-800"
            >
              <Text className="text-xs font-bold text-gray-300">Regenerate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-save-exercise"
              onPress={handleSaveExercise}
              disabled={loading}
              activeOpacity={0.8}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 shadow-lg shadow-emerald-500/30"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <CheckCircle2 size={16} color="white" />
              )}
              <Text className="text-xs font-black text-white">Save to Library</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* STEP 5: Success & Transition Screen */}
      {step === "saved" && (
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 border border-emerald-500/40 mb-6">
            <CheckCircle2 size={32} color="#34D399" />
          </View>
          <Text className="text-lg font-black text-white mb-2">Exercise Created!</Text>
          <Text className="text-xs text-gray-400 text-center mb-8">
            "{name}" has been saved to your library with its 2D vector demonstration animation.
          </Text>

          <View className="w-full gap-3">
            <TouchableOpacity
              testID="btn-view-exercise"
              onPress={() => router.push(`/exercise/${exerciseId}` as any)}
              activeOpacity={0.8}
              className="w-full items-center justify-center rounded-2xl bg-sky-500 py-3.5 shadow-lg shadow-sky-500/30"
            >
              <Text className="text-xs font-black text-white">View Exercise Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="w-full items-center justify-center rounded-2xl bg-gray-900 py-3.5 border border-gray-800"
            >
              <Text className="text-xs font-bold text-gray-300">Return to Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
