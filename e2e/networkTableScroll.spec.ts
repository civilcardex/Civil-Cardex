import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 820, height: 620 }, hasTouch: true });

test('las tablas de diseño se desplazan sin mover la barra de redes', async ({
  page,
  baseURL,
  browserName,
}) => {
  test.setTimeout(180_000);
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem('civilflow_active_proyecto_id', 'c1a00000-1111-4111-8111-000000000001');
    localStorage.setItem(
      'civilflow_active_nets',
      JSON.stringify(['san', 'll', 'af', 'ac', 'gas', 'rci', 'bom', 'ep']),
    );
    localStorage.setItem('cardex_tour_cf_tab_redes', '1');
    sessionStorage.setItem(
      'fixture-cf-proyecto',
      JSON.stringify({
        proyecto_general: { nombre: 'Prueba de tablas', pais: 'Colombia', uso: 'Residencial' },
      }),
    );
  });
  await page.goto('/e2e/tablet.html?cf-setup=1&redes-scroll=1');
  const footer = page.getByRole('navigation', { name: 'Redes activas' });
  const chips = page.getByRole('group', { name: 'Redes', exact: true });
  await expect(footer).toBeInViewport({ ratio: 0.99 });
  const footerTop = (await footer.boundingBox())!.y;
  const touch = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;

  for (const [red, nav, label] of [
    ['Sanitaria', 'Cálculo de unidades de descarga', 'Cálculo de unidades de descarga'],
    ['Aguas lluvias', 'Chequeo bajantes', 'Chequeo de bajantes de aguas lluvias'],
    ['Agua fría', 'Diseño de red agua fría', 'Diseño de red agua fría'],
    ['Agua caliente', 'Diseño de red agua caliente', 'Diseño de red agua caliente'],
    ['Gas', 'Diseño de red', 'Diseño de red de gas'],
    ['Contra incendio', 'Hidráulica', 'Tabla de ramales del piso'],
    ['Bomba aguas residuales', '1. Datos de entrada', '1. Datos de entrada — B-01'],
    ['Equipo presión', '', '1. Caudales de diseño'],
  ]) {
    if (red === 'Bomba aguas residuales') {
      await page.evaluate(() => {
        localStorage.setItem(
          'civilflow_trazos_bomba-prueba',
          JSON.stringify({
            bajantes: [{ id: 'bomba-1', code: 'B-01', tipo: 'bomba', net: 'san' }],
          }),
        );
      });
    }
    await chips.getByRole('button', { name: red, exact: true }).tap();
    if (nav) await page.getByRole('button', { name: nav, exact: true }).tap();
    const region = page.getByRole('region', { name: label, exact: true });
    const table = region.getByRole('table').first();
    await expect(table).toBeVisible();
    // Sintético: fuerza el desbordamiento sin modificar proyectos, cálculos ni guardado.
    await table.evaluate((node) => {
      const tbody = (node as HTMLTableElement).tBodies[0];
      for (let i = 0; i < 60; i++) {
        tbody.insertRow().insertCell().textContent = `Fila de prueba ${i + 1}`;
      }
    });
    await region.scrollIntoViewIfNeeded();
    const sheet = region.locator('xpath=ancestor::*[contains(@class,"cf-network-sheet")][1]');
    await region.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
    const sheetTop = await sheet.evaluate((el) => el.scrollTop);
    if (touch && red === 'Sanitaria') {
      const box = (await region.boundingBox())!;
      const x = Math.round(box.x + box.width / 2);
      const y = Math.floor(Math.min(footerTop, box.y + box.height) - 20);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const delta of [20, 40, 60, 80, 100]) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - delta }],
        });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await region.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
    }
    await page.keyboard.press('End');
    /* Fijar el fondo EXPLÍCITO dentro del poll: en CI (Linux) la inercia del touch y las
     * métricas de fuente dejaban un residual de ~35 px tras un solo 'End'. */
    await expect
      .poll(() =>
        region.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
          return el.scrollHeight - el.clientHeight - el.scrollTop;
        }),
      )
      .toBeLessThanOrEqual(1);
    expect(await region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await sheet.evaluate((el) => el.scrollTop), red).toBe(sheetTop);
    await expect(footer).toBeInViewport({ ratio: 0.99 });
    expect((await footer.boundingBox())!.y).toBe(footerTop);
  }
});
