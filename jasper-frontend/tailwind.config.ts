import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-container": "var(--surface-container)",
        "surface-alt": "var(--surface-alt)",
        /* SAIT brand palette */
        "sait-red":        "#DA291C",
        "sait-red-deep":   "#A6192E",
        "sait-plum":       "#4D0B5C",
        "sait-purple":     "#6D2077",
        "sait-navy":       "#0C2340",
        "sait-blue":       "#005EB8",
        "sait-sky":        "#00A3E0",
        "sait-soft-blue":  "#55CAF0",
        "sait-charcoal":   "#212529",
        "sait-light-grey": "#F6F7F9",
      },
      fontFamily: {
        sans: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
