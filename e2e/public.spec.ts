import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Camino crítico 1: las rutas públicas cargan y ninguna deja scroll horizontal global.
 * El scroll lateral en móvil es el síntoma clásico de un elemento que se sale del viewport
 * (un grid sin wrap, una tabla ancha) — el usuario ve la página "cortada" sin saber por qué.
 * Ej: /pricing en un teléfono 390px de ancho debe medir 390px de ancho, no un pixel más.
 */

/** Una ruta pública + el elemento clave que prueba que la página REALMENTE cargó (no el fallback ni un blanco). */
interface RutaPublica {
  ruta: string;
  /** Localizador del texto/rol clave de la página, único para esa ruta. */
  clave: (page: Page) => Locator;
}

const RUTAS: RutaPublica[] = [
  {
    ruta: '/',
    // H1 del hero de la landing (aparece sin esperar el typewriter).
    clave: (page) => page.getByRole('heading', { name: /civil\s*cardex/i }).first(),
  },
  {
    ruta: '/pricing',
    // H1 según el modo: marketing ("Planes y Precios") o suscripciones ("Compra solo los módulos...").
    clave: (page) =>
      page.getByRole('heading', { name: /planes y precios|compra solo los módulos/i }),
  },
  {
    ruta: '/login',
    // Botón de submit del formulario de ingreso.
    clave: (page) => page.getByRole('button', { name: /iniciar sesión/i }),
  },
  {
    ruta: '/docs',
    // Buscador global de la documentación (único input con ese placeholder).
    clave: (page) => page.getByPlaceholder('Buscar en toda la documentación...'),
  },
  {
    ruta: '/aprende',
    clave: (page) => page.getByRole('heading', { name: 'Aprende', exact: true }),
  },
  {
    ruta: '/aprende/hunter-ntc-1500',
    // Título del artículo (h1 en ArticlePage).
    clave: (page) => page.getByRole('heading', { name: /Método Hunter en la NTC 1500/ }),
  },
  {
    ruta: '/civilflow',
    // H1 de la ficha del módulo (ModulePage con MODULES_DATA.flow.title).
    clave: (page) => page.getByRole('heading', { name: 'Civil Flow', exact: true }),
  },
];

/** Sin scroll horizontal global: el documento no mide más ancho que el viewport. Ej: un grid md:grid-cols-3 sin wrap en 390px haría scrollWidth > clientWidth. */
async function sinScrollHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

for (const { ruta, clave } of RUTAS) {
  test(`ruta pública ${ruta} carga sin scroll horizontal`, async ({ page }) => {
    await page.goto(ruta);

    // 1) La página llegó: su elemento clave es visible (auto-espera cubre el Suspense de rutas lazy).
    await expect(clave(page)).toBeVisible();

    // 2) Sin corte lateral: en desktop 1920 y en el proyecto móvil 390×844.
    await expect.poll(() => sinScrollHorizontal(page), { timeout: 10_000 }).toBe(true);
  });
}
