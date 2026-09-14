import fs from "node:fs";
import path from "node:path";
import { renderStickFigureSvg, SkeletalPose } from "../src/utils/stickFigureRenderer";

interface TestMovement {
  name: string;
  equipment: string;
  category: "barbell" | "dumbbell" | "cable" | "machine" | "body";
  primaryMuscles: string[];
  phases: {
    setup: SkeletalPose;
    stretch: SkeletalPose;
    contraction: SkeletalPose;
  };
}

const TEST_MOVEMENTS: TestMovement[] = [
  {
    name: "Barbell Back Squat",
    equipment: "Barbell",
    category: "barbell",
    primaryMuscles: ["quadriceps", "glutes"],
    phases: {
      setup: {
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
          apparatusStart: { x: 0.28, y: 0.28 },
          apparatusEnd: { x: 0.72, y: 0.28 },
        },
        apparatusType: "barbell",
        primaryMuscles: ["quadriceps", "glutes"],
      },
      stretch: {
        joints: {
          head: { x: 0.5, y: 0.32 },
          neck: { x: 0.5, y: 0.39 },
          leftShoulder: { x: 0.44, y: 0.41 },
          rightShoulder: { x: 0.56, y: 0.41 },
          leftElbow: { x: 0.42, y: 0.5 },
          rightElbow: { x: 0.58, y: 0.5 },
          leftWrist: { x: 0.44, y: 0.44 },
          rightWrist: { x: 0.56, y: 0.44 },
          spine: { x: 0.5, y: 0.52 },
          hip: { x: 0.5, y: 0.7 },
          leftKnee: { x: 0.36, y: 0.72 },
          rightKnee: { x: 0.64, y: 0.72 },
          leftAnkle: { x: 0.46, y: 0.9 },
          rightAnkle: { x: 0.54, y: 0.9 },
          apparatusStart: { x: 0.28, y: 0.42 },
          apparatusEnd: { x: 0.72, y: 0.42 },
        },
        apparatusType: "barbell",
        primaryMuscles: ["quadriceps", "glutes"],
      },
      contraction: {
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
          apparatusStart: { x: 0.28, y: 0.26 },
          apparatusEnd: { x: 0.72, y: 0.26 },
        },
        apparatusType: "barbell",
        primaryMuscles: ["quadriceps", "glutes"],
      },
    },
  },
  {
    name: "Incline Dumbbell Press",
    equipment: "Dumbbell",
    category: "dumbbell",
    primaryMuscles: ["chest", "triceps", "shoulders"],
    phases: {
      setup: {
        joints: {
          head: { x: 0.5, y: 0.2 },
          neck: { x: 0.5, y: 0.28 },
          leftShoulder: { x: 0.44, y: 0.3 },
          rightShoulder: { x: 0.56, y: 0.3 },
          leftElbow: { x: 0.4, y: 0.42 },
          rightElbow: { x: 0.6, y: 0.42 },
          leftWrist: { x: 0.42, y: 0.52 },
          rightWrist: { x: 0.58, y: 0.52 },
          spine: { x: 0.5, y: 0.44 },
          hip: { x: 0.5, y: 0.56 },
          leftKnee: { x: 0.48, y: 0.72 },
          rightKnee: { x: 0.52, y: 0.72 },
          leftAnkle: { x: 0.48, y: 0.9 },
          rightAnkle: { x: 0.52, y: 0.9 },
        },
        apparatusType: "dumbbell",
        primaryMuscles: ["chest", "triceps", "shoulders"],
      },
      stretch: {
        joints: {
          head: { x: 0.5, y: 0.22 },
          neck: { x: 0.5, y: 0.3 },
          leftShoulder: { x: 0.44, y: 0.32 },
          rightShoulder: { x: 0.56, y: 0.32 },
          leftElbow: { x: 0.32, y: 0.48 },
          rightElbow: { x: 0.68, y: 0.48 },
          leftWrist: { x: 0.38, y: 0.42 },
          rightWrist: { x: 0.62, y: 0.42 },
          spine: { x: 0.5, y: 0.46 },
          hip: { x: 0.5, y: 0.58 },
          leftKnee: { x: 0.48, y: 0.72 },
          rightKnee: { x: 0.52, y: 0.72 },
          leftAnkle: { x: 0.48, y: 0.9 },
          rightAnkle: { x: 0.52, y: 0.9 },
        },
        apparatusType: "dumbbell",
        primaryMuscles: ["chest", "triceps", "shoulders"],
      },
      contraction: {
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
        },
        apparatusType: "dumbbell",
        primaryMuscles: ["chest", "triceps", "shoulders"],
      },
    },
  },
  {
    name: "Lat Pulldown",
    equipment: "Cable",
    category: "cable",
    primaryMuscles: ["lats", "biceps"],
    phases: {
      setup: {
        joints: {
          head: { x: 0.5, y: 0.26 },
          neck: { x: 0.5, y: 0.32 },
          leftShoulder: { x: 0.44, y: 0.34 },
          rightShoulder: { x: 0.56, y: 0.34 },
          leftElbow: { x: 0.42, y: 0.2 },
          rightElbow: { x: 0.58, y: 0.2 },
          leftWrist: { x: 0.38, y: 0.1 },
          rightWrist: { x: 0.62, y: 0.1 },
          spine: { x: 0.5, y: 0.46 },
          hip: { x: 0.5, y: 0.6 },
          leftKnee: { x: 0.48, y: 0.76 },
          rightKnee: { x: 0.52, y: 0.76 },
          leftAnkle: { x: 0.48, y: 0.9 },
          rightAnkle: { x: 0.52, y: 0.9 },
        },
        apparatusType: "cable",
        primaryMuscles: ["lats", "biceps"],
      },
      stretch: {
        joints: {
          head: { x: 0.5, y: 0.24 },
          neck: { x: 0.5, y: 0.3 },
          leftShoulder: { x: 0.44, y: 0.32 },
          rightShoulder: { x: 0.56, y: 0.32 },
          leftElbow: { x: 0.44, y: 0.16 },
          rightElbow: { x: 0.56, y: 0.16 },
          leftWrist: { x: 0.42, y: 0.06 },
          rightWrist: { x: 0.58, y: 0.06 },
          spine: { x: 0.5, y: 0.44 },
          hip: { x: 0.5, y: 0.6 },
          leftKnee: { x: 0.48, y: 0.76 },
          rightKnee: { x: 0.52, y: 0.76 },
          leftAnkle: { x: 0.48, y: 0.9 },
          rightAnkle: { x: 0.52, y: 0.9 },
        },
        apparatusType: "cable",
        primaryMuscles: ["lats", "biceps"],
      },
      contraction: {
        joints: {
          head: { x: 0.5, y: 0.26 },
          neck: { x: 0.5, y: 0.32 },
          leftShoulder: { x: 0.44, y: 0.34 },
          rightShoulder: { x: 0.56, y: 0.34 },
          leftElbow: { x: 0.34, y: 0.46 },
          rightElbow: { x: 0.66, y: 0.46 },
          leftWrist: { x: 0.38, y: 0.36 },
          rightWrist: { x: 0.62, y: 0.36 },
          spine: { x: 0.5, y: 0.46 },
          hip: { x: 0.5, y: 0.6 },
          leftKnee: { x: 0.48, y: 0.76 },
          rightKnee: { x: 0.52, y: 0.76 },
          leftAnkle: { x: 0.48, y: 0.9 },
          rightAnkle: { x: 0.52, y: 0.9 },
        },
        apparatusType: "cable",
        primaryMuscles: ["lats", "biceps"],
      },
    },
  },
];

async function main() {
  const outputDir = path.resolve(process.cwd(), "test-output");
  const svgsDir = path.join(outputDir, "svgs");

  if (!fs.existsSync(svgsDir)) {
    fs.mkdirSync(svgsDir, { recursive: true });
  }

  const generatedList: { name: string; equipment: string; muscles: string[]; frames: string[] }[] = [];

  for (const mov of TEST_MOVEMENTS) {
    const slug = mov.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const frameSvgs = [
      renderStickFigureSvg(mov.phases.setup),
      renderStickFigureSvg(mov.phases.stretch),
      renderStickFigureSvg(mov.phases.contraction),
    ];

    frameSvgs.forEach((svg, idx) => {
      fs.writeFileSync(path.join(svgsDir, `${slug}_frame_${idx}.svg`), svg, "utf-8");
    });

    generatedList.push({
      name: mov.name,
      equipment: mov.equipment,
      muscles: mov.primaryMuscles,
      frames: frameSvgs,
    });
  }

  // Generate interactive HTML preview
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2D Vector Stick Figure Visual Playground</title>
  <style>
    body {
      margin: 0;
      padding: 32px 24px;
      background-color: #030712;
      color: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h1 {
      font-size: 28px;
      font-weight: 900;
      color: #38BDF8;
      margin-bottom: 8px;
    }
    p.subtitle {
      color: #9CA3AF;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
    }
    .card {
      background: #0B0F19;
      border: 1px solid #1E293B;
      border-radius: 20px;
      padding: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .badge {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38BDF8;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .player-container {
      width: 100%;
      height: 280px;
      background: #0B0F19;
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #1E293B;
    }
    .phase-badge {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(0,0,0,0.7);
      border: 1px solid #334155;
      color: #38BDF8;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
    }
    .muscles-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 14px;
    }
    .muscle-tag {
      background: #1E293B;
      color: #94A3B8;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: capitalize;
    }
  </style>
</head>
<body>
  <h1>2D Vector Stick Figure Visual Playground</h1>
  <p class="subtitle">100% synchronized kinematic joint animations with neon glowing target muscles.</p>

  <div class="grid">
    ${generatedList
      .map(
        (item, index) => `
      <div class="card">
        <div class="card-header">
          <span class="title">${item.name}</span>
          <span class="badge">${item.equipment}</span>
        </div>
        <div class="player-container" id="player-${index}">
          ${item.frames[0]}
          <div class="phase-badge" id="badge-${index}">Phase 1: Setup</div>
        </div>
        <div class="muscles-list">
          ${item.muscles.map((m) => `<span class="muscle-tag">${m}</span>`).join("")}
        </div>
      </div>
    `
      )
      .join("")}
  </div>

  <script>
    const data = ${JSON.stringify(generatedList)};
    const phases = ["Phase 1: Setup", "Phase 2: Stretch", "Phase 3: Lockout"];
    const activeIndices = data.map(() => 0);

    setInterval(() => {
      data.forEach((item, i) => {
        activeIndices[i] = (activeIndices[i] + 1) % item.frames.length;
        const player = document.getElementById('player-' + i);
        const badge = document.getElementById('badge-' + i);
        if (player && badge) {
          const currentFrame = item.frames[activeIndices[i]];
          player.innerHTML = currentFrame + '<div class="phase-badge" id="badge-' + i + '">' + phases[activeIndices[i]] + '</div>';
        }
      });
    }, 750);
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "preview.html"), html, "utf-8");
  console.log(`\n✅ Generated 2D Stick Figure SVGs & HTML Preview at:\n   ${path.join(outputDir, "preview.html")}\n`);
}

main().catch(console.error);
