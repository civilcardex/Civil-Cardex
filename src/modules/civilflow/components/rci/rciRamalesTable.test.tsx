// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../test/render.tsx';
import { RciRamalesTable } from './RCIRamalesTable.tsx';
import type { FilaRamalRci } from '../../utils/rci/RCIRowsModel.ts';

const ramal: FilaRamalRci = {
  id: '1|RRCI1',
  nombre: 'R1',
  con: 'A',
  dib: 5,
  fluyen: 4,
  auto: true,
  dn: 'auto',
  mat: 'Acero SCH 40',
  troc: 'Colgante',
  Lr: 22.51,
  dnUsado: null,
  Q: null,
  P: null,
  brazo: null,
  rocIni: 1,
  rocFin: 5,
  Pf: null,
  Pe: null,
  Keq: null,
  Vmax: null,
  Qeq: null,
  Peq: null,
  ok: false,
};

it.each([false, true])(
  'cabecera, pie y cuerpo de 20 columnas (con datos: %s)',
  async (populated) => {
    const { container, unmount } = await renderEnJsdom(
      <RciRamalesTable
        rams={populated ? [ramal] : []}
        piso="P1"
        rd={populated ? { dibTot: 5, flTot: 4 } : null}
        editRam={false}
        setRamal={() => () => {}}
        zRamTxt="5"
        okN={true}
        roc={{ Nreq: 4, Nramal: 4, Llargo: 14.17 }}
      />,
    );
    try {
      const table = container.querySelector('table')!;
      const [groups, columns] = Array.from(table.tHead!.rows);
      const cells = (row: HTMLTableRowElement) => [...row.cells];
      const width = (row: HTMLTableRowElement) =>
        cells(row).reduce((n, cell) => n + cell.colSpan, 0);
      expect(cells(groups).map((cell) => [cell.textContent, cell.colSpan, cell.rowSpan])).toEqual([
        ['Ramal', 1, 2],
        ['Recorrido', 2, 1],
        ['Rociadores', 4, 1],
        ['Tubería del ramal (Ø único)', 2, 1],
        ['Cota (m)', 1, 2],
        ['Resultados', 10, 1],
      ]);
      expect(width(columns) + 2).toBe(20);
      expect(columns.cells[0].textContent).toBe('Inicio');
      expect(columns.cells[17].textContent).toBe('Estado');
      expect(width(table.tBodies[0].rows[0])).toBe(20);
      const foot = table.tFoot!.rows[0];
      expect(width(foot)).toBe(20);
      if (populated) {
        const data = table.tBodies[0].rows[0].cells;
        expect([data[0].textContent, data[6].textContent, data[9].textContent]).toEqual([
          'RRCI1-P1',
          '1–5',
          '5',
        ]);
        expect([foot.cells[2].textContent, foot.cells[3].textContent]).toEqual(['5', '4']);
      }
    } finally {
      await unmount();
    }
  },
);
