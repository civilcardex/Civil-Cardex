import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    process.env.VITE_ANALYZE
      ? visualizer({ filename: 'dist/stats.html', open: false, gzipSize: true })
      : null,
  ].filter(Boolean),
  server: {
    hmr: {
      overlay: true,
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
})
