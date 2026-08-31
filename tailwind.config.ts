import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14161a",
          soft: "#414751",
          mute: "#6b727d",
          faint: "#98a0ab",
        },
        paper: {
          DEFAULT: "#ffffff",
          warm: "#fbfaf8",
          sunk: "#f4f3f0",
        },
        line: {
          DEFAULT: "#e7e5e0",
          strong: "#d6d3cc",
        },
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bed3ff",
          300: "#93b4ff",
          400: "#618cfb",
          500: "#3b66f0",
          600: "#2749d6",
          700: "#1f3aab",
          800: "#1e3387",
          900: "#1e2f6b",
        },
        signal: {
          ok: "#1f7a54",
          okbg: "#e8f6ef",
          warn: "#96601a",
          warnbg: "#fdf1de",
          risk: "#a02c2c",
          riskbg: "#fceceb",
          info: "#1f5c86",
          infobg: "#e9f2f9",
        },
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem", "3xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,26,0.04), 0 8px 24px -12px rgba(20,22,26,0.12)",
        lift: "0 2px 4px rgba(20,22,26,0.04), 0 18px 40px -18px rgba(20,22,26,0.22)",
        focus: "0 0 0 3px rgba(59,102,240,0.18)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(.22,.61,.36,1) both",
        "fade-in": "fade-in 200ms ease both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
