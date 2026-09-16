/**
 * Minimal type declarations for gifenc (ships no bundled types).
 * Covers exactly the API surface used by lib/gifExport.ts.
 */
declare module "gifenc" {
  export type GifencPixelFormat = "rgb565" | "rgb444" | "rgba4444";

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        repeat?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: {
    initialCapacity?: number;
    auto?: boolean;
  }): GifEncoder;

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: GifencPixelFormat }
  ): number[][];

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: GifencPixelFormat
  ): Uint8Array;

  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][]
  ): Uint8Array;

  export function nearestColorIndex(
    palette: number[][],
    pixel: [number, number, number]
  ): number;

  export function nearestColor(
    palette: number[][],
    pixel: [number, number, number]
  ): number[];

  export function nearestColorIndexWithDistance(
    palette: number[][],
    pixel: [number, number, number]
  ): { index: number; distance: number };

  export function colorSnap(
    rgba: number[],
    palette: number[][]
  ): [number, number, number];

  const _default: (opts?: { initialCapacity?: number; auto?: boolean }) => GifEncoder;
  export default _default;
}
