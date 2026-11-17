import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Solo la app: los .test.cjs de .agents/skills son scripts de validación del tooling,
    // no suites de vitest ("No test suite found" en cada run).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/pages/**',
        'src/components/landing/**',
        'src/modules/civilmanager/**',
      ],
      // Ratchet (2026-11-17): real medido con la suite completa = 44.0% líneas / 37.8%
      // ramas / 34.7% funciones (el 63.9/56 del reporte externo NO corresponde a este
      // include/exclude). Umbral justo por debajo del real para que sea un piso honesto.
      thresholds: {
        statements: 42,
        branches: 35,
        functions: 33,
        lines: 42,
      },
    },
  },
});
