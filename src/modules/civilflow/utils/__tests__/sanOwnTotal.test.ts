import { describe, it, expect, beforeEach } from 'vitest';
import { loadSanLlTramos } from '../buildTramos';
import { buildSanConnectivity } from '../sanConnectivity';
import { computeSanRows } from '../sanRows';
import type { PlanItem } from '../../context/PlansContext';

// UD propia incluye los tributarios que REALMENTE descargan en el segmento (grafo), no los
// del `padre` declarado — tras un split el padre puede quedar aguas arriba y su UD ya no
// pertenece a la propia de ese tramo (orig. usuario: propia == total si solo hay tributarios).
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

describe('sanitaria — propia incluye sus tributarios', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('ramal + tributario directo: propia == total', () => {
    const { rows } = setup(
      [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          padre: null,
          pts: [
            [0, 0],
            [100, 0],
          ],
          label: 'RS1',
        },
        {
          id: 'T1RS1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [50, -40],
            [50, 0],
          ],
          label: 'T1RS1',
        },
      ],
      { san_T1RS1_1: { lv: 1 } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].udPropias).toBe(2);
    expect(rows[0].udAcum).toBe(2);
  });

  it('ramal partido: el tributario cuenta en el tramo aguas abajo, no en el de arriba', () => {
    const { rows, conn } = setup(
      [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          padre: null,
          pts: [
            [0, 0],
            [50, 0],
          ],
          label: 'RS1',
        },
        {
          id: 'RS5',
          net: 'san',
          tipo: 'ramal',
          padre: null,
          pts: [
            [50, 0],
            [100, 0],
          ],
          label: 'RS5',
          mergesFrom: ['RS1', 'T1RS1'],
        },
        {
          id: 'T1RS1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [50, -40],
            [50, 0],
          ],
          label: 'T1RS1',
        },
      ],
      { san_RS1_1: { lv: 1 }, san_T1RS1_1: { lv: 1 } },
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    // Tramo aguas arriba: solo lo propio (el tributario une aguas abajo).
    expect(byId.get('RS1')?.udPropias).toBe(2);
    expect(byId.get('RS1')?.udAcum).toBe(2);
    // Tramo aguas abajo: propia = tributario; total suma el tramo de arriba (visible en Otros).
    expect(byId.get('RS5')?.udPropias).toBe(2);
    expect(byId.get('RS5')?.udAcum).toBe(4);
    expect(conn.displayMap['RS5-1']).toEqual(['RS1-1']);
  });
});
