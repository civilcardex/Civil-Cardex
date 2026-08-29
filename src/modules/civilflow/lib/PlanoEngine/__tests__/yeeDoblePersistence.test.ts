import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcSanitaryAccessories } from '../networkSanitary';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ítem 2: la identidad de una yee doble (yeeDobleAt) persiste en el ramal y sobrevive a que un
// brazo lateral se borre. calcSanitaryAccessories no debe eliminarla cuando la geometría ya no
// detecta el par (tras borrar un lado); solo se limpia al eliminar el tronco/ramal completo.

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
      san: { ramal: 1, tributario: 0 },
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
    _renumberRamales: () => {},
    _loadedPlanId: 'p1',
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
      [40, 0],
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
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

describe('yeeDobleAt — identidad persistida (ítem 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calcSanitaryAccessories conserva yeeDobleAt aunque la geometría ya no detecte el par', () => {
    const yeeDobleAt = [
      [10, 0],
      [20, 0],
    ];
    const ramal = R({ yeeDobleAt });
    const engine = makeEngine([ramal]);
    calcSanitaryAccessories(engine);
    expect(engine.ramales[0].yeeDobleAt).toEqual(yeeDobleAt);
  });

  it('calcSanitaryAccessories no escribe yeeDobleAt cuando no hay par y no había identidad previa', () => {
    const engine = makeEngine([R({})]);
    calcSanitaryAccessories(engine);
    expect(engine.ramales[0].yeeDobleAt).toBeUndefined();
  });
});
