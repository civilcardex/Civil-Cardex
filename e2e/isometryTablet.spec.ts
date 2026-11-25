import { expect, test } from '@playwright/test';

for (const [width, height] of [
  [744, 1133],
  [1180, 820],
]) {
  test.describe(`Isometría táctil ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true });

    test('panel a demanda, giro, pellizco y recuperación tras cancelar', async ({
      page,
      baseURL,
    }) => {
      const local = new URL(baseURL!).origin;
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === local ? route.continue() : route.abort(),
      );
      await page.goto('/e2e/isometry.html', { waitUntil: 'commit' });
      const canvas = page.locator('canvas.iso-gesture-canvas');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.iso-loading-overlay')).toHaveCount(0);
      const tramos = page.getByRole('button', { name: 'Tramos', exact: true });
      const sidebar = page.locator('.iso-network-sidebar');
      await expect(sidebar).toBeHidden();
      await tramos.tap();
      await expect(sidebar).toBeVisible();
      await tramos.tap();
      await expect(sidebar).toBeHidden();

      const box = (await canvas.boundingBox())!;
      expect(box.width).toBeGreaterThan(width * 0.9);
      expect(box.height).toBeGreaterThan(height * 0.5);
      const cdp = await page.context().newCDPSession(page);
      const centro = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const a = { x: centro.x - 35, y: centro.y, id: 1 };
      const b = { x: centro.x + 35, y: centro.y, id: 2 };
      const giro = page.getByLabel('Giro horizontal');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...a, x: a.x + 63, y: a.y + 15 }],
      });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(giro).not.toHaveValue('45');
      await expect(page.locator('#iso-rotx + span')).toHaveText(/^-?\d+°$/);
      await expect(page.locator('#iso-rotz + span')).toHaveText(/^\d+°$/);

      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { ...a, x: a.x - 25 },
          { ...b, x: b.x + 25 },
        ],
      });
      const zoom = page.getByRole('slider', { name: /Zoom/ });
      await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(canvas).toHaveCSS('cursor', 'grab');
      await page.getByRole('button', { name: 'Alejar' }).tap();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await cdp.detach();
    });
  });
}
