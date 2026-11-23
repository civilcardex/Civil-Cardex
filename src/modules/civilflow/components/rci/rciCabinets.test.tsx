// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../test/render.tsx';
import { clasificar, compute, ejemploVerificacion } from '../../lib/rci/index.ts';
import RciGabinetes from './RCICabinets.tsx';

it('muestra un solo diámetro en la ruta del montante sin desalinear los resultados', async () => {
  const estado = ejemploVerificacion();
  const tips = clasificar(estado);
  const R = compute(estado, tips);
  const { container, unmount } = await renderEnJsdom(
    <RciGabinetes ctx={{ estado, tips, R, edit: false, editar: () => {} }} />,
  );
  try {
    const table = [...container.querySelectorAll('table')].find(
      (candidate) => candidate.caption?.textContent === 'Ruta del montante',
    )!;
    const titles = [...table.tHead!.rows[0].cells].map((th) => th.textContent);
    expect(titles).toHaveLength(15);
    expect(titles.slice(2, 5)).toEqual(['q salida (gpm)', 'Diámetro', 'L (m)']);
    expect(titles).not.toContain('Ø usado');
    const rows = [...table.tBodies[0].rows];
    expect(rows).not.toHaveLength(0);
    expect(rows.map((row) => row.cells.length)).toEqual(rows.map(() => titles.length));
    const diameter = R.gab?.rows[0];
    expect(diameter?.ok).toBe(true);
    expect(rows[0].cells[3].textContent).toBe(diameter?.dnUsed);
  } finally {
    await unmount();
  }
});
