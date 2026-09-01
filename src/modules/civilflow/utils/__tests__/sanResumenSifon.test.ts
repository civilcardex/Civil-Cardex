import { describe, it, expect, beforeEach } from 'vitest';
import { computeAccesoriosTable } from '../sanAccesoriosRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

function setLocalStorage(key: string, val: unknown) {
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + key,
    JSON.stringify(val),
  );
}

describe('Resumen accesorios sanitarios — sifones y codo 90', () => {
  beforeEach(() => {
    // localStorage stub
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
    // trazos storage — ramal RS1 + tributario T1RS1 with sifon + codo90
    setLocalStorage('trazos_1', {
      v: 3,
      ts: 1,
      scaleM: 0.5,
      definedScaleM: 0,
      activeNet: 'san',
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
          accesorioFin: 'sifon',
          diametroFin: '2"',
          planId: 1,
        },
        {
          id: 'T1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS1',
          pts: [
            [20, 0],
            [20, 30],
          ],
          diametro: '2"',
          accesorioInicio: 'codo90rmSube',
          diametroInicio: '2"',
          planId: 1,
        },
      ],
      bajantes: [],
    });
    // hidroData — sifon RS1 =1, codo90rmSube T1 =1
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { sifon: 1 }, Lh: 0, nSalidas: 1 },
      san_T1_1: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 1 },
    });
  });

  it('sifón NO aparece en el resumen; codo 90 sí se cuenta', () => {
    const plans = [{ id: 1, name: 'P1', nivel: 1, status: 'confirmed' as const }];
    const tramo = {
      id: 'RS1',
      _key: 'RS1-1',
      planId: 1,
      piso: 1,
      tipo: 'ramal',
      diametro: '4"',
      diamDisPulg: 4,
      accesorioFin: 'sifon',
      diametroFin: '2"',
      fixtures: {},
    } as unknown as Tramo;
    const tramoT1 = {
      id: 'T1',
      _key: 'T1-1',
      planId: 1,
      piso: 1,
      tipo: 'tributario',
      diametro: '2"',
      diamDisPulg: 2,
      accesorioInicio: 'codo90rmSube',
      diametroInicio: '2"',
      fixtures: {},
    } as unknown as Tramo;
    const table = computeAccesoriosTable('san', [tramo, tramoT1], plans as unknown as PlanItem[]);
    expect(table).not.toBeNull();
    // No debe existir columna Sifón
    const sifonIdx = table!.headers.indexOf('Sifón');
    expect(sifonIdx).toBe(-1);
    // codo 90 sube → codoTarget 'codo90rm' — debe contarse (ahora "Codo medio 90°")
    const codo90Idx =
      table!.headers.indexOf('Codo medio 90°') !== -1
        ? table!.headers.indexOf('Codo medio 90°')
        : table!.headers.indexOf('Codo 90°');
    expect(codo90Idx).toBeGreaterThan(0);
    const codoTotal = table!.rows.reduce((s, r) => s + Number(r[codo90Idx] || 0), 0);
    expect(codoTotal).toBeGreaterThanOrEqual(1);
  });
});
