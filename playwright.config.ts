import { defineConfig, devices } from '@playwright/test';

/**
 * E2E mínimo (caminos críticos) con Playwright + Chromium.
 * El webServer levanta `vite` en el puerto 5200 y Playwright lo gestiona solo:
 * lo arranca si no está, y en local reutiliza uno vivo (reuseExistingServer).
 * Ej: `npx playwright test` con el repo recién clonado corre las 3 specs sin nada más.
 */
export default defineConfig({
  // Specs en e2e/: public (rutas públicas), auth (solo con credenciales en env) y checkout-mock.
  testDir: 'e2e',
  // Cada test independiente: los 7 rutas públicas corren en paralelo en su propio contexto.
  fullyParallel: true,
  // 90s por test: el server de DEV (vite) compila módulos AL VUELO — la primera visita a una
  // ruta pesada (xlsx, three, jspdf como ES modules) puede tardar más del default de 30s.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  // 1 reintento SOLO en CI: un blurp de red en el runner no pinta el job de rojo.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5200',
    // Trazas al reintentar: el video/trace del segundo intento cuenta la historia del fallo.
    trace: 'on-first-retry',
  },
  projects: [
    {
      // Escritorio: corre TODAS las specs (public + auth + checkout-mock).
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      // Móvil 390×844: SOLO el spec público (cargar rutas + sin scroll horizontal).
      name: 'movil',
      testMatch: /public\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5200',
    url: 'http://localhost:5200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
