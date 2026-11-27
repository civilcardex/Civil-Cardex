import { expect, test } from '@playwright/test';

test('Catálogo maestro integra las tres series en la tabla original de fricción', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/tablet.html?catalogo-friccion=1#coef-friccion-rci');
  const region = page.getByRole('region', { name: 'Coeficiente fricción tuberías', exact: true });
  const table = region.getByRole('table', { name: 'Coeficientes de fricción por tipo de tubería' });
  await expect(table).toHaveCount(1);
  await expect(table).toHaveAccessibleDescription(/No se usa en los cálculos/);
  await expect(
    page.getByRole('heading', { name: 'Coeficiente fricción tuberías · Contra incendio' }),
  ).toHaveCount(0);
  const headers = table.getByRole('columnheader');
  await expect(headers.filter({ hasText: /interior medio/i })).toHaveCount(0);
  await expect(headers.filter({ hasText: 'Hazen C húmedo' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Hazen C seco' })).toBeVisible();
  const catalogRow = (material: string) =>
    table.getByRole('row').filter({
      has: page.getByRole('rowheader', { name: material, exact: true }),
    });
  const wetCell = (row: ReturnType<typeof catalogRow>) => row.getByRole('cell').nth(4);
  const dryCell = (row: ReturnType<typeof catalogRow>) => row.getByRole('cell').nth(5);
  const steel = catalogRow('Acero al carbono');
  const galvanized = catalogRow('Acero galvanizado').filter({
    has: page.getByRole('cell', { name: 'Contra incendio', exact: true }),
  });
  await expect(wetCell(steel)).toHaveText('120');
  await expect(dryCell(steel)).toHaveText('100');
  await expect(dryCell(galvanized)).toHaveText('100');
  const rows = await table.locator('tbody tr').all();
  await expect(table.locator('tbody td sup')).toHaveCount(rows.length - 2);
  for (const row of rows) {
    const dry = dryCell(row);
    if ((await dry.textContent())?.trim() === '100') continue;
    await expect(dry).toHaveText(`${(await wetCell(row).textContent())?.trim()}*`);
  }
  for (const [material, description] of [
    ['PVC C900 RDE 18', 'PVC para red enterrada'],
    ['PVC C900 RDE 14', 'PVC para red enterrada'],
    ['CPVC SDR 13,5', 'CPVC para rociadores'],
  ]) {
    const row = catalogRow(material);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('cell').first()).toHaveText(description);
    await expect(wetCell(row)).toHaveText('150');
    await expect(dryCell(row)).toHaveText('150*');
    await expect(dryCell(row)).toHaveCSS('text-align', 'center');
  }
  const sizes = await region.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(sizes[0]).toBeGreaterThan(sizes[1]);
  await region.focus();
  await expect(region).toBeFocused();
});

for (const viewport of [
  { width: 1600, height: 1000 },
  { width: 1366, height: 768 },
  { width: 820, height: 1180 },
]) {
  test(`Entradas es legible y centrada a ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/e2e/tablet.html?rci-entradas=1');
    await page.getByRole('button', { name: /Tubería y mangueras$/ }).click();
    const names = [/Tubería y mangueras$/, /Catálogo de accesorios especiales$/];
    await expect(page.getByRole('region', { name: 'Coeficiente por material' })).toHaveCount(0);
    await expect(page.getByText(/Los diámetros internos y el C de Hazen-Williams/)).toHaveCount(0);
    const firstTwo = await Promise.all(
      names
        .slice(0, 2)
        .map((name) =>
          page.getByRole('region', { name }).locator('xpath=ancestor::section[1]').boundingBox(),
        ),
    );
    expect(firstTwo.every(Boolean)).toBe(true);
    if (viewport.width === 820) expect(firstTwo[1]!.y).toBeGreaterThan(firstTwo[0]!.y);
    else expect(Math.abs(firstTwo[1]!.y - firstTwo[0]!.y)).toBeLessThan(3);
    for (const name of names) {
      const region = page.getByRole('region', { name });
      await expect(region.locator('th').first()).toHaveCSS('font-size', '13px');
      const control = region.locator('td input, td select').first();
      await expect(control).not.toBeEditable();
      await expect(control).toHaveCSS('font-size', '14px');
      await region
        .locator('xpath=ancestor::section[1]')
        .getByRole('button', { name: 'EDITAR', exact: true })
        .click();
      await expect(control).toBeEditable();
      await expect(control).toHaveCSS('font-size', '14px');
    }

    await page.getByRole('button', { name: 'Ir al dato' }).click();
    await expect(page.getByRole('button', { name: /Montantes$/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      page.locator('[data-campo="mont.dn"]').locator('xpath=ancestor::tr'),
    ).toBeFocused();
    const montantes = page.getByRole('region', { name: 'Montantes', exact: true });
    await montantes
      .locator('xpath=ancestor::section[1]')
      .getByRole('button', { name: 'EDITAR', exact: true })
      .click();
    await expect(montantes.getByRole('combobox', { name: 'Clase de sistema' })).toBeEnabled();
    await expect(montantes.getByRole('option', { name: '3"', exact: true })).toHaveCount(0);

    for (const name of [
      'Siamesa',
      'Bomba: selección',
      'Succión y NPSH',
      'Bomba: jockey',
      'Tanque',
    ]) {
      await page.getByRole('button', { name: new RegExp(`${name}$`) }).click();
      const checkCenter = (label: string) =>
        page
          .getByRole('region', { name: label, exact: true })
          .locator('xpath=ancestor::section[1]')
          .evaluate((el) => {
            const outer = el.parentElement!.getBoundingClientRect();
            const inner = el.getBoundingClientRect();
            return {
              free: outer.width - inner.width,
              offset: Math.abs(outer.left + outer.right - inner.left - inner.right),
            };
          });
      const widths = await checkCenter(name);
      expect(widths.offset).toBeLessThan(3);
      if (viewport.width === 1600) expect(widths.free).toBeGreaterThan(0);
      if (name === 'Bomba: selección') {
        expect((await checkCenter('Tubería del cuarto de bombas')).offset).toBeLessThan(3);
      }
      if (name === 'Succión y NPSH') {
        const abrir = page.getByRole('button', { name: 'Ver esquema del cuarto de bombas' });
        await abrir.click();
        await expect(
          page.getByRole('dialog', { name: 'Esquema del cuarto de bombas' }),
        ).toBeVisible();
        await expect(page.getByText('Resaltado: succión', { exact: false })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(abrir).toBeFocused();
        const { width, height, vertical } = await page
          .getByRole('region', { name, exact: true })
          .evaluate((el) => ({
            width: el.clientWidth,
            height: el.clientHeight,
            vertical: el.scrollHeight > el.clientHeight,
          }));
        expect(vertical).toBe(false);
        if (viewport.height === 768) {
          expect(width).toBeGreaterThan(1100);
          expect(height).toBeLessThanOrEqual(400);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  });
}
