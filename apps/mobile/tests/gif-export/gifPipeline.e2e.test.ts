/**
 * End-to-end motion-fidelity verification for the video → GIF pipeline.
 *
 * Uses a REAL exercise video (pushup.mp4 from samarthify/AI-Fitness-Trainer,
 * the same source as packages/backend/scripts/download-sample-clips.ts).
 * Mirrors the app's VideoImporter.handleExportGif flow exactly:
 *   measure aspect -> computeGifPlan -> evenly sample full clip with ffmpeg
 *   -> jpeg-js decode -> resizeRgbaBilinear -> encodeGif (gifenc)
 * then decodes the GIF with omggif and asserts:
 *   - expected frame count, fixed dimensions, ordered even delays
 *   - genuine consecutive-frame motion (no frozen/duplicated stretches)
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode as decodeJpeg } from "jpeg-js";
import { GifReader } from "omggif";
import {
  computeGifPlan,
  encodeGif,
  resizeRgbaBilinear,
  meanFrameDiff,
  type RgbaFrame,
} from "../../lib/gifExport";

const CLIP_URL =
  "https://raw.githubusercontent.com/samarthify/AI-Fitness-Trainer/master/pushup.mp4";
const WORK_DIR = join(tmpdir(), "fitnessapp-gif-e2e");
const CLIP_PATH = join(WORK_DIR, "pushup.mp4");

async function downloadClip(): Promise<void> {
  mkdirSync(WORK_DIR, { recursive: true });
  if (existsSync(CLIP_PATH) && statSync(CLIP_PATH).size > 1_000_000) {
    console.log(`[e2e] reusing cached clip at ${CLIP_PATH}`);
    return;
  }
  // Node's fetch hangs through this sandbox's egress proxy; curl works.
  console.log(`[e2e] downloading ${CLIP_URL}`);
  execFileSync("curl", ["-L", "--fail", "--retry", "2", "-o", CLIP_PATH, CLIP_URL], {
    stdio: "pipe",
  });
  console.log(`[e2e] downloaded ${statSync(CLIP_PATH).size} bytes to ${CLIP_PATH}`);
}

function ffprobeDurationSec(path: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
    { encoding: "utf8" }
  );
  return parseFloat(out.trim());
}

function extractFrameJpeg(clip: string, timeMs: number, outPath: string): void {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-ss",
      (timeMs / 1000).toFixed(3),
      "-i",
      clip,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outPath,
    ],
    { stdio: "pipe" }
  );
}

describe("video -> GIF pipeline (real exercise video)", () => {
  it(
    "encodes an animated GIF with faithful motion reproduction",
    async () => {
      await downloadClip();
      const durationSec = ffprobeDurationSec(CLIP_PATH);
      expect(durationSec).toBeGreaterThan(0);

      // Pass 1 (mirrors app): measure aspect from the first frame.
      const probePath = join(WORK_DIR, "probe.jpg");
      extractFrameJpeg(CLIP_PATH, 1, probePath);
      const probe = decodeJpeg(readFileSync(probePath), { useTArray: true });

      const plan = computeGifPlan(durationSec * 1000, {
        aspectRatio: probe.width / probe.height,
      });

      // The 16s pushup clip must be clamped to the 10s the app supports.
      expect(plan.clampedDurationMs).toBe(10_000);
      expect(plan.frameCount).toBe(10);
      expect(plan.sampleTimesMs).toHaveLength(10);

      // Pass 2: evenly sample the FULL (clamped) clip — segment centers.
      const frames: RgbaFrame[] = [];
      for (let i = 0; i < plan.sampleTimesMs.length; i++) {
        const jpgPath = join(WORK_DIR, `frame_${i}.jpg`);
        extractFrameJpeg(CLIP_PATH, plan.sampleTimesMs[i], jpgPath);
        const decoded = decodeJpeg(readFileSync(jpgPath), { useTArray: true });
        expect(decoded.width).toBeGreaterThan(0);
        frames.push({
          data: resizeRgbaBilinear(
            decoded.data,
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
      const gifPath = join(WORK_DIR, "pushup_test.gif");
      writeFileSync(gifPath, gifBytes);
      console.log(
        `GIF: ${gifBytes.length} bytes, ${plan.frameCount} frames, ` +
          `${plan.width}x${plan.height}, delay ${plan.frameDelayMs}ms`
      );

      // ---- Decode and verify ----
      expect(String.fromCharCode(...gifBytes.slice(0, 6))).toBe("GIF89a");
      const reader = new GifReader(gifBytes);

      // Frame count
      expect(reader.numFrames()).toBe(plan.frameCount);
      // Fixed dimensions
      expect(reader.width).toBe(plan.width);
      expect(reader.height).toBe(plan.height);

      // Ordered, even delays matching the source time slices
      const expectedDelayCs = Math.round(plan.frameDelayMs / 10);
      let totalDelayCs = 0;
      const decodedFrames: RgbaFrame[] = [];
      for (let i = 0; i < reader.numFrames(); i++) {
        const info = reader.frameInfo(i);
        expect(info.delay).toBe(expectedDelayCs);
        totalDelayCs += info.delay;
        const rgba = Buffer.alloc(reader.width * reader.height * 4);
        reader.decodeAndBlitFrameRGBA(i, rgba);
        decodedFrames.push({
          data: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length),
          width: reader.width,
          height: reader.height,
        });
      }
      // Total playback time matches the sampled clip duration (±10%)
      expect(totalDelayCs * 10).toBeGreaterThan(plan.clampedDurationMs * 0.9);
      expect(totalDelayCs * 10).toBeLessThan(plan.clampedDurationMs * 1.1);

      // Genuine consecutive-frame motion: every neighboring pair must differ
      // enough to prove real movement (pushup frames 1s apart move a lot).
      const diffs: number[] = [];
      for (let i = 1; i < decodedFrames.length; i++) {
        const d = meanFrameDiff(decodedFrames[i - 1], decodedFrames[i]);
        diffs.push(d);
        expect(d).toBeGreaterThan(1.5);
      }
      console.log(
        "consecutive frame diffs:",
        diffs.map((d) => d.toFixed(2)).join(", ")
      );

      // No long frozen/duplicated stretches (max 1 near-identical pair in a row)
      let frozenRun = 0;
      let maxFrozenRun = 0;
      for (const d of diffs) {
        frozenRun = d < 1.0 ? frozenRun + 1 : 0;
        maxFrozenRun = Math.max(maxFrozenRun, frozenRun);
      }
      expect(maxFrozenRun).toBeLessThanOrEqual(1);

      // The GIF is not a single static image repeated: first vs last differ.
      expect(
        meanFrameDiff(decodedFrames[0], decodedFrames[decodedFrames.length - 1])
      ).toBeGreaterThan(1.5);
    },
    180_000
  );
});
