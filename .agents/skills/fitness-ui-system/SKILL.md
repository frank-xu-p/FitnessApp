\---

name: fitness-ui-system

description: "Applies modern mobile fitness app UX/UI design patterns (Strong/Hevy inspired) using NativeWind, Lucide icons, OLED dark theme, and high-contrast styling. Use whenever creating or restyling React Native workout screens, modals, or inputs."

\---



\# Fitness App UI/UX Design System



\## Design Rules \& Palette

1\. \*\*Surfaces \& Backgrounds:\*\*

&#x20;  - Base Background: `bg-black` or `bg-zinc-950`.

&#x20;  - Elevated Cards: `bg-zinc-900` with subtle border `border border-zinc-800/80` and `rounded-2xl`.

&#x20;  - Modals \& Sheets: `bg-zinc-900` with `rounded-t-3xl`.



2\. \*\*Accents \& States:\*\*

&#x20;  - Active / CTA Accent: Electric Neon (`#CCFF00` / `bg-lime-400 text-black font-bold`) or Cyan (`#06B6D4` / `bg-cyan-500 text-black`).

&#x20;  - Completed Set State: High-contrast green pill / checkmark badge.

&#x20;  - Text Hierarchy: Primary values in `text-white font-bold`, secondary metadata in `text-zinc-400 text-xs font-medium uppercase tracking-wider`.



3\. \*\*Metrics \& Readability:\*\*

&#x20;  - Always display weights, reps, sets, and rest timers in monospaced/tabular bold typography (`font-mono text-lg text-white font-bold`).

&#x20;  - Ensure a minimum \*\*48px touch target\*\* (`h-12`) for all buttons, inputs, and check-off pills.



4\. \*\*Micro-Interactions:\*\*

&#x20;  - Trigger `expo-haptics` (ImpactFeedbackStyle.Light or Medium) on set completion, timer triggers, and plate calculations.

