import { describe, it, expect } from 'vitest';
import { computeAccesoriosPorRamalTable } from '../fittingsByRamalRows.ts';
import { ACCESORIOS_HIDRO } from '../../constants/index.ts';
import type { Tramo } from '../../context/tramosReducer.ts';

/**
 * Tabla "accesorios por ramal" de la memoria: una fila por tramo con sus accesorios
 * hidráulicos, y las columnas toda-cero se quitan para no ensuciar el PDF.
 * Ej: RAF1-P1 con 2 codos 90° → fila [RAF1-P1, 2, 0, ...] sin las columnas vacías.
 */

const COLS = ACCESORIOS_HIDRO.filter((a) => a.id !== 'llaveTerminal');
/** Índice de la columna de un accesorio DENTRO de la tabla final (dropAllZeroColumns puede quitarnos columnas y reordenar los índices). */
const ixEn = (tabla: { headers: string[] }, id: string) =>
  tabla.headers.indexOf(ACCESORIOS_HIDRO.find((a) => a.id === id)!.nombre);

const tramo = (over: Partial<Tramo>): Tramo =>
  ({ id: 't1', label: 'RAF1', piso: 1, tipo: 'ramal', fixtures: {}, ...over }) as Tramo;

describe('computeAccesoriosPorRamalTable', () => {
  it('sin tramos (o solo tributarios) no hay tabla', () => {
    expect(computeAccesoriosPorRamalTable([], 'Accesorios')).toBeNull();
    expect(
      computeAccesoriosPorRamalTable([tramo({ id: 't1', tipo: 'tributario' })], 'Accesorios'),
    ).toBeNull();
  });

  it('una fila por tramo con etiqueta piso "label-pisoCorto" y conteo por accesorio', () => {
    const tabla = computeAccesoriosPorRamalTable(
      [
        tramo({ accesorios: { codo90rc: 2, teeDirecto: 1, codo90rm: 0 } }),
        // segundo tramo que mantiene viva la columna de codo90rm (sin él sería toda-cero)
        tramo({ id: 't2', label: 'RAF2', piso: 2, accesorios: { codo90rm: 3 } }),
      ],
      'Accesorios hidráulicos',
    )!;
    expect(tabla.title).toBe('Accesorios hidráulicos');
    expect(tabla.headers[0]).toBe('Tramo');
    expect(tabla.headers[ixEn(tabla, 'codo90rc')]).toBe('Codo corto 90°');
    const fila = tabla.rows[0];
    expect(fila[0]).toBe('RAF1-P1');
    expect(fila[ixEn(tabla, 'codo90rc')]).toBe(2);
    expect(fila[ixEn(tabla, 'teeDirecto')]).toBe(1);
    expect(fila[ixEn(tabla, 'codo90rm')]).toBe(0);
    expect(tabla.rows[1][0]).toBe('RAF2-P2');
    expect(tabla.rows[1][ixEn(tabla, 'codo90rm')]).toBe(3);
  });

  it('excluye tributarios pero cuenta los demás tramos', () => {
    const tabla = computeAccesoriosPorRamalTable(
      [
        tramo({ id: 't1', accesorios: { codo90rc: 1 } }),
        tramo({ id: 't2', tipo: 'tributario', accesorios: { codo90rc: 99 } }),
        tramo({ id: 't3', label: 'RB1', piso: -1, accesorios: {} }),
      ],
      'Accesorios',
    )!;
    expect(tabla.rows.map((r) => r[0])).toEqual(['RAF1-P1', 'RB1-S1']);
  });

  it('tramo sin piso no añade sufijo; sin accesorios todos los conteos son 0', () => {
    const tabla = computeAccesoriosPorRamalTable(
      [tramo({ id: 't1', label: undefined, piso: undefined as never, accesorios: undefined })],
      'Accesorios',
    )!;
    expect(tabla.rows[0][0]).toBe('t1');
    expect(tabla.rows.slice(1).every((c) => Number(c) === 0)).toBe(true);
  });

  it('una columna toda-cero desaparece (dropAllZeroColumns) pero la etiqueta se queda', () => {
    const tabla = computeAccesoriosPorRamalTable(
      [tramo({ accesorios: { codo90rc: 2 } })],
      'Accesorios',
    )!;
    expect(tabla.headers).toContain('Codo corto 90°'); // la usada se queda
    expect(tabla.headers).not.toContain('Llave de terminal'); // excluida de entrada
    expect(tabla.headers.length).toBeLessThan(COLS.length + 1);
    // fila con igual número de celdas que headers
    expect(tabla.rows[0].length).toBe(tabla.headers.length);
  });
});
