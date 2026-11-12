import { expect, type Page, type Locator } from '@playwright/test';

/** Acepta el banner de consentimiento de cookies si está visible: es una barra FIJA abajo (z-index 9999) que taparía clics cerca del borde inferior. Ej: antes de tocar el total/CTA del resumen en /pricing. Si ya se decidió en este contexto, el banner no existe y seguimos. */
export async function aceptarBannerCookies(page: Page): Promise<void> {
  try {
    await page.getByRole('button', { name: /aceptar/i }).click({ timeout: 3_000 });
  } catch {
    /* Sin banner (decisión ya guardada o aún no montado): nada que hacer. */
  }
}

/** Texto de un localizador con reintento: `textContent()` no auto-espera, así que un render en vuelo devolvía el valor VIEJO. Ej: leer el total del resumen justo después de un clic. */
export async function textoEstable(loc: Locator): Promise<string> {
  let texto = '';
  await expect
    .poll(async () => {
      texto = (await loc.textContent()) ?? '';
      return texto;
    })
    .toBeTruthy();
  return texto;
}
