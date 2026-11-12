import { expect, test } from '@playwright/test';
import { aceptarBannerCookies } from './helpers';

/**
 * Camino crítico 2: login real con credenciales del entorno → llega al perfil → cierra sesión.
 * SOLO corre si existen E2E_EMAIL y E2E_PASS (sin ellos, la suite pública sigue siendo verde):
 * son una cuenta de prueba, no secrets de producción, y en CI se pasan desde los secrets del repo.
 */

// Sin credenciales en el entorno el spec entero se marca SKIP (visible y limpio, no fallo).
test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASS,
  'Requiere E2E_EMAIL y E2E_PASS en el entorno (en CI: secrets del repo).',
);

test('login con credenciales reales llega al perfil y cierra sesión', async ({ page }) => {
  await page.goto('/login');
  await aceptarBannerCookies(page);

  // El formulario de LoginPage: labels asociados con htmlFor → getByLabel los encuentra.
  // exact: true — sin él, "CONTRASEÑA" también matchea el botón ojo ("Mostrar contraseña").
  await page.getByLabel('CORREO ELECTRÓNICO', { exact: true }).fill(process.env.E2E_EMAIL!);
  await page.getByLabel('CONTRASEÑA', { exact: true }).fill(process.env.E2E_PASS!);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();

  // LoginPage navega a location.state.from ?? '/perfil' — el default SIEMPRE es /perfil
  // (el state.from solo lo manda ModulePage al pedir login desde una ficha de módulo).
  // Esperamos salir de /login en vez de asumir el destino exacto: si mañana el default
  // cambia a un workarea, este test sigue describiendo el mismo camino crítico.
  await page.waitForURL(({ pathname }) => !pathname.startsWith('/login'), { timeout: 30_000 });

  // Elemento propio del perfil: la tarjeta "Información Personal" (h2 con id en ProfilePage).
  await expect(page.getByRole('heading', { name: 'Información Personal' })).toBeVisible();
  // Y el email de la cuenta debe aparecer en ella.
  await expect(page.getByText(process.env.E2E_EMAIL!, { exact: false }).first()).toBeVisible();

  // Logout SOLO si el botón está visible: ConfirmModal nativo (<dialog>) pide confirmación.
  const btnSalir = page.getByRole('button', { name: /cerrar sesión/i });
  if (await btnSalir.isVisible()) {
    await btnSalir.click();
    // Dentro del <dialog> el botón de confirmación repite el nombre "Cerrar sesión".
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /cerrar sesión/i })
      .click();
    // Tras signOut, ProfilePage navega a la landing.
    await expect(page).toHaveURL(/\/$/);
  }
});
