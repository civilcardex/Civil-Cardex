import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@c': path.resolve(__dirname, 'src/components'),
      '@u': path.resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 50,
    },
    hmr: {
      overlay: true,
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist') && !id.includes('pdf.worker')) return 'vendor-pdfjs';
          if (id.includes('src/lib/PlanoEngine')) return 'plano-engine';
          if (id.includes('src/components/PdfViewer')) return 'pdf-viewer';
          if (id.includes('node_modules/react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
        },
      },
    },
  },
})
