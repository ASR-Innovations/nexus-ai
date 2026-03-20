import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light mode colors
        light: {
          primary: "#007AFF",
          primaryHover: "#0051D5",
          primaryActive: "#004FC4",
          background: "#FFFFFF",
          backgroundSecondary: "#F5F5F7",
          backgroundTertiary: "#E8E8ED",
          surface: "#FFFFFF",
          surfaceHover: "#F5F5F7",
          textPrimary: "#1D1D1F",
          textSecondary: "#6E6E73",
          textTertiary: "#86868B",
          border: "#D2D2D7",
          borderHover: "#B8B8BD",
          success: "#34C759",
          warning: "#FF9500",
          error: "#FF3B30",
          info: "#007AFF",
          positive: "#34C759",
          negative: "#FF3B30",
          glassBackground: "rgba(255, 255, 255, 0.7)",
          glassBorder: "rgba(255, 255, 255, 0.18)",
        },
        // Dark mode colors
        dark: {
          primary: "#0A84FF",
          primaryHover: "#409CFF",
          primaryActive: "#0077ED",
          background: "#000000",
          backgroundSecondary: "#1C1C1E",
          backgroundTertiary: "#2C2C2E",
          surface: "#1C1C1E",
          surfaceHover: "#2C2C2E",
          textPrimary: "#FFFFFF",
          textSecondary: "#EBEBF5",
          textTertiary: "#EBEBF599",
          border: "#38383A",
          borderHover: "#48484A",
          success: "#32D74B",
          warning: "#FF9F0A",
          error: "#FF453A",
          info: "#0A84FF",
          positive: "#32D74B",
          negative: "#FF453A",
          glassBackground: "rgba(28, 28, 30, 0.7)",
          glassBorder: "rgba(255, 255, 255, 0.1)",
        },
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
        "4xl": "96px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // Display
        "display-lg": ["56px", { lineHeight: "64px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-md": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-sm": ["40px", { lineHeight: "48px", letterSpacing: "-0.01em", fontWeight: "700" }],
        // Heading
        h1: ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2: ["28px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h4: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        // Body
        "body-lg": ["17px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["15px", { lineHeight: "22px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        // Label
        "label-lg": ["15px", { lineHeight: "20px", fontWeight: "500" }],
        "label-md": ["13px", { lineHeight: "18px", fontWeight: "500" }],
        "label-sm": ["11px", { lineHeight: "16px", fontWeight: "500" }],
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        "scale": "scale 200ms ease-out",
        "shimmer": "shimmer 2s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scale: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
