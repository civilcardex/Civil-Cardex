import { describe, it, expect, beforeEach } from 'vitest';
import { loadSanLlTramos } from '../buildTramos';
import { buildSanConnectivity } from '../sanConnectivity';
import { computeSanRows } from '../sanRows';
import type { PlanItem } from '../../context/PlansContext';

// Yee doble: un tributario en un cluster sin salida (tronco muerto sin `fin`) se quedaba sin
// arista y su UD desaparecía del total (no se muestra en ninguna fila). Ahora cuelga de su
// `padre` declarado (orig. usuario).
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
const base = [{ id: 'lv', nombre: 'Lavamanos', ud: 2 }];

const R = (id: string, pts: number[][], extra: Record<string, unknown> = {}) => ({
  id,
  net: 'san',
  tipo: 'ramal',
  padre: null,
  pts,
  label: id,
  ...extra,
});
const T = (id: string, pts: number[][], padre: string) => ({
  id,
  net: 'san',
  tipo: 'tributario',
  padre,
  pts,
  label: id,
});

function setup(ramales: unknown[], aparatosByTramo: Record<string, Record<string, number>>) {
  setLocalStorage('dibujo_sanitario_v1', {
    planes: { '1': { planoId: 1, ramales, bajantes: [] } },
    aparatosByTramo,
    updatedAt: 1,
  });
  setLocalStorage('trazos_1', { v: 3, ts: 1, ramales, bajantes: [] });
  const { sanIncoming } = loadSanLlTramos();
  const conn = buildSanConnectivity(sanIncoming, plans as unknown as PlanItem[], base);
  const display = sanIncoming.filter((t) => t.tipo === 'ramal' && !t.esBajante);
  const rows = computeSanRows(
    display,
    conn.componentTotalMap,
    base,
    sanIncoming,
    conn.fullChildrenMap,
  );
  return { rows, conn };
}

describe('yee doble — segundo brazo sin salida', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('dos tributarios en extremo muerto: ambas UD llegan al total', () => {
    const { rows } = setup(
      [
        R('RS1', [
          [0, 0],
          [100, 0],
        ]),
        T(
          'T1',
          [
            [80, -30],
            [100, 0],
          ],
          'RS1',
        ),
        T(
          'T2',
          [
            [120, 20],
            [100, 0],
          ],
          'RS1',
        ),
      ],
      { san_T1_1: { lv: 1 }, san_T2_1: { lv: 2 } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].udPropias).toBe(6);
    expect(rows[0].udAcum).toBe(6);
  });

  it('dos brazos con split: sin cambios (propia == total)', () => {
    const { rows } = setup(
      [
        R('RS1', [
          [0, 0],
          [50, 0],
        ]),
        R(
          'RS5',
          [
            [50, 0],
            [100, 0],
          ],
          { mergesFrom: ['RS1', 'T1'] },
        ),
        T(
          'T1',
          [
            [40, -30],
            [50, 0],
          ],
          'RS1',
        ),
        T(
          'T2',
          [
            [60, 20],
            [50, 0],
          ],
          'RS1',
        ),
      ],
      { san_T1_1: { lv: 1 }, san_T2_1: { lv: 2 } },
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('RS5')?.udPropias).toBe(6);
    expect(byId.get('RS5')?.udAcum).toBe(6);
  });

  it('ramal + tributario en vértice: sin cambios', () => {
    const { rows } = setup(
      [
        R('RS7', [
          [0, 0],
          [50, 0],
        ]),
        R('RS9', [
          [50, 0],
          [100, 0],
        ]),
        R('RS8', [
          [30, 40],
          [50, 0],
        ]),
        T(
          'T1',
          [
            [70, -30],
            [50, 0],
          ],
          'RS9',
        ),
      ],
      { san_RS8_1: { lv: 1 }, san_T1_1: { lv: 2 } },
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('RS9')?.udAcum).toBe(6);
  });

  it('tronco con fin: sin cambios (recibe normal)', () => {
    const { rows } = setup(
      [
        R(
          'RS1',
          [
            [0, 0],
            [100, 0],
          ],
          { fin: 'B1' },
        ),
        T(
          'T1',
          [
            [80, -30],
            [100, 0],
          ],
          'RS1',
        ),
        T(
          'T2',
          [
            [120, 20],
            [100, 0],
          ],
          'RS1',
        ),
      ],
      { san_T1_1: { lv: 1 }, san_T2_1: { lv: 2 } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].udAcum).toBe(6);
  });
});
