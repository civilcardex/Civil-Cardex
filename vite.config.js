import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [react(), visualizer({ filename: 'dist/stats.html', open: false, gzipSize: true })],
  server: {
    hmr: {
      overlay: true,
    },
  },
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        return deps.filter(dep => !dep.includes('pdf-viewer') && !dep.includes('vendor-jspdf') && !dep.includes('vendor-pdfjs') && !dep.includes('plano-engine'));
      }
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/constants/engineeringData')) return 'vendor-engineering-data';
          if (id.includes('src/constants')) return 'vendor-constants';
          if (id.includes('src/utils/calc') || id.includes('src/utils/hydraulicCheck')) return 'vendor-calcs';
          if (id.includes('pdfjs-dist') && !id.includes('pdf.worker')) return 'vendor-pdfjs';
          if (id.includes('node_modules/jspdf')) return 'vendor-jspdf';
          if (id.includes('src/lib/PlanoEngine')) return 'plano-engine';
          if (id.includes('src/components/PdfViewer')) return 'pdf-viewer';
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('@supabase') || id.includes('lib/supabase')) return 'vendor-supabase';
          if (id.includes('node_modules') && !id.includes('pdfjs-dist')) return 'vendor-other';
        },
      },
    },
  },
})
