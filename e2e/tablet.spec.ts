import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  const local = new URL(baseURL!).origin;
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === local ? route.continue() : route.abort(),
  );
});

test.describe('Dibujo RCI táctil', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

  for (const orden of ['brazo primero', 'tronco primero']) {
    test(`tee en tres ramales conectados · ${orden}`, async ({ page }) => {
      await page.goto('/e2e/tablet.html?rci-drawing=tee');
      const canvas = page.getByLabel('Lienzo de prueba');
      const tap = (x: number, y: number) => canvas.tap({ position: { x, y } });
      const draw = async (points: [number, number][]) => {
        for (const [x, y] of points) await tap(x, y);
        await tap(...points.at(-1)!);
      };
      const tronco: [number, number][] = [
        [65, 125],
        [415, 125],
      ];
      const brazo: [number, number][] = [
        [250, 45],
        [250, 125],
      ];
      await page.getByRole('button', { name: 'Dibujar ramal', exact: true }).tap();
      await draw(orden === 'brazo primero' ? brazo : tronco);
      await expect(page.getByTestId('ramales')).toHaveText('1');
      await draw(orden === 'brazo primero' ? tronco : brazo);
      await expect(page.getByTestId('ramales')).toHaveText('3');
      await expect(page.getByRole('alert')).toHaveCount(0);
      const pts = JSON.parse((await canvas.getAttribute('data-topology'))!) as number[][][];
      const extremos = pts.flatMap((r) => [r[0], r.at(-1)]).map((p) => JSON.stringify(p));
      expect(extremos.some((x) => extremos.filter((y) => x === y).length === 3)).toBe(true);
    });
  }

  test('DMR: no permite terminar un ramal en L con el muro vertical fuera del límite', async ({
    page,
  }) => {
    await page.goto('/e2e/tablet.html?rci-drawing=dmr');
    const canvas = page.getByLabel('Lienzo de prueba');
    const tap = (x: number, y: number) => canvas.tap({ position: { x, y } });
    await page.getByRole('button', { name: 'Dibujar ramal', exact: true }).tap();
    await tap(70, 155);
    await tap(245, 155);
    await tap(245, 65);
    await tap(245, 65);
    await expect(page.getByRole('alert')).toContainText('distancia máxima a muro (DMR)');
    await expect(page.getByTestId('ramales')).toHaveText('0');
    await tap(70, 155);
    await tap(390, 155);
    await tap(390, 65);
    await tap(390, 65);
    await expect(page.getByTestId('ramales')).toHaveText('1');
  });
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
      const cancel = page.getByRole('button', { name: 'Cancelar', exact: true });
      const cancelBox = await cancel.boundingBox();
      const cancelFace = await cancel.locator('span').boundingBox();
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
        // En tablet no hay «Terminar»: el gesto cancelado no debe cerrar el ramal
        // aunque el siguiente toque caiga cerca del punto anterior.
        await at(140, 130);
        await at(140, 130);
        await expect(page.getByTestId('ramales')).toHaveText('0');
        await tap('Cancelar'); // descarta el punto suelto que dejó el toque de prueba
        await expect(page.getByTestId('puntos')).toHaveText('0');
        await cdp.detach();
      }
      if (hasTouch) {
        // Doble toque: el 1.er toque añade el punto y el 2.º cierra sin duplicarlo.
        await at(100, 100);
        await at(220, 100);
        await at(220, 100);
      } else {
        await at(100, 100);
        await at(220, 100);
        await tap('Terminar');
      }
      await expect(page.getByTestId('ramales')).toHaveText('1');
      await expect(page.getByTestId('puntos')).toHaveText('2');
      await at(110, 160);
      await tap('Cancelar');
      await expect(page.getByTestId('ramales')).toHaveText('1');
      await tap('Seleccionar');
      await at(160, 100);
      const options = page.getByRole('button', { name: 'Opciones', exact: true });
      await expect(options).toBeVisible();
      const optionsBox = await options.boundingBox();
      expect([optionsBox!.width, optionsBox!.height]).toEqual([
        cancelBox!.width,
        cancelBox!.height,
      ]);
      const optionsFace = (await options.locator('span').boundingBox())!;
      expect([optionsFace.width, optionsFace.height]).toEqual([
        cancelFace!.width,
        cancelFace!.height,
      ]);
      expect(optionsFace.height).toBeGreaterThanOrEqual(30);
      if (hasTouch) expect(optionsBox!.height).toBeGreaterThanOrEqual(48);
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
      await expect(page.getByRole('button', { name: 'Mezcladora', exact: true })).toHaveCount(0);
      await tap('Editar');
      await tap('Mezcladora');
      const field = page.getByRole('textbox', { name: 'Nombre', exact: true });
      await expect(field).toBeFocused();
      if (!hasTouch) {
        await field.fill('No guardar');
        await field.press('Escape');
        await expect(page.getByText('Mezcladora', { exact: true })).toBeVisible();
        await tap('Mezcladora');
      }
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
      // H-10 (remediación 2026-11-27): el escritorio recupera la entrada POR COORDENADAS —
      // crear y terminar un ramal usando SOLO el teclado, sin un solo clic en el lienzo.
      test('termina por teclado con coordenadas; fuera del plano se anuncia y Escape cancela', async ({
        page,
      }) => {
        await page.goto('/e2e/tablet.html', { waitUntil: 'commit' });
        await page.getByRole('button', { name: 'Dibujar ramal' }).press('Enter');
        await expect(page.getByText('Trazar por coordenadas', { exact: true })).toBeVisible();
        await page.getByText('Trazar por coordenadas', { exact: true }).press('Enter'); // abre el <details>
        const x = page.getByLabel('X (px)');
        const y = page.getByLabel('Y (px)');
        // Fuera del plano: error anunciado, sin puntos.
        await x.fill('99999');
        await y.fill('99999');
        await page.getByRole('button', { name: 'Añadir punto' }).press('Enter');
        await expect(page.getByText('El punto debe quedar dentro del plano.')).toBeVisible();
        await expect(page.getByTestId('puntos')).toHaveText('0');
        // Dos puntos dentro, por teclado.
        const punto = async (vx: string, vy: string) => {
          await x.fill(vx);
          await y.fill(vy);
          await page.getByRole('button', { name: 'Añadir punto' }).press('Enter');
        };
        await punto('100', '100');
        await punto('220', '100');
        // El conteo de puntos se publica en onDirty (al TERMINAR), no en cada vértice.
        await page.getByRole('button', { name: 'Terminar' }).press('Enter');
        await expect(page.getByTestId('ramales')).toHaveText('1');
        await expect(page.getByTestId('puntos')).toHaveText('2');
        await page.getByRole('button', { name: /^Editar .+/ }).press('Enter');
        await expect(page.getByText('Opciones del ramal seleccionado')).toBeVisible();
        await expect(page.getByRole('button', { name: /^Borrar .+/ })).toHaveCount(0);
        // Escape cancela un trazado nuevo sin crear ramal (foco FUERA del form: dentro de
        // él las teclas no llegan al motor — Enter debe poder enviar el punto).
        await page.getByRole('button', { name: 'Dibujar ramal' }).press('Enter');
        await punto('300', '100');
        await page.getByLabel('X (px)').blur();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('ramales')).toHaveText('1');
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
        await canvas.tap({ position: { x: 400, y: 100 } }); // doble toque cierra el ramal
        await page.getByRole('button', { name: 'Seleccionar', exact: true }).tap();
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
