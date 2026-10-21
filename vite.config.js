import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  server: {
    hmr: {
      overlay: true,
    },
  },
  // La CSP de PRODUCCIÓN (index.html + vercel.json) va sin 'unsafe-inline' ni 'unsafe-eval'.
  // El server de DEV necesita 'unsafe-inline' (React Refresh / HMR inyectan scripts inline)
  // y 'unsafe-eval': se relaja SOLO en desarrollo, sin tocar el HTML de producción.
  plugins: [
    react(),
    {
      name: 'csp-relajada-en-dev',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(
          /script-src 'self' 'wasm-unsafe-eval'/,
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
        );
      },
    },
    process.env.VITE_ANALYZE
      ? visualizer({ filename: 'dist/stats.html', open: false, gzipSize: true })
      : null,
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 900,
  },
})
