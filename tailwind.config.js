/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-bg": "#111317",
        "surface-container": "#1e2024",
        "surface-container-low": "#1a1c20",
        "surface-container-high": "#282a2e",
        "surface-container-highest": "#333539",
        "primary": "#e9feff",
        "primary-container": "#00f5ff",
        "primary-fixed": "#63f7ff",
        "primary-fixed-dim": "#00dce5",
        "secondary": "#d7ffc5",
        "tertiary": "#fff9f7",
        "error": "#ffb4ab",
        "outline": "#849495",
        "outline-variant": "#3a494a",
        "on-surface": "#e2e2e8",
        "on-surface-variant": "#b9caca",
        "on-primary": "#003739",
        "on-primary-container": "#006c71",
        "on-secondary-container": "#0f6d00",
        "on-tertiary-container": "#b92a00",
        "on-background": "#e2e2e8",
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
