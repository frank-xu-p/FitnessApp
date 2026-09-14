import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIPS = [
  {
    name: "squats.mp4",
    url: "https://raw.githubusercontent.com/samarthify/AI-Fitness-Trainer/master/squats.mp4",
  },
  {
    name: "pushup.mp4",
    url: "https://raw.githubusercontent.com/samarthify/AI-Fitness-Trainer/master/pushup.mp4",
  },
  {
    name: "curls.mp4",
    url: "https://raw.githubusercontent.com/samarthify/AI-Fitness-Trainer/master/curls.mp4",
  },
];

async function download() {
  const targetDir = path.resolve(__dirname, "../../../test-clips");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const clip of CLIPS) {
    const dest = path.join(targetDir, clip.name);
    console.log(`Downloading ${clip.name} from ${clip.url}...`);
    try {
      const res = await fetch(clip.url, {
        headers: { "User-Agent": "Mozilla/5.0 FitnessApp-Tester" },
      });
      if (!res.ok) {
        console.warn(`Failed to fetch ${clip.name}: HTTP ${res.status}`);
        continue;
      }
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(buffer));
      console.log(`✅ Saved ${clip.name} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      console.error(`Error downloading ${clip.name}:`, err);
    }
  }
}

download().catch(console.error);
