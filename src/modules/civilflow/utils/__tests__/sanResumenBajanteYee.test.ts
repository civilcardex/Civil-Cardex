import { describe, it, expect, beforeEach } from 'vitest';
import { computeAccesoriosTable, compactYeeDiam } from '../sanAccesoriosRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

function setLocalStorage(key: string, val: unknown) {
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + key,
    JSON.stringify(val),
  );
}

function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}

const plans = [{ id: 1, name: 'P1', nivel: 1, status: 'confirmed' as const }];

const tramo = (o: Record<string, unknown>) =>
  ({
    planId: 1,
    piso: 1,
    fixtures: {},
    ...o,
  }) as unknown as Tramo;

function colTotal(table: NonNullable<ReturnType<typeof computeAccesoriosTable>>, nombre: string) {
  const idx = table.headers.indexOf(nombre);
  if (idx < 0) return 0;
  return table.rows.reduce((s, r) => s + Number(r[idx] || 0), 0);
}

function rowCount(
  table: NonNullable<ReturnType<typeof computeAccesoriosTable>>,
  diam: string,
  nombre: string,
) {
  const idx = table.headers.indexOf(nombre);
  if (idx < 0) return 0;
  const row = table.rows.find((r) => String(r[0]) === diam);
  return row ? Number(row[idx] || 0) : 0;
}

describe('compactYeeDiam', () => {
  it('resume brazos iguales a un solo valor', () => {
    expect(compactYeeDiam(['4"', '4"', '2"'])).toBe('4"×2"');
    expect(compactYeeDiam(['4"', '4"', '4"'])).toBe('4"');
    expect(compactYeeDiam(['2"', '4"'])).toBe('2"×4"');
    expect(compactYeeDiam(['4"', '4"'])).toBe('4"');
  });
});

describe('Resumen san — conexión ramal→bajante', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('ramal 4" → bajante 4": yee simple 4" + codo 90 de 4", sin codo 45', () => {
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [40, 0],
          ],
          diametro: '4"',
        },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', x: 40, y: 0, dNominal: '4"', recibeDeIds: ['RS1'] }],
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '4"', diamDisPulg: 4 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '4"', 'Yee simple')).toBe(1);
    expect(rowCount(table!, '4"', 'Codo medio 90°')).toBe(1);
    expect(colTotal(table!, 'Codo corto 45°')).toBe(0);
  });

  it('ramal 2" → bajante 4": yee 2"×4" + codo 90 de 4" + bushing 4_2', () => {
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [40, 0],
          ],
          diametro: '2"',
        },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', x: 40, y: 0, dNominal: '4"', recibeDeIds: ['RS1'] }],
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"×4"', 'Yee simple')).toBe(1);
    expect(rowCount(table!, '4"', 'Codo medio 90°')).toBe(1);
    expect(table!.bushingCounts?.['4_2']).toBe(1);
  });

  it('codo manual en el extremo del bajante no duplica el codo 90', () => {
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [40, 0],
          ],
          diametro: '4"',
          accesorioFin: 'codo90rmBaja',
          diametroFin: '4"',
        },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', x: 40, y: 0, dNominal: '4"', recibeDeIds: ['RS1'] }],
    });
    const table = computeAccesoriosTable(
      'san',
      [
        tramo({
          id: 'RS1',
          _key: 'RS1-1',
          tipo: 'ramal',
          diametro: '4"',
          diamDisPulg: 4,
          accesorioFin: 'codo90rmBaja',
          diametroFin: '4"',
        }),
      ],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    // solo el explícito (1), sin auto segundo
    expect(rowCount(table!, '4"', 'Codo medio 90°')).toBe(1);
    expect(rowCount(table!, '4"', 'Yee simple')).toBe(1);
  });
});

describe('Resumen san — yee geométrica y bushing', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('yee 4×4×2 se resume a 4"×2" y genera bushing 4_2', () => {
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [40, 0],
          ],
          diametro: '4"',
        },
        {
          id: 'RS2',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [40, 0],
            [80, 0],
          ],
          diametro: '4"',
        },
        {
          id: 'T1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [40, 0],
            [60, 20],
          ],
          diametro: '2"',
        },
      ],
      bajantes: [],
    });
    const table = computeAccesoriosTable(
      'san',
      [
        tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '4"', diamDisPulg: 4 }),
        tramo({ id: 'RS2', _key: 'RS2-1', tipo: 'ramal', diametro: '4"', diamDisPulg: 4 }),
        tramo({ id: 'T1', _key: 'T1-1', tipo: 'tributario', diametro: '2"', diamDisPulg: 2 }),
      ],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '4"×2"', 'Yee simple')).toBe(1);
    expect(table!.bushingCounts?.['4_2']).toBe(1);
  });

  it('tributario con codoReventilado explícito se cuenta', () => {
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'T1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [0, 0],
            [0, 30],
          ],
          diametro: '4"',
          accesorioFin: 'codoReventilado',
          diametroFin: '4"',
        },
      ],
      bajantes: [],
    });
    const table = computeAccesoriosTable(
      'san',
      [
        tramo({
          id: 'T1',
          _key: 'T1-1',
          tipo: 'tributario',
          diametro: '4"',
          diamDisPulg: 4,
          accesorioFin: 'codoReventilado',
          diametroFin: '4"',
        }),
      ],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '4"', 'Codo reventilado')).toBe(1);
  });
});
