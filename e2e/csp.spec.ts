import { expect, test, type Page } from '@playwright/test';

/**
 * CSP estricta de estilos en las rutas públicas: con `style-src 'self'` (sin 'unsafe-inline'),
 * ningún `style="..."` del HTML puede aplicarse. El server de DEV relaja la CSP para HMR, así
 * que este spec inyecta la política estricta como header (la del vercel.json de producción) y
 * escucha `securitypolicyviolation`.
 *
 * Nota: en dev Vite inyecta su CSS como <style> (style-src-elem) — eso se ignora aquí a
 * propósito; lo que se vigila es que la APP no dependa de atributos style inline. El HTML
 * prerenderizado se revisa aparte con `npm run prerender:styles`.
 */

/** Política de producción con el script-src relajado que exige el dev server (HMR/Refresh). */
const CSP_ESTRICTA =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://va.vercel-scripts.com; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com; worker-src 'self' blob:; frame-src 'self' blob: https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'self' blob:; base-uri 'self'; form-action 'self';";

/** Rutas públicas representativas (marketing, docs, módulos y contenido). */
const RUTAS = ['/', '/pricing', '/docs', '/civilflow', '/civilmanager', '/aprende'];

/** Instala el colector ANTES de que corra cualquier script de la app. */
async function prepararColector(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations?: { directive: string; sample: string }[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations!.push({ directive: e.effectiveDirective, sample: e.sample });
    });
  });
}

/** Inyecta la CSP estricta en la respuesta del documento (el resto de requests pasan). */
async function inyectarCsp(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': CSP_ESTRICTA },
    });
  });
}

for (const ruta of RUTAS) {
  test(`CSP estricta sin style inline en ${ruta}`, async ({ page }) => {
    await prepararColector(page);
    await inyectarCsp(page);

    await page.goto(ruta);
    // La navbar existe en todas las rutas públicas; espera a que la página monte.
    // Timeout de 15s: en dev el server compila el grafo por ruta bajo demanda (docs es enorme).
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });
    // Margen para que los chunks lazy monten sus componentes.
    await page.waitForTimeout(600);

    const violaciones = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations?: { directive: string; sample: string }[] })
          .__cspViolations ?? [],
    );

    // style-src-elem en dev = CSS de Vite (HMR); lo que importa es que no haya style-src-attr.
    const deAtributos = violaciones.filter(
      (v) => v.directive === 'style-src-attr' || v.directive === 'style-src',
    );
    expect(deAtributos, `violaciones CSP de style inline: ${JSON.stringify(deAtributos)}`).toEqual(
      [],
    );
  });
}
