declare module "expo-video-thumbnails" {
  export interface VideoThumbnailOptions {
    compress?: number;
    time?: number;
    quality?: number;
    headers?: Record<string, string>;
  }

  export interface VideoThumbnailResult {
    uri: string;
    width: number;
    height: number;
  }

  export function getThumbnailAsync(
    sourceFilename: string,
    options?: VideoThumbnailOptions
  ): Promise<VideoThumbnailResult>;
}
