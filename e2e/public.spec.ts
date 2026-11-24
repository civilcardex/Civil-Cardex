import { expect, test, type Locator, type Page } from '@playwright/test';
import { aceptarBannerCookies } from './helpers.ts';

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
    clave: (page) => page.getByRole('textbox', { name: 'Buscar documentación' }),
  },
  {
    ruta: '/aprende',
    clave: (page) => page.getByRole('heading', { name: 'Aprende', exact: true }),
  },
  {
    ruta: '/aprende/hunter-ntc-1500',
    // Título del artículo (h1 en ArticlePage).
    clave: (page) => page.getByRole('heading', { name: /El método de Hunter/ }),
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

test('las 13 categorías de /docs tienen una guía y los enlaces actualizan la categoría', async ({
  page,
}) => {
  await page.goto('/docs#manual');
  await aceptarBannerCookies(page);
  const links = page
    .getByRole('navigation', { name: 'Categorías de documentación' })
    .locator('ul button[data-cat]');
  await expect(links).toHaveCount(13);
  const ids = await links.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('data-cat')!),
  );
  expect(ids).toHaveLength(13);
  for (const id of ids) {
    await page.locator(`ul button[data-cat="${id}"]`).click();
    const practical = page.locator('main .docs-section').last();
    await practical.getByRole('button', { name: /En la práctica/ }).click();
    await expect(practical.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible();
    await expect(practical.getByRole('heading', { name: 'Lectura del resultado' })).toBeVisible();
    await expect(practical.getByRole('heading', { name: 'Punto de atención' })).toBeVisible();
    await expect(practical.getByRole('heading', { name: 'Flujo sugerido' })).toBeVisible();
    await expect(practical.locator('.docs-practical-flow li')).toHaveCount(5);
    await expect(practical.locator('.docs-practical-grid .docs-practical-step')).toHaveText([
      'PREPARA',
      'COMPRUEBA',
      'EVITA',
      'AL TERMINAR',
    ]);
    await expect(
      practical.locator('.docs-practical-flow li > span[aria-hidden="true"]'),
    ).toHaveText(['1', '2', '3', '4', '5']);
    await expect(practical.getByText('AL TERMINAR')).toBeVisible();
    await expect(practical.getByRole('link')).toHaveAttribute('href', /^#/);
    const cardStyles = await practical
      .locator('.docs-practical-grid .docs-practical-card')
      .evaluateAll((cards) =>
        cards.map((card) => ({
          border: getComputedStyle(card).borderColor,
          background: getComputedStyle(card).backgroundColor,
          titleSize: getComputedStyle(card.querySelector('h3')!).fontSize,
          subtitleSize: getComputedStyle(card.querySelector('.docs-practical-step')!).fontSize,
        })),
      );
    expect(cardStyles).toHaveLength(4);
    expect(new Set(cardStyles.map((style) => style.border)).size).toBe(1);
    expect(new Set(cardStyles.map((style) => style.background)).size).toBe(1);
    expect(cardStyles.every((style) => style.titleSize === '18px')).toBe(true);
    expect(cardStyles.every((style) => style.subtitleSize === '12px')).toBe(true);
    const columnCount = await practical
      .locator('.docs-practical-layout')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columnCount).toBe((page.viewportSize()?.width ?? 0) < 760 ? 1 : 2);
  }
  await page.locator('ul button[data-cat="manual"]').click();
  const search = page.getByRole('textbox', { name: 'Buscar documentación' });
  await search.fill('distancia conocida');
  const guide = page.locator('main .docs-section').last();
  await guide.getByRole('button', { name: /En la práctica/ }).click();
  await guide.getByRole('link', { name: 'Tablas y verificaciones' }).click();
  await expect(page).toHaveURL(/\/docs#tablas$/);
  await expect(page.getByRole('heading', { name: 'Tablas y verificaciones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tablas y verificaciones' })).toBeFocused();
  await expect(search).toHaveValue('');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Manual de usuario' })).toBeVisible();
});
