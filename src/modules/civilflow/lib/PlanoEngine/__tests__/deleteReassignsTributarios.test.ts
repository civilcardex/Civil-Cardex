import { describe, it, expect } from 'vitest';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 3, tributario: 2 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: 'planA',
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
    snapToExisting: () => null,
    snapAngle: (_x, _y, _px, _py) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [],
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

describe('borrado en conjunto — tributarios colgantes caen, troncos sobreviven', () => {
  it('borrar RS1 (rama de la yee doble) cae con su tributario T1; el tronco RS2 sobrevive', () => {
    // Yee doble: RS1 y RS2 comparten el punto de unión (40,0); RS1 tiene tributario T1
    const rs1 = R({
      id: 'RS1',
      pts: [
        [40, 0],
        [20, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      pts: [
        [40, 0],
        [80, 0],
      ],
    });
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [40, 0],
        [35, 10],
      ],
    });
    const engine = makeEngine([rs1, rs2, t1]);
    deleteSelected(engine, ['RS1']);
    // Borrado en conjunto (regla vigente): el tributario T1 colgante cae con RS1; el tronco
    // RS2 (solo tocado, no colgante) SOBREVIVE.
    expect(engine.ramales.find((r) => r.id === 'RS1')).toBeUndefined();
    expect(engine.ramales.find((r) => r.id === 'T1')).toBeUndefined();
    expect(engine.ramales.find((r) => r.id === 'RS2')).toBeTruthy();
  });

  it('sin nada más conectado, cae el seleccionado + su tributario colgante', () => {
    const rs1 = R({
      id: 'RS1',
      pts: [
        [0, 0],
        [20, 0],
      ],
    });
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [0, 0],
        [0, 10],
      ],
    });
    const engine = makeEngine([rs1, t1]);
    deleteSelected(engine, ['RS1']);
    // Regla vigente: el tributario colgante cae con su padre (borrado en conjunto).
    expect(engine.ramales).toHaveLength(0);
  });
});
