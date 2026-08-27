import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const calls: string[] = [];
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
    triggerAlert: (t: string) => calls.push('alert:' + t),
    triggerAccesorioModal: () => calls.push('modal'),
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  (engine as unknown as { calls: string[] }).calls = calls;
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

describe('san trib-trib split (ya no se bloquea por flujo)', () => {
  it('un tributario san que cae sobre otro tributario san lo parte sin alerta de flujo', () => {
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
    const calls = (engine as unknown as { calls: string[] }).calls;
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
    // No debe haber alerta de dirección de flujo incorrecta
    expect(calls.some((c) => c.startsWith('alert:') && c.includes('Dirección'))).toBe(false);
    // T1 debe haberse dividido: 3+ ramales
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
  });
});
