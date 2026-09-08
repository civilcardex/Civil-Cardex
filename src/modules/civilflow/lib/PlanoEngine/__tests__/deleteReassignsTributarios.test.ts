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

describe('orig. usuario #2 — borrar trazo reasigna tributarios al ramal del otro lado', () => {
  it('borrar RS1 (una rama de la yee doble) reasigna su tributario al ramal hermano RS2', () => {
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
    // RS1 borrado, RS2 queda, T1 reasignado a RS2
    expect(engine.ramales.find((r) => r.id === 'RS1')).toBeUndefined();
    expect(engine.ramales.find((r) => r.id === 'RS2')).toBeTruthy();
    expect(engine.ramales.find((r) => r.id === 'T1')?.padre).toBe('RS2');
  });

  it('sin ramal hermano, el tributario SOBREVIVE (borrado multi = solo los seleccionados)', () => {
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
    // Pedido usuario: el borrado en conjunto elimina SOLO lo seleccionado — el tributario no
    // seleccionado no cae en cascada (queda suelto, sin host al que reasignar).
    expect(engine.ramales.find((r) => r.id === 'T1')).toBeDefined();
    expect(engine.ramales.find((r) => r.id === 'RS1')).toBeUndefined();
  });
});
