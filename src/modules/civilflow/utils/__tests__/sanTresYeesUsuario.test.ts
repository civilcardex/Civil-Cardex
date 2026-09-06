import { describe, it, expect, beforeEach } from 'vitest';

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
import { calcSanitaryAccessories } from '../../lib/PlanoEngine/networkSanitary';
import { loadFromStorage } from '../../services/storageService';
import type { IPlanoEngineCore, PlanoRamal } from '../../lib/PlanoEngine/PlanoState';

// REPLAY del dibujo real del usuario (coordenadas exactas de su consola): tronco horizontal
// partido en RS1|RS3|RS2|RS4, con 6 tributarios. Tres yees simples visibles (B: [933.7],
// C: [914.2], A: [957.6] — esta última ENTRE TRES TRIBUTARIOS) + 1 doble (T1RS4+T2RS4 en
// [734.1], mismo punto). El motor contaba 2: la yee A se registraba bajo el id del
// tributario T1RS3 y el recuento de la rama tributario BORRABA las yees de su clave.
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
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 4, tributario: 6 },
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
  };
  return engine as IPlanoEngineCore;
}

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 0,
    label: 'RS1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const tronco = (id: string, x1: number, x2: number) =>
  R({
    id,
    label: id,
    pts: [
      [x1, 1385.5026481462894],
      [x2, 1385.5026481462894],
    ],
  });

const trib = (id: string, pts: number[][]) => R({ id, label: id, tipo: 'tributario', pts });

describe('replay usuario — 3 yees simples + 1 doble (coordenadas exactas)', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('cuenta yeeSimple = 3 (A entre tributarios incluida) y yeeDoble = 1', () => {
    const eng = makeEngine([
      tronco('RS1', 983.656896295323, 933.6568962953231),
      trib('T17886595669428z04f', [
        [978.7957851842119, 1450.0859814796231],
        [914.2124518508782, 1385.5026481462894],
      ]),
      tronco('RS2', 914.2124518508782, 734.148088707247),
      trib('T1788659570046n7rml', [
        [988.5180074064342, 1330.6415370351783],
        [957.6152296286563, 1361.5443148129564],
      ]),
      tronco('RS3', 933.6568962953231, 914.2124518508782),
      trib('T17886595731443nry8', [
        [957.6152296286564, 1328.558203701845],
        [957.6152296286563, 1361.5443148129564],
      ]),
      trib('T1788659573144kvygf', [
        [957.6152296286563, 1361.5443148129564],
        [933.6568962953231, 1385.5026481462894],
      ]),
      trib('T17886596225602y9y9', [
        [803.9651618779789, 1455.3197213170213],
        [734.148088707247, 1385.5026481462894],
      ]),
      tronco('RS4', 734.148088707247, 696.6361941018149),
      trib('T1788659627972xn90w', [
        [784.2181421581117, 1336.0423507929856],
        [734.148088707247, 1385.5026481462894],
      ]),
    ]);
    calcSanitaryAccessories(eng);
    // El render persiste la identidad [P,P] de la doble de un punto (T1RS4+T2RS4 en [734.1])
    // en los participantes; se simula y se recalcula — mismo flujo que la app real.
    for (const r of eng.ramales) {
      if (['RS2', 'RS4', 'T17886596225602y9y9', 'T1788659627972xn90w'].includes(r.id)) {
        r.yeeDobleAt = [
          [734.148088707247, 1385.5026481462894],
          [734.148088707247, 1385.5026481462894],
        ];
      }
    }
    calcSanitaryAccessories(eng);
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    let totalSimple = 0;
    let totalDoble = 0;
    const detalle: string[] = [];
    for (const [k, v] of Object.entries(hidro)) {
      const ys = v.accesorios?.['yeeSimple'] || 0;
      const yd = v.accesorios?.['yeeDoble'] || 0;
      if (ys || yd) detalle.push(`${k}: simple=${ys} doble=${yd}`);
      totalSimple += ys;
      totalDoble += yd;
    }
    // eslint-disable-next-line no-console
    console.log('YEES:', detalle.join(' | '));
    expect(totalSimple).toBe(3);
    expect(totalDoble).toBe(1);
  });
});
