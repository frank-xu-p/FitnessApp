export interface Point {
  x: number;
  y: number;
}

export interface SkeletalPose {
  joints: {
    head?: Point;
    neck?: Point;
    leftShoulder?: Point;
    rightShoulder?: Point;
    leftElbow?: Point;
    rightElbow?: Point;
    leftWrist?: Point;
    rightWrist?: Point;
    
    // BlazePose additions
    leftIndex?: Point;
    rightIndex?: Point;
    leftPinky?: Point;
    rightPinky?: Point;
    leftHeel?: Point;
    rightHeel?: Point;
    leftFootIndex?: Point;
    rightFootIndex?: Point;

    spine?: Point;
    hip?: Point;
    leftKnee?: Point;
    rightKnee?: Point;
    leftAnkle?: Point;
    rightAnkle?: Point;
    
    apparatusStart?: Point;
    apparatusEnd?: Point;
  };
  apparatusType?: "barbell" | "dumbbell" | "cable" | "machine" | "body" | "other";
  primaryMuscles?: string[];
}

/**
 * Normalizes an array of 33 keypoints from MediaPipe BlazePose to our SkeletalPose format.
 */
export function fromBlazePoseKeypoints(keypoints: any[], options?: { apparatusType?: SkeletalPose['apparatusType'], primaryMuscles?: string[] }): SkeletalPose {
  const getPt = (idx: number) => {
    const kp = keypoints[idx];
    if (!kp || kp.score < 0.2) return undefined;
    return { x: kp.x, y: kp.y }; // Assumed already normalized 0.0-1.0 or pixel coordinates
  };

  const joints: SkeletalPose['joints'] = {
    head: getPt(0), // Nose
    leftShoulder: getPt(11),
    rightShoulder: getPt(12),
    leftElbow: getPt(13),
    rightElbow: getPt(14),
    leftWrist: getPt(15),
    rightWrist: getPt(16),
    leftPinky: getPt(17),
    rightPinky: getPt(18),
    leftIndex: getPt(19),
    rightIndex: getPt(20),
    
    // Hips
    leftKnee: getPt(25),
    rightKnee: getPt(26),
    leftAnkle: getPt(27),
    rightAnkle: getPt(28),
    leftHeel: getPt(29),
    rightHeel: getPt(30),
    leftFootIndex: getPt(31),
    rightFootIndex: getPt(32),
  };

  // Derive center points
  if (joints.leftShoulder && joints.rightShoulder) {
    joints.neck = {
      x: (joints.leftShoulder.x + joints.rightShoulder.x) / 2,
      y: (joints.leftShoulder.y + joints.rightShoulder.y) / 2,
    };
  }
  
  const leftHip = getPt(23);
  const rightHip = getPt(24);
  if (leftHip && rightHip) {
    joints.hip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };
  }

  if (joints.neck && joints.hip) {
    joints.spine = {
      x: (joints.neck.x + joints.hip.x) / 2,
      y: (joints.neck.y + joints.hip.y) / 2,
    };
  }

  return {
    joints,
    apparatusType: options?.apparatusType ?? "body",
    primaryMuscles: options?.primaryMuscles ?? []
  };
}

/**
 * Generates a smooth bezier polygon for a muscular segment between two points.
 */
export function buildMuscleSegment(p1: Point | undefined, p2: Point | undefined, w1: number, wMid: number, w2: number, cOut = 0.5, cIn = 0.5): string {
  if (!p1 || !p2) return "";
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const p1Out = { x: p1.x + nx * (w1 / 2), y: p1.y + ny * (w1 / 2) };
  const midOut = { x: midX + nx * (wMid / 2) * cOut, y: midY + ny * (wMid / 2) * cOut };
  const p2Out = { x: p2.x + nx * (w2 / 2), y: p2.y + ny * (w2 / 2) };

  const p2In = { x: p2.x - nx * (w2 / 2), y: p2.y - ny * (w2 / 2) };
  const midIn = { x: midX - nx * (wMid / 2) * cIn, y: midY - ny * (wMid / 2) * cIn };
  const p1In = { x: p1.x - nx * (w1 / 2), y: p1.y - ny * (w1 / 2) };

  return `M ${p1Out.x.toFixed(1)} ${p1Out.y.toFixed(1)} Q ${midOut.x.toFixed(1)} ${midOut.y.toFixed(1)} ${p2Out.x.toFixed(1)} ${p2Out.y.toFixed(1)} L ${p2In.x.toFixed(1)} ${p2In.y.toFixed(1)} Q ${midIn.x.toFixed(1)} ${midIn.y.toFixed(1)} ${p1In.x.toFixed(1)} ${p1In.y.toFixed(1)} Z`;
}

/**
 * Renders a 2D Segmented Muscular Figurine SVG (Style 2.1 - 33-pt BlazePose)
 */
export function renderStickFigureSvg(pose: SkeletalPose, size: number = 400): string {
  const j = pose.joints;
  const toPx = (val: number | undefined, s: number, fallback: number) => 
    val != null ? Math.max(15, Math.min(s - 15, val * (val <= 1.0 ? s : 1))) : fallback;

  // Active muscle groups logic
  const muscles = pose.primaryMuscles || [];
  const isChestActive = muscles.some(m => m.includes("chest") || m.includes("pectoral"));
  const isArmsActive = muscles.some(m => m.includes("bicep") || m.includes("tricep") || m.includes("arm"));
  const isShouldersActive = muscles.some(m => m.includes("shoulder") || m.includes("delt"));
  const isBackActive = muscles.some(m => m.includes("lat") || m.includes("back"));
  const isLegsActive = muscles.some(m => m.includes("quad") || m.includes("glute") || m.includes("leg"));
  const isCoreActive = muscles.some(m => m.includes("ab") || m.includes("core"));

  // Styling palette
  const apparatusColor = "#F59E0B";
  const canvasBg = "#0B0F19";

  // Spine & Core
  const head = { x: toPx(j.head?.x, size, size * 0.5), y: toPx(j.head?.y, size, size * 0.18) };
  const neck = { x: toPx(j.neck?.x, size, head.x), y: toPx(j.neck?.y, size, head.y + size * 0.08) };
  const lShoulder = { x: toPx(j.leftShoulder?.x, size, neck.x - size * 0.08), y: toPx(j.leftShoulder?.y, size, neck.y + size * 0.02) };
  const rShoulder = { x: toPx(j.rightShoulder?.x, size, neck.x + size * 0.08), y: toPx(j.rightShoulder?.y, size, neck.y + size * 0.02) };
  const spine = { x: toPx(j.spine?.x, size, neck.x), y: toPx(j.spine?.y, size, neck.y + size * 0.15) };
  const hip = { x: toPx(j.hip?.x, size, neck.x), y: toPx(j.hip?.y, size, neck.y + size * 0.28) };

  // Arms
  const lElbow = { x: toPx(j.leftElbow?.x, size, lShoulder.x - size * 0.08), y: toPx(j.leftElbow?.y, size, lShoulder.y + size * 0.14) };
  const rElbow = { x: toPx(j.rightElbow?.x, size, rShoulder.x + size * 0.08), y: toPx(j.rightElbow?.y, size, rShoulder.y + size * 0.14) };
  const lWrist = { x: toPx(j.leftWrist?.x, size, lElbow.x - size * 0.04), y: toPx(j.leftWrist?.y, size, lElbow.y + size * 0.14) };
  const rWrist = { x: toPx(j.rightWrist?.x, size, rElbow.x + size * 0.04), y: toPx(j.rightWrist?.y, size, rElbow.y + size * 0.14) };
  
  // Hands (33pt index finger for grips)
  const lHand = { x: toPx(j.leftIndex?.x, size, lWrist.x - size * 0.01), y: toPx(j.leftIndex?.y, size, lWrist.y + size * 0.04) };
  const rHand = { x: toPx(j.rightIndex?.x, size, rWrist.x + size * 0.01), y: toPx(j.rightIndex?.y, size, rWrist.y + size * 0.04) };

  // Legs
  const lKnee = { x: toPx(j.leftKnee?.x, size, hip.x - size * 0.06), y: toPx(j.leftKnee?.y, size, hip.y + size * 0.20) };
  const rKnee = { x: toPx(j.rightKnee?.x, size, hip.x + size * 0.06), y: toPx(j.rightKnee?.y, size, hip.y + size * 0.20) };
  const lAnkle = { x: toPx(j.leftAnkle?.x, size, lKnee.x - size * 0.02), y: toPx(j.leftAnkle?.y, size, lKnee.y + size * 0.20) };
  const rAnkle = { x: toPx(j.rightAnkle?.x, size, rKnee.x + size * 0.02), y: toPx(j.rightAnkle?.y, size, rKnee.y + size * 0.20) };

  // Feet (33pt heels and toes)
  const lHeel = { x: toPx(j.leftHeel?.x, size, lAnkle.x), y: toPx(j.leftHeel?.y, size, lAnkle.y + size * 0.015) };
  const lToe = { x: toPx(j.leftFootIndex?.x, size, lAnkle.x + size * 0.04), y: toPx(j.leftFootIndex?.y, size, lAnkle.y + size * 0.025) };
  const rHeel = { x: toPx(j.rightHeel?.x, size, rAnkle.x), y: toPx(j.rightHeel?.y, size, rAnkle.y + size * 0.015) };
  const rToe = { x: toPx(j.rightFootIndex?.x, size, rAnkle.x + size * 0.04), y: toPx(j.rightFootIndex?.y, size, rAnkle.y + size * 0.025) };

  const appType = pose.apparatusType ?? "body";

  const getStyle = (isActive: boolean) => {
    return isActive
      ? `fill="#0284C7" fill-opacity="0.85" stroke="#38BDF8" stroke-width="2.5" filter="url(#neon-glow)"`
      : `fill="#1E293B" stroke="#475569" stroke-width="1.8"`;
  };

  // Build Apparatus SVG elements using Hands
  let apparatusSvg = "";
  if (appType === "barbell") {
    apparatusSvg = `
      <line x1="${lHand.x - 30}" y1="${lHand.y}" x2="${rHand.x + 30}" y2="${rHand.y}" stroke="${apparatusColor}" stroke-width="7" stroke-linecap="round" />
      <rect x="${lHand.x - 38}" y="${lHand.y - 32}" width="16" height="64" rx="4" fill="${apparatusColor}" stroke="#B45309" stroke-width="1.5" />
      <rect x="${lHand.x - 50}" y="${lHand.y - 24}" width="10" height="48" rx="3" fill="#D97706" />
      <rect x="${rHand.x + 22}" y="${rHand.y - 32}" width="16" height="64" rx="4" fill="${apparatusColor}" stroke="#B45309" stroke-width="1.5" />
      <rect x="${rHand.x + 40}" y="${rHand.y - 24}" width="10" height="48" rx="3" fill="#D97706" />
    `;
  } else if (appType === "dumbbell") {
    apparatusSvg = `
      <line x1="${lHand.x - 20}" y1="${lHand.y}" x2="${lHand.x + 20}" y2="${lHand.y}" stroke="${apparatusColor}" stroke-width="6" stroke-linecap="round" />
      <rect x="${lHand.x - 28}" y="${lHand.y - 18}" width="10" height="36" rx="4" fill="${apparatusColor}" />
      <rect x="${lHand.x + 18}" y="${lHand.y - 18}" width="10" height="36" rx="4" fill="${apparatusColor}" />
      <line x1="${rHand.x - 20}" y1="${rHand.y}" x2="${rHand.x + 20}" y2="${rHand.y}" stroke="${apparatusColor}" stroke-width="6" stroke-linecap="round" />
      <rect x="${rHand.x - 28}" y="${rHand.y - 18}" width="10" height="36" rx="4" fill="${apparatusColor}" />
      <rect x="${rHand.x + 18}" y="${rHand.y - 18}" width="10" height="36" rx="4" fill="${apparatusColor}" />
    `;
  } else if (appType === "cable") {
    apparatusSvg = `
      <line x1="${size * 0.5}" y1="20" x2="${(lHand.x + rHand.x) / 2}" y2="${(lHand.y + rHand.y) / 2}" stroke="${apparatusColor}" stroke-width="3.5" stroke-dasharray="5,5" />
      <circle cx="${size * 0.5}" cy="24" r="12" fill="#0F172A" stroke="${apparatusColor}" stroke-width="3" />
      <line x1="${lHand.x}" y1="${lHand.y}" x2="${rHand.x}" y2="${rHand.y}" stroke="${apparatusColor}" stroke-width="6" stroke-linecap="round" />
    `;
  } else if (appType === "machine") {
    apparatusSvg = `
      <path d="M ${hip.x - 36} ${hip.y + 45} L ${hip.x + 36} ${hip.y + 45}" stroke="#334155" stroke-width="14" stroke-linecap="round" />
      <line x1="${lHand.x}" y1="${lHand.y}" x2="${hip.x - 24}" y2="${hip.y + 24}" stroke="${apparatusColor}" stroke-width="6" stroke-linecap="round" />
      <line x1="${rHand.x}" y1="${rHand.y}" x2="${hip.x + 24}" y2="${hip.y + 24}" stroke="${apparatusColor}" stroke-width="6" stroke-linecap="round" />
    `;
  }

  // Torso / Chest / Core Contours
  const torsoPath = `
    M ${lShoulder.x} ${lShoulder.y}
    Q ${neck.x} ${neck.y + 8} ${rShoulder.x} ${rShoulder.y}
    Q ${rShoulder.x + 8} ${spine.y} ${hip.x + 16} ${hip.y}
    L ${hip.x - 16} ${hip.y}
    Q ${lShoulder.x - 8} ${spine.y} ${lShoulder.x} ${lShoulder.y} Z
  `;

  const chestPlateLeft = `
    M ${neck.x - 2} ${neck.y + 12}
    L ${lShoulder.x + 4} ${lShoulder.y + 4}
    Q ${lShoulder.x + 2} ${spine.y - 4} ${neck.x - 2} ${spine.y + 4} Z
  `;
  const chestPlateRight = `
    M ${neck.x + 2} ${neck.y + 12}
    L ${rShoulder.x - 4} ${rShoulder.y + 4}
    Q ${rShoulder.x - 2} ${spine.y - 4} ${neck.x + 2} ${spine.y + 4} Z
  `;

  // Draw solid feet anchored to heel and toe
  const lFoot = `M ${lAnkle.x - 4} ${lAnkle.y - 4} L ${lAnkle.x + 4} ${lAnkle.y - 4} L ${lHeel.x + 4} ${lHeel.y + 4} L ${lToe.x + 4} ${lToe.y + 4} Q ${lToe.x} ${lToe.y + 6} ${lToe.x - 4} ${lToe.y + 4} L ${lHeel.x - 4} ${lHeel.y + 4} Z`;
  const rFoot = `M ${rAnkle.x - 4} ${rAnkle.y - 4} L ${rAnkle.x + 4} ${rAnkle.y - 4} L ${rHeel.x + 4} ${rHeel.y + 4} L ${rToe.x + 4} ${rToe.y + 4} Q ${rToe.x} ${rToe.y + 6} ${rToe.x - 4} ${rToe.y + 4} L ${rHeel.x - 4} ${rHeel.y + 4} Z`;

  // Hands geometry based on wrist to index mapping
  const lHandGeo = `M ${lWrist.x - 4} ${lWrist.y} L ${lWrist.x + 4} ${lWrist.y} L ${lHand.x + 4} ${lHand.y + 2} A 4 4 0 0 1 ${lHand.x - 4} ${lHand.y + 2} Z`;
  const rHandGeo = `M ${rWrist.x - 4} ${rWrist.y} L ${rWrist.x + 4} ${rWrist.y} L ${rHand.x + 4} ${rHand.y + 2} A 4 4 0 0 1 ${rHand.x - 4} ${rHand.y + 2} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">
  <defs>
    <!-- High-Impact Neon Cyan Glow Filter -->
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Dark Background Canvas -->
  <rect width="${size}" height="${size}" fill="${canvasBg}" />
  
  <!-- Subtle Gym Platform Floor Lines -->
  <line x1="20" y1="${size - 30}" x2="${size - 20}" y2="${size - 30}" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round" />
  <line x1="60" y1="${size - 22}" x2="${size - 60}" y2="${size - 22}" stroke="#1E293B" stroke-width="2" stroke-dasharray="6,6" opacity="0.6" />

  <!-- Apparatus (Behind Body) -->
  ${apparatusSvg}

  <!-- Lower Body / Legs (Muscular Contours) -->
  <path d="${buildMuscleSegment(hip, lKnee, 24, 30, 18, 1.2, 0.9)}" ${getStyle(isLegsActive)} />
  <path d="${buildMuscleSegment(lKnee, lAnkle, 18, 24, 12, 1.3, 0.8)}" ${getStyle(isLegsActive)} />
  <path d="${lFoot}" ${getStyle(isLegsActive)} />

  <path d="${buildMuscleSegment(hip, rKnee, 24, 30, 18, 1.2, 0.9)}" ${getStyle(isLegsActive)} />
  <path d="${buildMuscleSegment(rKnee, rAnkle, 18, 24, 12, 1.3, 0.8)}" ${getStyle(isLegsActive)} />
  <path d="${rFoot}" ${getStyle(isLegsActive)} />

  <!-- Torso Base / Core -->
  <path d="${torsoPath}" ${getStyle(isCoreActive || isBackActive)} />

  <!-- Sculpted Pectoral Plates -->
  <path d="${chestPlateLeft}" ${getStyle(isChestActive)} />
  <path d="${chestPlateRight}" ${getStyle(isChestActive)} />

  <!-- Upper Body / Arms -->
  <circle cx="${lShoulder.x}" cy="${lShoulder.y}" r="13" ${getStyle(isShouldersActive)} />
  <path d="${buildMuscleSegment(lShoulder, lElbow, 20, 24, 14, 1.2, 1.0)}" ${getStyle(isArmsActive || isShouldersActive)} />
  <circle cx="${lElbow.x}" cy="${lElbow.y}" r="7" ${getStyle(isArmsActive || isShouldersActive)} />
  <path d="${buildMuscleSegment(lElbow, lWrist, 15, 18, 10, 1.1, 0.9)}" ${getStyle(isArmsActive)} />
  <circle cx="${lWrist.x}" cy="${lWrist.y}" r="6" ${getStyle(isArmsActive)} />
  <path d="${lHandGeo}" ${getStyle(isArmsActive)} />

  <circle cx="${rShoulder.x}" cy="${rShoulder.y}" r="13" ${getStyle(isShouldersActive)} />
  <path d="${buildMuscleSegment(rShoulder, rElbow, 20, 24, 14, 1.2, 1.0)}" ${getStyle(isArmsActive || isShouldersActive)} />
  <circle cx="${rElbow.x}" cy="${rElbow.y}" r="7" ${getStyle(isArmsActive || isShouldersActive)} />
  <path d="${buildMuscleSegment(rElbow, rWrist, 15, 18, 10, 1.1, 0.9)}" ${getStyle(isArmsActive)} />
  <circle cx="${rWrist.x}" cy="${rWrist.y}" r="6" ${getStyle(isArmsActive)} />
  <path d="${rHandGeo}" ${getStyle(isArmsActive)} />

  <!-- Hip & Knee Articulation -->
  <circle cx="${hip.x}" cy="${hip.y}" r="10" ${getStyle(isLegsActive || isCoreActive)} />
  <circle cx="${lKnee.x}" cy="${lKnee.y}" r="8" ${getStyle(isLegsActive)} />
  <circle cx="${rKnee.x}" cy="${rKnee.y}" r="8" ${getStyle(isLegsActive)} />
  <circle cx="${lAnkle.x}" cy="${lAnkle.y}" r="6" ${getStyle(isLegsActive)} />
  <circle cx="${rAnkle.x}" cy="${rAnkle.y}" r="6" ${getStyle(isLegsActive)} />

  <!-- Anatomical Head & Neck -->
  <polygon points="${neck.x - 7},${neck.y} ${neck.x + 7},${neck.y} ${head.x + 5},${head.y + 8} ${head.x - 5},${head.y + 8}" fill="#1E293B" stroke="#475569" stroke-width="1.8" />
  <!-- Cranial Oval + Stylized Visor -->
  <ellipse cx="${head.x}" cy="${head.y}" rx="15" ry="19" fill="#1E293B" stroke="#475569" stroke-width="2" />
  <path d="M ${head.x - 11} ${head.y - 2} Q ${head.x} ${head.y - 6} ${head.x + 11} ${head.y - 2} Q ${head.x} ${head.y + 3} ${head.x - 11} ${head.y - 2} Z" fill="#38BDF8" opacity="0.95" filter="url(#neon-glow)" />
</svg>`;
}
