import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch M3 tokens
        primary: "#00242a",
        "primary-container": "#163a40",
        "on-primary": "#ffffff",
        "on-primary-container": "#81a4ab",

        secondary: "#775a20",
        "secondary-container": "#fdd48e",
        "secondary-fixed": "#ffdea7",
        "secondary-fixed-dim": "#e8c17c",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#775a20",

        background: "#f6faf9",
        surface: "#f6faf9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f0f4f3",
        "surface-container": "#ebefee",
        "surface-container-high": "#e5e9e8",
        "surface-container-highest": "#dfe3e2",
        "surface-variant": "#dfe3e2",
        "surface-bright": "#f6faf9",

        "on-background": "#181c1c",
        "on-surface": "#181c1c",
        "on-surface-variant": "#414849",

        outline: "#71787a",
        "outline-variant": "#c1c8c9",

        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        "attendance-present": "#10b981",
        "attendance-late": "#f59e0b",
        "attendance-absent": "#f43f5e",
        "holiday-vacation": "#fdd48e",
        "holiday-cancelled": "#9bb6e8",
        "brand-soft": "rgba(0, 36, 42, 0.05)",
        "accent-soft": "rgba(119, 90, 32, 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"],
        heebo: ["var(--font-heebo)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-lg": ["20px", { lineHeight: "28px", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      spacing: {
        sidebar_width: "17.5rem",
        stack_sm: "0.5rem",
        stack_md: "1rem",
        stack_lg: "1.25rem",
        gutter: "1rem",
        container_padding: "1.25rem",
      },
      boxShadow: {
        "tactile-sm": "0 2px 8px rgba(22, 58, 64, 0.04)",
        "tactile-md": "0 4px 20px rgba(22, 58, 64, 0.05)",
        "tactile-lg": "0 12px 32px rgba(22, 58, 64, 0.12)",
      },
      maxWidth: {
        canvas: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
