/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // dark-only via CSS vars, darkMode kept for Tailwind purge safety
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-bg": "var(--bg)",
        "surface-container": "var(--bg3)",
        "surface-container-low": "var(--bg2)",
        "surface-container-high": "var(--bg4)",
        "surface-container-highest": "var(--bg5)",
        "primary": "var(--acc)",
        "primary-container": "var(--acc2)",
        "primary-fixed": "var(--acc2)",
        "primary-fixed-dim": "var(--acc3)",
        "secondary": "var(--ok)",
        "tertiary": "#fff9f7",
        "error": "var(--err)",
        "outline": "var(--txt3)",
        "outline-variant": "var(--line)",
        "on-surface": "var(--txt)",
        "on-surface-variant": "var(--txt2)",
        "on-primary": "#003739",
        "on-primary-container": "#006c71",
        "on-secondary-container": "#0f6d00",
        "on-tertiary-container": "#b92a00",
        "on-background": "var(--txt)",
        "on-error": "#690005",
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "sans-serif"],
        mono: ["Geist", "monospace"],
      },
      spacing: {
        "gutters": "12px",
      },
    },
  },
  plugins: [],
};
