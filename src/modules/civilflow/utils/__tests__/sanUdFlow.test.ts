import { describe, it, expect, beforeEach } from 'vitest';
import { buildSanConnectivity } from '../sanConnectivity';
import { computeSanRows } from '../sanRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Reporte usuario: T2RS7 quedaba VACÍA pese a llegarle T10RS7 y T4RS7, y eso se propagaba
// aguas abajo. Causa típica: flecha de descarga invertida por historia (conversiones, splits)
// — el extremo de descarga no toca a nadie y el tramo queda sin arista → UD perdida.
// Arreglo: reintento por el OTRO extremo cuando el de descarga no encuentra receptor.
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

const tramo = (o: Record<string, unknown>) =>
  ({ planId: 1, piso: 1, fixtures: {}, tipo: 'tributario', ...o }) as unknown as Tramo;
const plan = { id: 1, nivel: 1, status: 'confirmed', nombre: 'P2' } as unknown as PlanItem;
const base = [{ id: 'lv', nombre: 'Lavamanos', ud: 2 }];

describe('UD por flujo — tributarios anidados con flecha invertida', () => {
  beforeEach(() => {
    resetStorage();
    setLSTrazos();
  });

  const setLSTrazos = () =>
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS7',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [200, 0],
            ],
            label: 'RS7',
          },
          // T2RS7 drena a [50,0] (sobre el tronco) — flecha correcta.
          {
            id: 'T2RS7',
            net: 'san',
            tipo: 'tributario',
            pts: [
              [65, 25],
              [50, 0],
            ],
            label: 'T2RS7',
          },
          // T10RS7 con flecha INVERTIDA: su extremo de descarga ([75,30]) flota; el que toca
          // a T2RS7 es el otro extremo ([65,25]).
          {
            id: 'T10RS7',
            net: 'san',
            tipo: 'tributario',
            pts: [
              [65, 25],
              [75, 30],
            ],
            label: 'T10RS7',
          },
          // T4RS7 bien orientada, llega a la cabeza de T2RS7 (mismo punto que T10RS7).
          {
            id: 'T4RS7',
            net: 'san',
            tipo: 'tributario',
            pts: [
              [55, 30],
              [65, 25],
            ],
            label: 'T4RS7',
          },
        ],
        bajantes: [],
      }),
    );

  const tramosSan = (): Tramo[] => [
    tramo({ id: 'RS7', _key: 'RS7-1', tipo: 'ramal', label: 'RS7', fixtures: {} }),
    tramo({ id: 'T2RS7', _key: 'T2RS7-1', label: 'T2RS7', fixtures: { lv: 1 } }),
    tramo({ id: 'T10RS7', _key: 'T10RS7-1', label: 'T10RS7', fixtures: { lv: 2 } }),
    tramo({ id: 'T4RS7', _key: 'T4RS7-1', label: 'T4RS7', fixtures: { lv: 3 } }),
  ];

  it('T2RS7 recibe a T10RS7 y T4RS7 en el grafo aunque la flecha de T10RS7 esté invertida', () => {
    const { fullChildrenMap } = buildSanConnectivity(tramosSan(), [plan], base);
    expect(fullChildrenMap['T2RS7-1']).toContain('T10RS7-1');
    expect(fullChildrenMap['T2RS7-1']).toContain('T4RS7-1');
  });

  it('las UD propagan: T2RS7 propia 12 y RS7 acumula 12 (lv.ud=2)', () => {
    const all = tramosSan();
    const { fullChildrenMap, componentTotalMap } = buildSanConnectivity(all, [plan], base);
    const rs7 = all[0];
    const t2 = all[1];
    const rows2 = computeSanRows([t2], {}, base, all, fullChildrenMap);
    // T2RS7: propia 1×2 + T10RS7 2×2 + T4RS7 3×2 = 12 UD.
    expect(rows2[0].udPropias).toBe(12);
    // RS7 acumula el subtree completo vía componentTotalMap.
    expect(computeSanRows([rs7], componentTotalMap, base, all, fullChildrenMap)[0].udAcum).toBe(12);
  });
});
