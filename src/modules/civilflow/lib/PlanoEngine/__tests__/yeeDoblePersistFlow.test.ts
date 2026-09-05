import { describe, it, expect, beforeEach } from 'vitest';
import { calcSanitaryAccessories } from '../networkSanitary';
import { eraseRamalAt } from '../drawingErase';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Flujo orig. usuario: yee doble (dos uniones a ≤10mm en el tronco) detectada por
// calcSanitaryAccessories → banderas escritas en TODOS los participantes → borrar el lateral
// T1RS1 con Supr/borrador → el tronco conserva yeeDobleAt (el glifo persistido se dibuja) y
// SIN tapón: borrar un lateral no tapa nada (regla vigente — la yee sigue viva con el otro
// lateral; orig. usuario revocó el tapón del lateral).

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

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 0,
    label: 'R',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _hiddenNets: new Set<string>(),
    _netCounts: {
      san: { ramal: 5, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    deleteSelected: function (ids?: string[], opts?: { noMerge?: boolean }) {
      _deleteSelected(this as unknown as IPlanoEngineCore, ids, opts);
    },
  };
  return engine as IPlanoEngineCore;
}

// Tronco vertical pasante; T1RS1 entra a [0,60] (45° desde la izquierda), T2RS1 a [0,68]
// (45° desde la derecha) — par de yee doble a 8mm. T4RS1 cae en el extremo superior del
// tronco (fuera del par, como el caso del usuario).
describe('yee doble: persistencia tras borrar un lateral (flujo completo con recálculo)', () => {
  beforeEach(() => resetStorage());

  it('borrar T1RS1 conserva la bandera en el tronco y NO coloca tapón', () => {
    setLocalStorage('tramo_hidro_data_v3', {});
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 20],
        [0, 100],
      ],
      diametro: '4"',
    });
    const t1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [-21.2, 81.2],
        [0, 60],
      ],
    });
    const t2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      label: 'T2RS1',
      pts: [
        [21.2, 89.2],
        [0, 68],
      ],
    });
    const t4 = R({
      id: 'T4RS1',
      tipo: 'tributario',
      label: 'T4RS1',
      pts: [
        [-10, 20],
        [0, 20],
      ],
    });
    const eng = makeEngine([tronco, t1, t2, t4]);
    calcSanitaryAccessories(eng);
    // La detección escribió la identidad del par en tronco y laterales.
    expect(tronco.yeeDobleAt).toBeDefined();
    expect(t1.yeeDobleAt).toBeDefined();
    expect(t2.yeeDobleAt).toBeDefined();

    // Borrar T1RS1 (borrador/Supr: selección + eraseRamalAt sobre ramal de 2 puntos).
    eng.selId = 'T1RS1';
    eraseRamalAt(eng, t1, -21.2, 81.2);
    expect(eng.ramales.some((r) => r.id === 'T1RS1')).toBe(false);
    // El tronco conserva el símbolo persistido y el punto queda SIN tapón (borrar un lateral
    // no tapa — la yee sigue viva con el otro lateral).
    expect(tronco.yeeDobleAt).toBeDefined();
    expect(
      Object.values(tronco.accMed || {}).includes('tapon') ||
        tronco.accesorioInicio === 'tapon' ||
        tronco.accesorioFin === 'tapon',
    ).toBe(false);
    const hidro = JSON.parse(
      (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
        'civilflow_tramo_hidro_data_v3',
      ) || '{}',
    ) as Record<string, { accesorios?: Record<string, number> }>;
    expect(hidro['san_RS1_1']?.accesorios?.['tapon']).toBeUndefined();
  });
});
