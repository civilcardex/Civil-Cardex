import { expect, test } from '@playwright/test';

test.describe('Acceso táctil al catálogo', () => {
  test.use({ hasTouch: true });

  test('Catálogo maestro es visible y se abre desde Parámetros en tableta', async ({ page }) => {
    await page.route('**/*', (route) =>
      new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort(),
    );
    await page.addInitScript(() => {
      sessionStorage.setItem('fixture-cf-proyecto', JSON.stringify({ proyecto_general: {} }));
      localStorage.setItem('cardex_tour_cf_catmaestro', '1');
    });
    await page.setViewportSize({ width: 744, height: 1133 });
    await page.goto('/e2e/tablet.html?cf-setup=1');
    await page.getByRole('button', { name: 'Parámetros de diseño' }).tap();
    const catalog = page.getByRole('link', { name: 'Catálogo maestro', exact: true });
    const table = page.getByRole('table', {
      name: 'Materiales y profundidad de instalación por red',
    });
    await expect(catalog).toBeInViewport({ ratio: 1 });
    const tableBox = (await table.boundingBox())!;
    expect((await catalog.boundingBox())!.y).toBeGreaterThanOrEqual(tableBox.y + tableBox.height);

    await page.setViewportSize({ width: 1133, height: 600 });
    const panel = page.locator('[data-tour="cf-tab-datos"]');
    const bounds = await panel.evaluate((el) => ({
      horizontalOverflow: el.scrollWidth - el.clientWidth,
      verticalOverflow: el.scrollHeight - el.clientHeight,
    }));
    expect(bounds.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(bounds.verticalOverflow).toBeGreaterThan(0);
    await catalog.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
    await page.keyboard.press('PageDown');
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await catalog.scrollIntoViewIfNeeded();
    await expect(catalog).toBeInViewport({ ratio: 1 });
    await catalog.tap();
    await expect(page).toHaveURL(/\/catalogomaestro$/);
    await expect(page.getByRole('heading', { name: /Catálogo Maestro/i })).toBeVisible();
  });
});

test('zonas de almacenamiento: crear por piso, conservar al suspender y reasignar tras eliminar el piso', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/e2e/tablet.html?rci-entradas&rci-zonas');
  /* Flujo NUEVO (2026-11-27): la decisión de almacenamiento vive POR PISO en Pisos del
   * edificio (columnas Almacenamiento/Zonas) y las fichas se editan en el modal. */
  const editar = () => page.getByRole('button', { name: 'EDITAR', exact: true }).click();
  const fila1 = page.getByRole('row', { name: /Piso de prueba 1/ });
  const almacen1 = () => fila1.getByLabel('Almacenamiento de Piso de prueba 1');
  const modal = page.getByRole('dialog', { name: 'Zonas de almacenamiento' });

  await editar({ timeout: 20_000 });
  await almacen1().selectOption('Sí');
  await fila1.getByRole('button', { name: 'Agregar zona' }).click();
  await modal.getByRole('button', { name: 'Agregar zona' }).click(); // ficha directa
  await modal.getByLabel('Nombre de la zona').fill('Depósito de repuestos');
  await modal.getByLabel('Forma de almacenamiento').selectOption('Rack de una fila');
  await expect(modal.getByLabel('Repisas')).toBeVisible();
  await modal.getByLabel('Clase de mercancía').selectOption('Plástico grupo A');
  await expect(modal.getByLabel('Plástico grupo A', { exact: true })).toBeVisible();
  await modal.getByLabel('Altura de arrume (m)', { exact: true }).fill('2.5');
  await expect(modal.getByLabel('Altura de techo de la zona (m)')).toHaveAccessibleDescription(
    /hereda.*4 m/,
  );
  await modal.getByRole('button', { name: 'Guardar zona' }).click(); // vuelve a la LISTA
  await modal.getByRole('button', { name: 'Guardar zonas' }).click(); // confirma y cierra

  // Suspender con «No»: la celda deja de ofrecer botón (las fichas se conservan en el estado).
  await almacen1().selectOption('No');
  await expect(fila1.getByRole('button', { name: /zona/ })).toHaveCount(0);
  await almacen1().selectOption('Sí');
  await fila1.getByRole('button', { name: '1 zona' }).click();
  await modal.getByRole('button', { name: 'Editar' }).click();
  await expect(modal.getByLabel('Altura de arrume (m)', { exact: true })).toHaveValue('2.5');
  await modal.getByRole('button', { name: 'Guardar zona' }).click();
  await modal.getByRole('button', { name: 'Guardar zonas' }).click();

  // Recarga: el almacenamiento del piso y su ficha sobreviven en el estado del proyecto.
  await page.reload();
  await editar({ timeout: 20_000 });
  await expect(fila1.getByLabel('Almacenamiento de Piso de prueba 1')).toHaveValue('Sí');
  await fila1.getByRole('button', { name: '1 zona' }).click();
  await modal.getByRole('button', { name: 'Guardar zonas' }).click();

  // Piso eliminado → ficha HUÉRFANA: nota por reasignar y reasignación explícita a piso 2.
  await page.getByRole('button', { name: 'Simular eliminación del piso 1' }).click();
  await expect(page.getByText(/Zonas por reasignar/)).toBeVisible();
  await page.getByRole('button', { name: 'Reasignar zonas' }).click();
  await modal.getByRole('button', { name: 'Editar' }).click(); // abre la ficha huérfana
  await expect(modal.getByText(/El piso asignado ya no existe/)).toBeVisible();
  await modal.getByLabel('Piso', { exact: true }).selectOption('piso-2');
  await expect(modal.getByText(/El piso asignado ya no existe/)).toBeHidden();
  await expect(modal.getByLabel('Altura de techo de la zona (m)')).toHaveAccessibleDescription(
    /hereda.*5 m/,
  );
  await modal.getByRole('button', { name: 'Guardar zona' }).click(); // ficha → lista
  await modal.getByRole('button', { name: 'Guardar zonas' }).click(); // cierra

  // El piso 2 hereda la ficha y su contador; el piso 1 ya no existe en la tabla. La celda
  // del piso 2 muestra su botón solo tras marcarlo «Sí» (su decisión era «Por definir»).
  const fila2 = page.getByRole('row', { name: /Piso de prueba 2/ });
  await fila2.getByLabel('Almacenamiento de Piso de prueba 2').selectOption('Sí');
  await expect(fila2.getByRole('button', { name: '1 zona' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Piso de prueba 1/ })).toHaveCount(0);
});

test('creación, guía, elección de material, cotas y carga múltiple de planos', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' ? route.continue() : route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/tablet.html?cf-setup=1');
  const dialog = page.getByRole('dialog', { name: 'Nuevo proyecto' });
  await expect(dialog)
    .toBeVisible({ timeout: 20_000 })
    .catch((error) => {
      expect(errors).toEqual([]);
      throw error;
    });
  const name = dialog.getByLabel('Nombre del proyecto');
  const country = dialog.getByLabel('País', { exact: true });
  const use = dialog.getByLabel('Tipo de uso');
  const create = dialog.getByRole('button', { name: 'Crear proyecto' });
  const countryError = dialog.getByText('Selecciona un país para continuar.', { exact: true });
  const useError = dialog.getByText('Selecciona un tipo de uso para continuar.', { exact: true });
  await expect(countryError).toBeHidden();
  await expect(useError).toBeHidden();
  await name.fill('Edificio de prueba');
  await name.press('Enter');
  await expect(country).toBeFocused();
  await expect(countryError).toBeVisible();
  await expect(useError).toBeVisible();
  await expect(country).toHaveAccessibleDescription('Selecciona un país para continuar.');
  await expect(use).toHaveAccessibleDescription('Selecciona un tipo de uso para continuar.');
  await country.selectOption('Perú');
  await expect(countryError).toBeHidden();
  await expect(useError).toBeVisible();
  await create.click();
  await expect(use).toBeFocused();
  await use.selectOption('Comercial');
  await expect(useError).toBeHidden();
  await create.click();
  await expect(page.getByText('NPT significa Nivel de Piso Terminado.')).toBeVisible();
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('Perú');
  await expect(
    page.getByText('2.1. Contra incendio: primero Diseño de redes, después Dibujo.'),
  ).toBeVisible();
  const guide = page.getByRole('heading', { name: 'Guía de uso' });
  const steps = guide.locator('xpath=ancestor::section[1]').getByRole('list');
  await expect(steps).toHaveCSS('list-style-type', 'decimal');
  await expect(steps.getByRole('listitem')).toHaveCount(8);
  await expect(steps.getByRole('listitem').last()).toContainText('Genera los informes.');
  const identification = page.getByRole('heading', { name: 'Identificación del proyecto' });
  expect((await guide.boundingBox())!.x).toBeLessThan((await identification.boundingBox())!.x);
  for (const [width, height, columns] of [
    [390, 844, 1],
    [744, 1133, 2],
    [820, 1180, 2],
    [1180, 820, 2],
    [1440, 1000, 4],
  ]) {
    await page.setViewportSize({ width, height });
    const actual = await page.locator('.cf-info-settings').evaluate((settings) => {
      const panel = settings.closest('.cf-info-layout')!;
      return {
        columns: getComputedStyle(settings).gridTemplateColumns.split(' ').length,
        overflow: panel.scrollWidth - panel.clientWidth,
      };
    });
    expect(actual.columns).toBe(columns);
    expect(actual.overflow).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  expect((await guide.boundingBox())!.y).toBeLessThan((await identification.boundingBox())!.y);
  await expect(steps.getByRole('listitem').last()).toBeVisible();
  await page.getByRole('button', { name: 'Parámetros de diseño' }).click();
  const editor = page
    .getByRole('heading', { name: 'Materiales por red' })
    .locator('xpath=ancestor::section[1]');
  const rci = editor.getByLabel('Material de Contra incendio');
  await expect(rci).toHaveValue('');
  await expect(editor.getByText('PVC-S', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'EDITAR', exact: true }).click();
  await rci.selectOption('PVC C900 RDE 18');
  await editor.getByLabel('Profundidad de Gas').fill('-0,45');
  await editor.getByRole('button', { name: 'LISTO', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Gas');
  await expect(editor.getByRole('alert')).toContainText('Contra incendio');
  await expect(rci).toBeEnabled();
  await editor.getByLabel('Profundidad de Gas').fill('-0,25');
  await editor.getByRole('button', { name: 'LISTO', exact: true }).click();
  await expect(rci).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem('fixture-cf-proyecto') ?? '{}').proyecto_general
            ?.mat_rci,
      ),
    )
    .toBe('PVC C900 RDE 18');
  await page.goto('/e2e/tablet.html?cf-setup=1');
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('Perú');
  await page.getByRole('button', { name: 'Parámetros de diseño' }).click();
  await expect(page.getByLabel('Material de Contra incendio')).toHaveValue('PVC C900 RDE 18');
  await page.getByRole('button', { name: 'Carga de planos' }).click();
  const file = (name: string) => ({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n'),
  });
  const picker = page.locator('input[type=file]');
  await picker.setInputFiles(file('Planta única.pdf'));
  await expect(page.getByText('Planta única.pdf', { exact: true }).first()).toBeVisible();
  await picker.setInputFiles([file('Piso uno.pdf'), file('Piso dos.pdf')]);
  await expect(page.getByText('Piso uno.pdf', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Piso dos.pdf', { exact: true }).first()).toBeVisible();
});
