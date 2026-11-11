import { describe, it, expect } from 'vitest';
import { computeUdTable } from '../sanUdTable.ts';
import type { Tramo } from '../../context/tramosReducer.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * Tabla de UD (Unidades de Desague) por tramo: el mismo grafo del chequeo sanitario
 * pero contando aparatos. Ej: un ramal con 2 lavamanos (2 UD c/u) suma 4 UD totales.
 */

const base = [
  { id: 'lvm', nombre: 'Lavamanos', ud: 2 },
  { id: 'san', nombre: 'Inodoro', ud: 4 },
];

const tramo = (over: Partial<Tramo>): Tramo =>
  ({
    id: 'RS1',
    tipo: 'ramal',
    piso: 1,
    fixtures: {},
    ini: 'A1',
    fin: 'B1',
    ...over,
  }) as Tramo;

const filaDe = (tabla: { rows: unknown[][] }, id: string) =>
  tabla.rows.find((r) => r[0] === id) as unknown[] | undefined;

describe('computeUdTable', () => {
  it('sin tramos que mostrar (solo ventilación o nada) devuelve null', () => {
    expect(computeUdTable([], [], [])).toBeNull();
    expect(computeUdTable([tramo({ id: 'V1', net: 'vent', _key: 'V1-p1' })], [], [])).toBeNull();
    expect(computeUdTable([tramo({ id: 'BREV1', _key: 'BREV1-p1' })], [], [])).toBeNull(); // los BREV (bajante de revientamiento de vent) tampoco son descarga
  });

  it('un ramal con aparatos: fila con conteos por aparato y UD acumulada del grafo', () => {
    const tabla = computeUdTable(
      [tramo({ _key: 'RS1-p1', fixtures: { lvm: 2, san: 1 } })],
      [] as PlanItem[],
      base,
    )!;
    expect(tabla.title).toBe('Cálculo de unidades de descarga');
    expect(tabla.headers).toContain('Lavamanos\n(2 UD)');
    expect(tabla.headers).toContain('Inodoro\n(4 UD)');
    const fila = filaDe(tabla, 'RS1')!;
    expect(fila[0]).toBe('RS1');
    expect(fila[1]).toBe('P1'); // pisoCorto(1)
    expect(fila[2]).toBe('A1');
    expect(fila[3]).toBe('B1');
    expect(fila[4]).toBe(2); // lavamanos
    expect(fila[5]).toBe(1); // inodoro
    expect(fila[6]).toBe(8); // 2×2 + 1×4 UD acumuladas (grafo sin descendientes)
  });

  it('la fila Total suma los aparatos de TODOS los tramos san (vent incluida solo si fuera san) y multiplica por su UD', () => {
    const tabla = computeUdTable(
      [
        tramo({ _key: 'RS1-p1', fixtures: { lvm: 2 } }),
        tramo({
          id: 'BAN1',
          _key: 'BAN1-p0',
          esBajante: true,
          tipo: 'bajante',
          piso: 0,
          fixtures: { san: 2 },
        }),
        tramo({ id: 'V1', _key: 'V1-p1', net: 'vent', fixtures: { lvm: 99 } }), // excluida
      ],
      [] as PlanItem[],
      base,
    )!;
    const total = tabla.rows[tabla.rows.length - 1];
    expect(total[0]).toBe('Total');
    expect(total[4]).toBe('2 × 2 UD'); // lavamanos: solo el ramal (la vent no cuenta)
    expect(total[5]).toBe('2 × 4 UD');
    expect(total[6]).toBe(12); // 2·2 + 2·4
  });

  it('orden: por piso ascendente y, a igual piso, ramal antes que bajante', () => {
    const tabla = computeUdTable(
      [
        tramo({ id: 'BAN1', _key: 'BAN1-p1', esBajante: true, tipo: 'bajante', piso: 1 }),
        tramo({ id: 'RS1', _key: 'RS1-p1' }),
        tramo({ id: 'RS0', _key: 'RS0-p0', piso: 0 }),
      ],
      [] as PlanItem[],
      base,
    )!;
    expect(tabla.rows.map((r) => r[0])).toEqual(['RS0', 'RS1', 'BAN1', 'Total']);
  });

  it('ini/fin objeto (punto px) se muestra como "x,y"; ausente cae a "—"', () => {
    const tabla = computeUdTable(
      [
        tramo({
          _key: 'RS1-p1',
          ini: { x: 12, y: 34 } as unknown as Tramo['ini'],
          fin: undefined as unknown as Tramo['fin'],
        }),
      ],
      [] as PlanItem[],
      base,
    )!;
    const fila = filaDe(tabla, 'RS1')!;
    expect(fila[2]).toBe('12,34');
    expect(fila[3]).toBe('—');
  });

  it('los tributarios no salen como fila pero sus aparatos llegan al tramo aguas abajo vía el grafo', () => {
    // RS1 (ramal) recibe a T1 (tributario) por _key encadenado en el grafo de bajantes:
    // sin geometría, enlazamos por descarga del tributario — aquí comprobamos al menos que
    // el tributario no aparece como fila y el total sí incluye sus aparatos.
    const tabla = computeUdTable(
      [
        tramo({ _key: 'RS1-p1', tipo: 'ramal', fixtures: { lvm: 1 } }),
        tramo({ id: 'T1', _key: 'T1-p1', tipo: 'tributario', fixtures: { lvm: 3 } }),
      ],
      [] as PlanItem[],
      base,
    )!;
    expect(tabla.rows.find((r) => r[0] === 'T1')).toBeUndefined();
    const total = tabla.rows[tabla.rows.length - 1];
    expect(total[4]).toBe('4 × 2 UD'); // 1 (ramal) + 3 (tributario)
    expect(total[6]).toBe(8);
  });
});
