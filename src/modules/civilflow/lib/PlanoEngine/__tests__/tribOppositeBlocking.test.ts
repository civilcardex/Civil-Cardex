import { describe, expect, it } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { ramalFlowDirectionCheck } from '../drawingFlow';
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
      san: { ramal: 3, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
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
    snapToExisting: () => null,
  };
  return engine as IPlanoEngineCore;
}
const mk = (o: Partial<PlanoRamal>): PlanoRamal =>
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
    bloqueado: true,
    ...o,
  }) as PlanoRamal;

// Orig. usuario: tributario en dirección contraria debe BLOQUEARSE con alerta — tanto si
// llega a un ramal como a otro tributario.
describe('tributario en contraria — bloqueo de creación', () => {
  it('check directo: tributario dibujado unión→aparato (al revés) sobre ramal → alerta', () => {
    const tronco = mk({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    // Dibujado DESDE la unión hacia el aparato: origen en la unión, destino fuera.
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [20, 0],
        [20, -30],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toContain('tributario');
  });

  it('check directo: tributario dibujado aparato→unión (bien) → sin alerta', () => {
    const tronco = mk({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [20, -30],
        [20, 0],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toBeNull();
  });

  it('finishRamal BLOQUEA tributario en contraria sobre ramal', () => {
    const tronco = mk({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    eng.tipoTramo = 'tributario';
    eng.padreTributario = null;
    eng.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [20, 0],
        [20, -30],
      ],
    } as never;
    finishRamal(eng);
    // Bloqueado: no se crea el tributario.
    expect(eng.ramales.some((r) => r.id.startsWith('T') || r.tipo === 'tributario')).toBe(false);
    expect(eng.ramales).toHaveLength(1);
  });

  it('finishRamal BLOQUEA tributario en contraria sobre OTRO tributario', () => {
    // Tronco: tributario T1 horizontal; nuevo tributario llega a su cuerpo al revés.
    const t1 = mk({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([t1]);
    eng.tipoTramo = 'tributario';
    eng.padreTributario = null;
    eng.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [40, 0],
        [40, -30],
      ],
    } as never;
    finishRamal(eng);
    expect(eng.ramales.some((r) => r.id !== 'T1' && r.tipo === 'tributario')).toBe(false);
    expect(eng.ramales).toHaveLength(1);
  });
});

// Orig. usuario (capturas): el tributario puede TERMINAR en la unión y aun así entrar en
// CONTRARIA del anfitrión — llegando desde su lado aguas abajo (flecha contra el flujo del
// trazo al que conecta). Eso también se bloquea; perpendicular (90°) o a favor (45° desde
// atrás) pasa.
describe('tributario en sentido contrario al anfitrión — bloqueo', () => {
  it('llega a la unión desde el lado aguas abajo (contra el flujo del ramal) → alerta', () => {
    // Anfitrión fluye hacia el este; el trib entra a (20,0) viniendo del este (aguas abajo).
    const tronco = mk({
      id: 'RS5',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [60, 30],
        [20, 0],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toContain('contraria');
  });

  it('llega a la unión en 45° desde atrás (a favor) → sin alerta', () => {
    const tronco = mk({
      id: 'RS5',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [10, -30],
        [20, 0],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toBeNull();
  });

  it('llega perpendicular (90°) → sin alerta', () => {
    const tronco = mk({
      id: 'RS5',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([tronco]);
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [20, -30],
        [20, 0],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toBeNull();
  });

  it('trib→trib en contraria del tributario anfitrión que pasa por la unión → alerta', () => {
    // Anfitrión: tributario T1 que fluye hacia el este atravesando (20,0); entrante desde el este.
    const t1 = mk({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([t1]);
    const trib = mk({
      id: 'TX',
      tipo: 'tributario',
      pts: [
        [60, 30],
        [20, 0],
      ],
    });
    const err = ramalFlowDirectionCheck(eng, trib, [trib], 0.5);
    expect(err).toContain('contraria');
  });
});
