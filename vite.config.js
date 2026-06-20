import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      overlay: true,
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist') && !id.includes('pdf.worker')) return 'vendor-pdfjs';
          if (id.includes('src/lib/PlanoEngine')) return 'plano-engine';
          if (id.includes('src/components/PdfViewer')) return 'pdf-viewer';
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('@supabase') || id.includes('lib/supabase')) return 'vendor-supabase';
        },
      },
    },
  },
})
