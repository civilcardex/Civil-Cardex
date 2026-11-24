import { expect, test } from '@playwright/test';

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
    const names = [
      /Tubería y mangueras$/,
      /Coeficiente por material$/,
      /Catálogo de accesorios especiales$/,
    ];
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
