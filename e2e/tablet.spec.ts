import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  const local = new URL(baseURL!).origin;
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === local ? route.continue() : route.abort(),
  );
});

for (const [width, height] of [
  [744, 1133],
  [820, 1180],
  [1133, 744],
  [1180, 820],
  [1440, 900],
]) {
  const hasTouch = width < 1440;
  test.describe(`${width}×${height} ${hasTouch ? 'táctil' : 'escritorio'}`, () => {
    test.use({ viewport: { width, height }, hasTouch });
    test('dibujo, cancelación, selección, zoom y cambio de plano', async ({ page }) => {
      await page.goto('/e2e/tablet.html', { waitUntil: 'commit' });
      const tap = async (name: string) => {
        const button = page.getByRole('button', { name, exact: true });
        await (hasTouch ? button.tap() : button.click());
      };
      const canvas = page.getByLabel('Lienzo de prueba');
      const at = async (x: number, y: number) =>
        hasTouch ? canvas.tap({ position: { x, y } }) : canvas.click({ position: { x, y } });
      await tap('Dibujar ramal');
      if (hasTouch) {
        const box = (await canvas.boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        const first = { x: box.x + 140, y: box.y + 130, id: 1 };
        const second = { x: box.x + 240, y: box.y + 130, id: 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [first, second],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [first, second],
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await tap('Terminar');
        await expect(
          page.getByText('Coloca al menos dos puntos para terminar el ramal.'),
        ).toBeVisible();
        await cdp.detach();
      }
      await at(100, 100);
      await at(220, 100);
      await tap('Terminar');
      await expect(page.getByTestId('ramales')).toHaveText('1');
      await expect(page.getByTestId('puntos')).toHaveText('2');
      await at(110, 160);
      await tap('Cancelar');
      await expect(page.getByTestId('ramales')).toHaveText('1');
      await tap('Seleccionar');
      await at(160, 100);
      await tap('Opciones');
      await expect(page.getByText('Opciones del ramal seleccionado')).toBeVisible();
      if (hasTouch) await tap('Acercar');
      await expect(page.getByRole('button', { name: 'Plano anterior' })).toBeDisabled();
      await tap('Plano siguiente');
      await expect(page.getByLabel('Plano activo')).toHaveText('Plano 2');
      await expect(page.getByRole('button', { name: 'Plano siguiente' })).toBeDisabled();
      await tap('Plano anterior');
      const table = page.getByRole('region', { name: 'Tabla de ramales del piso' });
      await table.focus();
      await expect(table.getByRole('columnheader', { name: 'Ramal', exact: true })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Estado', exact: true })).toBeVisible();
      const header = await table.locator('thead').evaluate((head) => {
        const [row1, row2] = (head as HTMLTableSectionElement).rows;
        const divider = getComputedStyle(row1, '::after');
        const labelTop = (cell: HTMLTableCellElement) => {
          const range = document.createRange();
          range.selectNodeContents(cell.firstChild!);
          return range.getBoundingClientRect().top;
        };
        return {
          upper: [...row1.cells].map(labelTop),
          lower: [...row2.cells].map(labelTop),
          edges: [...head.querySelectorAll('th')].map(
            (cell) => getComputedStyle(cell).borderBottomWidth,
          ),
          position: getComputedStyle(head).position,
          divider: [
            divider.position,
            divider.left,
            divider.right,
            divider.bottom,
            divider.borderBottomWidth,
          ],
        };
      });
      expect(Math.max(...header.upper) - Math.min(...header.upper)).toBeLessThan(1);
      expect(Math.max(...header.lower) - Math.min(...header.lower)).toBeLessThan(1);
      expect(header.edges.every((edge) => edge === '1px')).toBe(true);
      expect(header.position).toBe('sticky');
      expect(header.divider).toEqual(['absolute', '0px', '0px', '0px', '1px']);
      if (width < 1000) {
        await table.evaluate((node) => {
          node.scrollLeft = node.scrollWidth;
        });
        expect(await table.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
        await expect(
          table.getByRole('columnheader', { name: 'Estado', exact: true }),
        ).toBeInViewport();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });

    test('navegación CM y edición con persistencia simulada', async ({ page, baseURL }) => {
      await page.route('**/civilmanagerareatrabajo/**', async (route) => {
        const response = await route.fetch({ url: `${baseURL}/e2e/tablet.html` });
        await route.fulfill({ response });
      });
      await page.goto(
        '/civilmanagerareatrabajo/11111111-1111-4111-8111-111111111111/catalogos/equipos',
        { waitUntil: 'commit' },
      );
      const tap = async (name: string) => {
        const button = page.getByRole('button', { name, exact: true });
        await (hasTouch ? button.tap() : button.click());
      };
      await tap('Equipos');
      await expect(page.getByText('Mezcladora')).toBeVisible();
      await tap('Editar');
      if (hasTouch) {
        await tap('Editar fila');
      } else {
        await page.getByText('Mezcladora').dblclick();
      }
      const field = page.getByRole('textbox', { name: 'Nombre', exact: true });
      await field.fill('Mezcladora portátil');
      await page
        .getByRole('combobox', { name: 'Tipo', exact: true })
        .selectOption('Equipo especial');
      const price = page.getByRole('textbox', { name: 'Costo/Hora', exact: true });
      await price.focus();
      await expect(price).toHaveValue('3000');
      await price.fill('1.234,56');
      await expect(price).toHaveValue('1.234,56');
      await tap('Listo');
      await expect(page.getByText('Mezcladora portátil')).toBeVisible();
      await expect(page.getByText('Equipo especial', { exact: true })).toBeVisible();
      await tap('Análisis de precios unitarios');
      await tap('Presupuestos');
      await page.goBack();
      await expect(
        page.getByRole('button', { name: 'Análisis de precios unitarios' }),
      ).toHaveAttribute('aria-current', 'true');
      await page.goBack();
      await expect(page.getByText('Mezcladora portátil')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => JSON.parse(sessionStorage.getItem('tablet-cm') ?? '{}').equipos?.[0]?.costo_hora,
          ),
        )
        .toBe(1234.56);
    });

    if (!hasTouch) {
      test('añade dos puntos y termina un ramal solo con teclado', async ({ page }) => {
        await page.goto('/e2e/tablet.html', { waitUntil: 'commit' });
        await page.getByRole('button', { name: 'Dibujar ramal' }).press('Enter');
        await page.locator('summary').press('Enter');
        const x = page.getByRole('spinbutton', { name: 'X (px)' });
        const y = page.getByRole('spinbutton', { name: 'Y (px)' });
        await x.fill('100');
        await y.fill('100');
        await y.press('Enter');
        await x.fill('220');
        await y.press('Enter');
        await page.getByRole('button', { name: 'Terminar' }).press('Enter');
        await expect(page.getByTestId('ramales')).toHaveText('1');
        await expect(page.getByTestId('puntos')).toHaveText('2');
      });
    }

    if (width === 820) {
      test('un arrastre cancelado conserva la geometría; paneo y pellizco mueven la cámara', async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto('/e2e/tablet.html', { waitUntil: 'commit' });
        const canvas = page.getByLabel('Lienzo de prueba');
        await page.getByRole('button', { name: 'Dibujar ramal' }).tap();
        await canvas.tap({ position: { x: 100, y: 100 } });
        await canvas.tap({ position: { x: 400, y: 100 } });
        await page.getByRole('button', { name: 'Terminar' }).tap();
        await page.getByRole('button', { name: 'Seleccionar' }).tap();
        await canvas.tap({ position: { x: 250, y: 100 } });
        await page.getByRole('button', { name: 'Opciones' }).tap();
        await page.getByRole('button', { name: 'Desbloquear movimiento' }).tap();
        const box = (await canvas.boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        const pos = (x: number, y: number, id = 1) => ({ x: box.x + x, y: box.y + y, id });
        const send = (
          type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
          ...touchPoints: ReturnType<typeof pos>[]
        ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        const read = async () => JSON.parse((await canvas.getAttribute('data-gesture'))!);
        const original = await read();
        const endpoint = original.points[0];
        const x = endpoint[0] * original.zoom + original.dx;
        const y = endpoint[1] * original.zoom + original.dy;
        await send('touchStart', pos(x, y));
        await send('touchMove', pos(x - 15, y));
        await send('touchMove', pos(x - 30, y));
        expect(errors).toEqual([]);
        await expect.poll(async () => (await read()).points).not.toEqual(original.points);
        await send('touchCancel');
        expect((await read()).points).toEqual(original.points);
        await page.getByRole('button', { name: 'Panear' }).tap();
        await send('touchStart', pos(170, 130));
        await send('touchMove', pos(220, 130));
        await send('touchEnd');
        expect((await read()).dx).toBeGreaterThan(original.dx);
        await send('touchStart', pos(170, 130), pos(260, 130, 2));
        await send('touchMove', pos(160, 130), pos(280, 130, 2));
        await send('touchMove', pos(130, 130), pos(310, 130, 2));
        await send('touchEnd');
        const after = await read();
        expect(after.zoom).toBeGreaterThan(original.zoom);
        expect(after.points).toEqual(original.points);
        await cdp.detach();
      });
    }
  });
}
