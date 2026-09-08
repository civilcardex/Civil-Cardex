import { describe, it, expect } from 'vitest';
import { eraseRamalAt } from '../drawingErase';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Orig. usuario: T2RS1 (diagonal al tronco) y T3RS1 (vertical) se tocan en la esquina;
// T1RS2 también llega ahí. Borrar T1RS2 debe dejar UN solo tributario (T2RS1+T3RS1
// fusionados), no la esquina de dos.
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
      san: { ramal: 0, tributario: 3 },
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
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

describe('borrar el tributario que llega a la esquina fusiona los dos restantes', () => {
  it('T1RS2 fuera → T2RS1 y T3RS1 se fusionan en UN tributario', () => {
    const t2 = R({
      id: 'T2RS1',
      label: 'T2RS1',
      tipo: 'tributario',
      padre: 'RS0',
      pts: [
        [0, 60],
        [40, 20],
      ], // diagonal, termina en la esquina [40,20]
    });
    const t3 = R({
      id: 'T3RS1',
      label: 'T3RS1',
      tipo: 'tributario',
      padre: 'RS0',
      pts: [
        [40, 20],
        [40, 90],
      ], // vertical, arranca en la esquina
    });
    const t1 = R({
      id: 'T1RS2',
      label: 'T1RS2',
      tipo: 'tributario',
      padre: 'RS0',
      pts: [
        [90, 30],
        [40, 20],
      ], // también llega a la esquina
    });
    const eng = makeEngine([t2, t3, t1]);
    eng.selId = 'T1RS2';
    eraseRamalAt(eng, t1, 80, 28);
    // Fusion: un solo tributario queda (T2RS1 absorbe a T3RS1), con la geometría completa.
    const trib = eng.ramales.filter((r) => r.tipo === 'tributario');
    expect(trib).toHaveLength(1);
    expect(trib[0].id).toBe('T2RS1');
    expect(trib[0].pts.length).toBe(3); // diagonal + esquina + vertical
  });

  it('si hay un ramal (tronco) en el punto, NO fusiona (unión real con el tronco)', () => {
    const trunk = R({
      id: 'RS9',
      label: 'RS9',
      pts: [
        [-40, 20],
        [40, 20],
      ],
    });
    const t2 = R({
      id: 'T2RS1',
      label: 'T2RS1',
      tipo: 'tributario',
      padre: 'RS9',
      pts: [
        [0, 60],
        [40, 20],
      ],
    });
    const t3 = R({
      id: 'T3RS1',
      label: 'T3RS1',
      tipo: 'tributario',
      padre: 'RS9',
      pts: [
        [40, 20],
        [40, 90],
      ],
    });
    const t1 = R({
      id: 'T1RS2',
      label: 'T1RS2',
      tipo: 'tributario',
      padre: 'RS9',
      pts: [
        [90, 30],
        [40, 20],
      ],
    });
    const eng = makeEngine([trunk, t2, t3, t1]);
    eng.selId = 'T1RS2';
    eraseRamalAt(eng, t1, 80, 28);
    // La esquina es la tee con el tronco: los dos tributarios quedan.
    expect(eng.ramales.filter((r) => r.tipo === 'tributario')).toHaveLength(2);
  });

  it('multi-delete de los tributarios que partieron el tronco: el tronco remergea (orig. usuario)', () => {
    localStorage.clear();
    // Tronco RS2 partido por dos tributarios que aterrizaron a mitad de cuerpo (downstream
    // con mergesFrom). Borrar TODOS los tributarios juntos (multi-select → deleteSelected(ids)
    // SIN noMerge ahora) re-une el tronco en un solo ramal.
    const rs2a = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const rs2b = R({
      id: 'RS2b',
      label: 'RS2b',
      pts: [
        [40, 0],
        [70, 0],
      ],
      mergesFrom: ['RS2', 'T1RS2'],
    });
    const rs2c = R({
      id: 'RS2c',
      label: 'RS2c',
      pts: [
        [70, 0],
        [100, 0],
      ],
      mergesFrom: ['RS2b', 'T2RS2'],
    });
    const t1 = R({
      id: 'T1RS2',
      label: 'T1RS2',
      tipo: 'tributario',
      padre: 'RS2',
      pts: [
        [40, 40],
        [40, 0],
      ],
    });
    const t2 = R({
      id: 'T2RS2',
      label: 'T2RS2',
      tipo: 'tributario',
      padre: 'RS2b',
      pts: [
        [70, 40],
        [70, 0],
      ],
    });
    const eng = makeEngine([rs2a, rs2b, rs2c, t1, t2]);
    // Multi-delete como el teclado: deleteSelected(ids) sin noMerge.
    _deleteSelected(eng, ['T1RS2', 'T2RS2']);
    // El tronco queda en UNA pieza (el heal elimina los vértices colineales del joint).
    const tronco = eng.ramales.filter((r) => r.tipo === 'ramal' && r.net === 'san');
    expect(tronco).toHaveLength(1);
    expect(tronco[0].pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });
});
