import { describe, it, expect, beforeEach } from 'vitest';
import { computeAccesoriosTable } from '../sanAccesoriosRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Resumen san (orig. usuario 2026-09-18): 1) extremo con símbolo de aparato → 1 codo 90 del
// diámetro de ESE extremo (sin duplicar el que ya produce un sifón); 2) cajas (caja_san/caja_ll)
// y bombas: CERO accesorios aunque tengan dNominal y ramales conectados.

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

describe('Resumen san — codo por aparato y cajas/bombas sin accesorios', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('aparato en extremo: 1 codo 90 del diámetro del ramal', () => {
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
          aparatoFin: 'inodoro',
        },
      ],
      bajantes: [],
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(1);
    expect(colTotal(table!, 'Yee simple')).toBe(0);
  });

  it('aparato en el extremo INICIAL usa el diámetro de ese extremo', () => {
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
          aparatoInicio: 'lavamanos',
          diametroInicio: '2"',
        },
      ],
      bajantes: [],
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
          diametroInicio: '2"',
        }),
      ],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(1);
    expect(rowCount(table!, '4"', 'Codo medio 90°')).toBe(0);
  });

  it('dedupe: sifón + aparato en el MISMO extremo → un solo codo', () => {
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
          accesorioFin: 'sifon',
          aparatoFin: 'inodoro',
        },
      ],
      bajantes: [],
    });
    // El motor escribe el codo 90 sube implícito del sifón en hidroData.
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { sifon: 1, codo90rmSube: 1 }, Lh: 0, nSalidas: 1 },
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(1);
  });

  it.each([
    ['caja_san', 'caja'],
    ['caja_ll', 'caja lluvias'],
    ['bomba', 'bomba'],
  ])('%s con dNominal y ramal conectado: CERO accesorios', (tipo) => {
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
      bajantes: [{ id: 'X1', net: 'san', tipo, x: 40, y: 0, dNominal: '4"', recibeDeIds: ['RS1'] }],
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '4"', diamDisPulg: 4 })],
      plans as unknown as PlanItem[],
    );
    // Cero accesorios ⇒ la tabla viene null (totalsByDiameter vacío).
    expect(table).toBeNull();
  });

  it('reventilado manual SIN aparato: el codo 90 reemplazado se sigue contando', () => {
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
          accesorioFin: 'codoReventilado',
        },
      ],
      bajantes: [],
    });
    // El motor escribe el reventilado del accesorio en hidroData.
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { codoReventilado: 1 }, Lh: 0, nSalidas: 1 },
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo reventilado')).toBe(1);
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(1);
  });

  it('aparato + reventilado en el mismo extremo: reventilado + UN solo codo 90', () => {
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
          accesorioFin: 'codoReventilado',
          aparatoFin: 'inodoro',
        },
      ],
      bajantes: [],
    });
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { codoReventilado: 1 }, Lh: 0, nSalidas: 1 },
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo reventilado')).toBe(1);
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(1);
  });

  it('reventilado AUTOdetectado (sin accesorio en el extremo): sin codo 90 extra', () => {
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
      bajantes: [],
    });
    // El motor detecta la unión vent⊥san y escribe el reventilado en hidroData.
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { codoReventilado: 1 }, Lh: 0, nSalidas: 1 },
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(table).not.toBeNull();
    expect(rowCount(table!, '2"', 'Codo reventilado')).toBe(1);
    expect(rowCount(table!, '2"', 'Codo medio 90°')).toBe(0);
  });
});
