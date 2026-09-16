/**
 * Pure, testable GIF export pipeline.
 *
 * Shared between the Expo app (VideoImporter) and Node vitest verification.
 * Everything here is framework-free: no expo-*, no Buffer, no DOM.
 *
 * Motion-fidelity contract (Peigang's hard requirement):
 *  - Frames are sampled across the FULL rep with even temporal distribution
 *    over the clip duration (segment centers), preserving order and relative
 *    timing, so the GIF faithfully replays the motion.
 *  - Each frame's delay equals its time slice (duration / frameCount),
 *    quantized to GIF's 10ms granularity.
 */

export interface RgbaFrame {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface GifPlan {
  /** Clamped clip duration actually covered (ms). */
  clampedDurationMs: number;
  /** Number of frames to sample. */
  frameCount: number;
  /**
   * Evenly distributed sample times (ms), one per equal time segment,
   * taken at each segment's center so the full duration is covered and
   * order/relative timing are preserved.
   */
  sampleTimesMs: number[];
  /** Per-frame GIF delay (ms), quantized to 10ms. */
  frameDelayMs: number;
  width: number;
  height: number;
}

export const GIF_EXPORT_DEFAULTS = {
  frameCount: 10,
  maxWidth: 192,
  maxDurationMs: 10_000,
  minDurationMs: 1_000,
} as const;

/**
 * Compute the sampling plan for a clip of `durationMs`.
 * Even temporal distribution: the clip is split into `frameCount` equal
 * segments and one frame is sampled at each segment's center.
 */
export function computeGifPlan(
  durationMs: number,
  opts?: {
    frameCount?: number;
    maxWidth?: number;
    aspectRatio?: number; // width / height of source frames
  }
): GifPlan {
  const frameCount = Math.max(
    2,
    Math.floor(opts?.frameCount ?? GIF_EXPORT_DEFAULTS.frameCount)
  );
  const clampedDurationMs = Math.min(
    GIF_EXPORT_DEFAULTS.maxDurationMs,
    Math.max(GIF_EXPORT_DEFAULTS.minDurationMs, Math.floor(durationMs) || 0)
  );

  const segmentMs = clampedDurationMs / frameCount;
  const sampleTimesMs: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    // Segment center: covers the full duration, preserves order & timing.
    sampleTimesMs.push(Math.round((i + 0.5) * segmentMs));
  }

  // GIF stores delays in centiseconds: quantize to 10ms.
  const frameDelayMs = Math.max(20, Math.round(segmentMs / 10) * 10);

  const maxWidth = opts?.maxWidth ?? GIF_EXPORT_DEFAULTS.maxWidth;
  const aspect = opts?.aspectRatio && opts.aspectRatio > 0 ? opts.aspectRatio : 16 / 9;
  const width = maxWidth;
  const height = Math.max(2, Math.round(maxWidth / aspect));

  return {
    clampedDurationMs,
    frameCount,
    sampleTimesMs,
    frameDelayMs,
    width,
    height,
  };
}

/** Decode a base64 string to bytes without Node's Buffer (works in Hermes). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  const lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const rev = new Uint8Array(128);
  for (let i = 0; i < lookup.length; i++) rev[lookup.charCodeAt(i)] = i;

  let pad = 0;
  if (clean.endsWith("==")) pad = 2;
  else if (clean.endsWith("=")) pad = 1;
  const outLen = Math.floor((clean.length / 4) * 3) - pad;
  const out = new Uint8Array(outLen);

  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = rev[clean.charCodeAt(i)] ?? 0;
    const b = rev[clean.charCodeAt(i + 1)] ?? 0;
    const c = rev[clean.charCodeAt(i + 2)] ?? 0;
    const d = rev[clean.charCodeAt(i + 3)] ?? 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < outLen) out[o++] = (triple >> 16) & 0xff;
    if (o < outLen) out[o++] = (triple >> 8) & 0xff;
    if (o < outLen) out[o++] = triple & 0xff;
  }
  return out;
}

/** Encode bytes as base64 without Node's Buffer (works in Hermes). */
export function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 0x3f];
    out += chars[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : "=";
    out += i + 2 < bytes.length ? chars[triple & 0x3f] : "=";
  }
  return out;
}

/** Bilinear resize of RGBA data. Pure JS so Node tests exercise the real code. */
export function resizeRgbaBilinear(
  src: Uint8Array | Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return dst;
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const sy = y * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dstW; x++) {
      const sx = x * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;
      const di = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * srcW + x0) * 4 + c];
        const p10 = src[(y0 * srcW + x1) * 4 + c];
        const p01 = src[(y1 * srcW + x0) * 4 + c];
        const p11 = src[(y1 * srcW + x1) * 4 + c];
        dst[di + c] =
          p00 * (1 - fx) * (1 - fy) +
          p10 * fx * (1 - fy) +
          p01 * (1 - fx) * fy +
          p11 * fx * fy;
      }
    }
  }
  return dst;
}

import { GIFEncoder, quantize, applyPalette } from "gifenc";

/**
 * Encode RGBA frames as an animated GIF (local 256-color palette per frame).
 * Pure JS via gifenc — runs in Hermes/Expo Go with no native modules.
 */
export function encodeGif(frames: RgbaFrame[], delayMs: number): Uint8Array {
  if (frames.length === 0) throw new Error("encodeGif requires at least one frame");

  const { width, height } = frames[0];
  const gif = GIFEncoder();
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error("encodeGif: all frames must share dimensions");
    }
    // gifenc packs RGBA bytes to 32-bit internally; hand it a fresh
    // byte-exact copy so its Uint32Array view always aligns.
    const bytes = new Uint8Array(frame.data);
    const palette = quantize(bytes, 256, { format: "rgba4444" });
    const index = applyPalette(bytes, palette, "rgba4444");
    gif.writeFrame(index, width, height, { palette, delay: delayMs });
  }
  gif.finish();
  return gif.bytes();
}

/** Mean absolute per-channel difference between two same-size frames (0-255). */
export function meanFrameDiff(a: RgbaFrame, b: RgbaFrame): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error("meanFrameDiff: dimension mismatch");
  }
  const n = a.width * a.height * 4;
  let sum = 0;
  for (let i = 0; i < n; i += 4) {
    sum +=
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return sum / (n / 4) / 3;
}
