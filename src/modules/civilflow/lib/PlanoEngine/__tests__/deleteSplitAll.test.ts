import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
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
    tipoTramo: 'tributario',
    padreTributario: 'T1',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 1 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
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
    _loadedPlanId: null,
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
    label: o.id || 'R',
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
const T = (id: string, pts: number[][], o: Partial<PlanoRamal> = {}): PlanoRamal =>
  ({
    id,
    net: 'san',
    tipo: 'tributario',
    padre: o.padre ?? 'P1',
    pts,
    totalL: 0,
    label: id,
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

describe('#3 borrar división completa con tecla Delete (selId)', () => {
  it('seleccionar una mitad de división y borrar elimina TODA la división', () => {
    const padre = R({
      id: 'P1',
      pts: [
        [-40, 0],
        [40, 0],
      ],
    });
    const t1 = T(
      'T1',
      [
        [0, 0],
        [0, 30],
      ],
      { label: 'T1RS1' },
    );
    const engine = makeEngine([padre, t1]);
    engine.tipoTramo = 'tributario';
    engine.padreTributario = 'T1';
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'T1',
      pts: [
        [20, 50],
        [20, 15],
      ],
    } as never;
    finishRamal(engine);
    const before = engine.ramales.length;
    expect(before).toBeGreaterThanOrEqual(3);
    // Seleccionar la mitad del tributario T1 (el upstream original) y borrar
    engine.selId = 'T1';
    deleteSelected(engine);
    // Debe quedar solo el ramal padre (P1) — la división completa se borró
    expect(engine.ramales.filter((r) => r.tipo === 'tributario')).toHaveLength(0);
  });
});
