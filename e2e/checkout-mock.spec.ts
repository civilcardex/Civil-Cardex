import { expect, test } from '@playwright/test';
import { aceptarBannerCookies, textoEstable } from './helpers';

/**
 * Camino crítico 3: la calculadora de /pricing responde — el toggle INDIVIDUAL/EMPRESARIAL
 * y el selector de período cambian lo que se muestra. Interacción 100% local (estado de React):
 * NUNCA se pulsa "Pagar ahora", no hay cobro ni navegación al checkout externo de Lemon Squeezy.
 */

test('el tipo de plan y el período cambian los precios mostrados en /pricing', async ({ page }) => {
  await page.goto('/pricing');
  await aceptarBannerCookies(page);

  // Modo suscripciones (VITE_SUSCRIPCIONES=true): hay grupo "Tipo de plan". Si el flag está
  // apagado la página es la de marketing (estática) y este spec no aplica: SKIP limpio.
  const grupoTipo = page.getByRole('group', { name: /tipo de plan/i });
  const hayToggle = await grupoTipo
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!hayToggle, 'Pricing en modo marketing (VITE_SUSCRIPCIONES apagado): sin toggle.');

  // Tarjeta del módulo "Civil Flow" (el control completo es el div role=checkbox).
  const tarjetaFlow = page
    .locator('[role="checkbox"]')
    .filter({ has: page.getByRole('heading', { name: 'Civil Flow', exact: true }) });
  await expect(tarjetaFlow).toBeVisible();
  const precioFlow = tarjetaFlow.getByText(/US\$\d/).first();
  await expect(precioFlow).toBeVisible();

  // --- Selector de período: mensual -> semestral -> anual cambian precio Y sufijo. ---
  const precioMensual = await textoEstable(precioFlow);
  await expect(tarjetaFlow.getByText('/mes')).toBeVisible();

  await page.getByRole('button', { name: /semestral/i }).click();
  await expect(tarjetaFlow.getByText('/6 meses')).toBeVisible();
  const precioSemestral = await textoEstable(precioFlow);
  expect(precioSemestral, 'semestral muestra OTRO precio que mensual').not.toBe(precioMensual);

  await page.getByRole('button', { name: /anual/i }).click();
  await expect(tarjetaFlow.getByText('/año')).toBeVisible();
  const precioAnual = await textoEstable(precioFlow);
  expect(precioAnual, 'anual muestra OTRO precio que semestral').not.toBe(precioSemestral);

  // --- Toggle INDIVIDUAL/EMPRESARIAL: steppers de puestos y precio por puesto. ---
  await page.getByRole('button', { name: /empresarial/i }).click();
  // El texto del hero cambia (solo el del hero dice "Precios POR PUESTO. Volumen:").
  await expect(page.getByText(/Precios POR PUESTO\. Volumen/)).toBeVisible();
  const masPuestos = page.getByRole('button', { name: /Más puestos de Civil Flow/i });
  await expect(masPuestos).toBeVisible();

  // --- El total del resumen reacciona: 1 módulo -> 2 puestos (descuento por volumen). ---
  await tarjetaFlow.click();
  // Anual con 1 módulo (el período quedó en anual): descuento base −15% (constante de
  // catálogo, no de BD — el precio puede variar con app_precios, el descuento no).
  const resumen = page.locator('section').filter({ hasText: 'Tu compra' });
  await expect(resumen.getByText(/Descuento \(−15%\) aplicado/)).toBeVisible();
  const total = resumen.getByText(/US\$\d/).first();
  const totalUnPuesto = await textoEstable(total);

  await masPuestos.click();
  await expect(resumen.getByText(/Volumen: −10% por 2 puestos/)).toBeVisible();
  const totalDosPuestos = await textoEstable(total);
  expect(totalDosPuestos, '2 puestos con volumen cuestan OTRO total').not.toBe(totalUnPuesto);

  // --- Vuelta a INDIVIDUAL: los steppers desaparecen. ---
  await page.getByRole('button', { name: /individual/i }).click();
  await expect(masPuestos).toBeHidden();

  // Jamás navegamos al checkout externo: la URL sigue siendo /pricing.
  await expect(page).toHaveURL(/\/pricing/);
});
