/**
 * Free animated exercise demonstration bundle (317 exercises, male + female
 * 1080p MP4s + poster thumbnails) served from a CDN.
 *
 * Only a subset of the app's exercise catalog has a matching demo video.
 * `assets/data/demo-video-slugs.json` maps app exercise id -> bundle slug for
 * the exercises that matched. Anything without a match keeps the existing
 * mannequin/GIF rendering.
 */

export const DEMO_VIDEO_BASE =
  "https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev";

export type DemoGender = "male" | "female";

type SlugEntry = { slug: string; poster: boolean; female: boolean };
type SlugMap = Record<string, SlugEntry>;

let slugMap: SlugMap | null = null;
function getSlugMap(): SlugMap {
  if (!slugMap) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      slugMap = require("../assets/data/demo-video-slugs.json") as SlugMap;
    } catch {
      slugMap = {};
    }
  }
  return slugMap ?? {};
}

/** Bundle slug for an app exercise id, or null when there is no demo video. */
export function getDemoVideoSlug(exerciseId: string): string | null {
  return getSlugMap()[exerciseId]?.slug ?? null;
}

/** Whether a poster thumbnail exists for this exercise id. */
export function hasDemoPoster(exerciseId: string): boolean {
  return getSlugMap()[exerciseId]?.poster === true;
}

/** Whether a female-model video exists for this exercise id. */
export function hasDemoFemaleVideo(exerciseId: string): boolean {
  return getSlugMap()[exerciseId]?.female === true;
}

export function getDemoVideoUrl(
  slug: string,
  gender: DemoGender = "male",
): string {
  return `${DEMO_VIDEO_BASE}/exercise-videos/${gender}/${slug}.mp4`;
}

export function getDemoPosterUrl(
  slug: string,
  gender: DemoGender = "male",
): string {
  return `${DEMO_VIDEO_BASE}/exercise-posters/${gender}/${slug}.jpg`;
}

const GENDER_KEY = "fitnessapp.demoGender";
let genderCache: DemoGender | null = null;

function getStorage(): {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
} | null {
  try {
    // Lazy require: keeps this module importable in node/vitest without RN.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage")
      .default as {
      getItem(k: string): Promise<string | null>;
      setItem(k: string, v: string): Promise<void>;
    };
  } catch {
    return null;
  }
}

export function getDemoGenderSync(): DemoGender {
  return genderCache ?? "male";
}

export async function getDemoGender(): Promise<DemoGender> {
  if (genderCache) return genderCache;
  try {
    const v = await getStorage()?.getItem(GENDER_KEY);
    genderCache = v === "female" ? "female" : "male";
  } catch {
    genderCache = "male";
  }
  return genderCache;
}

export async function setDemoGender(g: DemoGender): Promise<void> {
  genderCache = g;
  try {
    await getStorage()?.setItem(GENDER_KEY, g);
  } catch {
    // non-fatal
  }
}
