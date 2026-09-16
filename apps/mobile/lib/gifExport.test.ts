import { describe, it, expect } from "vitest";
import { GifReader } from "omggif";
import {
  computeGifPlan,
  base64ToBytes,
  bytesToBase64,
  resizeRgbaBilinear,
  encodeGif,
  meanFrameDiff,
  GIF_EXPORT_DEFAULTS,
  type RgbaFrame,
} from "./gifExport";

describe("computeGifPlan — even temporal sampling", () => {
  it("distributes sample times evenly across the full duration", () => {
    const plan = computeGifPlan(5000, { frameCount: 10 });
    expect(plan.frameCount).toBe(10);
    expect(plan.sampleTimesMs).toHaveLength(10);
    // Segment centers of 500ms slices over 5000ms
    expect(plan.sampleTimesMs).toEqual([
      250, 750, 1250, 1750, 2250, 2750, 3250, 3750, 4250, 4750,
    ]);
  });

  it("preserves order and covers the full clip", () => {
    const plan = computeGifPlan(8000, { frameCount: 8 });
    const t = plan.sampleTimesMs;
    for (let i = 1; i < t.length; i++) {
      expect(t[i]).toBeGreaterThan(t[i - 1]); // strictly increasing = order preserved
    }
    expect(t[0]).toBeGreaterThan(0);
    expect(t[t.length - 1]).toBeLessThan(plan.clampedDurationMs);
    // Even spacing
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  });

  it("clamps very long clips to 10s and short clips to 1s", () => {
    expect(computeGifPlan(16000).clampedDurationMs).toBe(10_000);
    expect(computeGifPlan(200).clampedDurationMs).toBe(1_000);
    expect(computeGifPlan(0).clampedDurationMs).toBe(1_000);
  });

  it("derives per-frame delay from the time slice, quantized to 10ms", () => {
    // 5000ms / 10 frames = 500ms per frame
    expect(computeGifPlan(5000, { frameCount: 10 }).frameDelayMs).toBe(500);
    // 10000ms / 10 = 1000ms
    expect(computeGifPlan(16000, { frameCount: 10 }).frameDelayMs).toBe(1000);
    // 3333ms / 10 = 333.3 -> quantized to 330
    expect(computeGifPlan(3333, { frameCount: 10 }).frameDelayMs).toBe(330);
  });

  it("computes output dimensions from maxWidth and aspect ratio", () => {
    const plan = computeGifPlan(5000, { maxWidth: 192, aspectRatio: 16 / 9 });
    expect(plan.width).toBe(192);
    expect(plan.height).toBe(108);
  });

  it("defaults to 10 frames", () => {
    expect(computeGifPlan(4000).frameCount).toBe(
      GIF_EXPORT_DEFAULTS.frameCount
    );
  });
});

describe("base64ToBytes", () => {
  it("decodes base64 without Buffer", () => {
    // "Hello" -> SGVsbG8=
    const bytes = base64ToBytes("SGVsbG8=");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("handles unpadded and padded inputs", () => {
    expect(base64ToBytes("TQ==")[0]).toBe(77); // "M"
    expect(Array.from(base64ToBytes("TWFu"))).toEqual([77, 97, 110]); // "Man"
  });
});

describe("bytesToBase64 / base64ToBytes round-trip", () => {
  it("survives a full round-trip", () => {
    const original = new Uint8Array([0, 1, 2, 250, 255, 128, 64, 33, 17]);
    expect(base64ToBytes(bytesToBase64(original))).toEqual(original);
  });
});

describe("resizeRgbaBilinear", () => {
  it("downscales a solid color frame exactly", () => {
    const src = new Uint8ClampedArray(4 * 4 * 4).fill(200);
    const dst = resizeRgbaBilinear(src, 4, 4, 2, 2);
    expect(dst.length).toBe(2 * 2 * 4);
    for (const v of dst) expect(v).toBe(200);
  });

  it("upscales preserving corner colors", () => {
    // 2x1: red | blue
    const src = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const dst = resizeRgbaBilinear(src, 2, 1, 4, 1);
    expect(dst[0]).toBe(255); // left stays red
    expect(dst[(4 - 1) * 4]).toBeLessThan(128); // right end mostly blue
    expect(dst[(4 - 1) * 4 + 2]).toBeGreaterThan(128);
  });
});

describe("encodeGif round-trip", () => {
  const solidFrame = (r: number, g: number, b: number): RgbaFrame => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return { data, width: 8, height: 8 };
  };

  it("produces a decodable GIF with the right frame count, dims and delays", () => {
    const bytes = encodeGif(
      [solidFrame(255, 0, 0), solidFrame(0, 255, 0), solidFrame(0, 0, 255)],
      330
    );
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
    const reader = new GifReader(bytes);
    expect(reader.numFrames()).toBe(3);
    expect(reader.width).toBe(8);
    expect(reader.height).toBe(8);
    for (let i = 0; i < 3; i++) {
      expect(reader.frameInfo(i).delay).toBe(33); // 330ms -> 33 centiseconds
    }
    // Decoded frames preserve the distinct colors (quantization is faithful)
    const first = Buffer.alloc(8 * 8 * 4);
    reader.decodeAndBlitFrameRGBA(0, first);
    expect(first[0]).toBeGreaterThan(200); // red channel dominant
    expect(first[1]).toBeLessThan(60);
  });

  it("rejects empty and mismatched frame sets", () => {
    expect(() => encodeGif([], 100)).toThrow();
    expect(() =>
      encodeGif([solidFrame(0, 0, 0), { ...solidFrame(0, 0, 0), width: 4 }], 100)
    ).toThrow();
  });
});

describe("meanFrameDiff", () => {
  const frame = (v: number): RgbaFrame => ({
    data: new Uint8ClampedArray(4 * 4 * 4).fill(v),
    width: 4,
    height: 4,
  });

  it("returns 0 for identical frames", () => {
    expect(meanFrameDiff(frame(100), frame(100))).toBe(0);
  });

  it("returns > 0 for different frames (motion detected)", () => {
    expect(meanFrameDiff(frame(100), frame(150))).toBeGreaterThan(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() =>
      meanFrameDiff(frame(0), {
        data: new Uint8ClampedArray(9 * 4),
        width: 3,
        height: 3,
      })
    ).toThrow();
  });
});
