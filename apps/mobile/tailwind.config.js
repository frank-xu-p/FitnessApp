/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        black: "#000000",
        zinc: {
          950: "#09090b",
          900: "#18181b",
          850: "#202023",
          800: "#27272a",
          700: "#3f3f46",
          600: "#52525b",
          500: "#71717a",
          400: "#a1a1aa",
          300: "#d4d4d8",
          200: "#e4e4e7",
          100: "#f4f4f5",
        },
        lime: {
          400: "#CCFF00",
          500: "#B8E600",
          950: "#1A2E05",
        },
        cyan: {
          400: "#38BDF8",
          500: "#06B6D4",
          600: "#0891B2",
          950: "#082F49",
        },
        primary: "#38BDF8", // Electric Cyan / Primary
        "primary-dark": "#0284C7",
        "neon-lime": "#CCFF00",
        "electric-cyan": "#06B6D4",
        danger: "#EF4444",
        success: "#10B981",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};
