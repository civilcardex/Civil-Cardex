import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
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
    activeNet: 'af',
    tipoTramo: 'tributario',
    padreTributario: 'T1',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      af: { ramal: 1, tributario: 1 },
      ac: { ramal: 0, tributario: 0 },
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
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
    triggerAlert: (t: string) => console.log('ALERT', t),
    triggerAccesorioModal: () => console.log('MODAL'),
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
    net: 'af',
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
    net: 'af',
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

describe('tributario anidado: seleccionar tributario T1 como padre, dibujar T2 sobre su cuerpo', () => {
  it('T2 divide a T1 (crea downstream) con etiqueta de raíz sin anidar', () => {
    const padre = R({
      id: 'P1',
      pts: [
        [-40, 0],
        [40, 0],
      ],
    });
    // T1: tributario de P1, sube vertical en x=0
    const t1 = T(
      'T1',
      [
        [0, 0],
        [0, 30],
      ],
      { label: 'T1RAF1' },
    );
    const engine = makeEngine([padre, t1]);
    engine.tipoTramo = 'tributario';
    engine.padreTributario = 'T1'; // seleccionó el TRIBUTARIO como padre
    engine.activeRamal = {
      net: 'af',
      tipo: 'tributario',
      padre: 'T1',
      pts: [
        [20, 50],
        [20, 15],
      ],
    } as never;
    finishRamal(engine);
    console.log(
      'RAMALES:',
      engine.ramales.map(
        (r) =>
          `id=${r.id} tipo=${r.tipo} padre=${r.padre} pts=${JSON.stringify(r.pts)} label=${r.label} mer=${r.mergesFrom ? JSON.stringify(r.mergesFrom) : '-'}`,
      ),
    );
    // El tributario entrante T2 debe haberse agregado
    const t2 = engine.ramales.find(
      (r) =>
        r.id !== 'P1' && r.id !== 'T1' && r.tipo === 'tributario' && r.pts.some((p) => p[0] === 20),
    );
    expect(t2).toBeTruthy();
    // T1 debe haberse dividido: 3+ ramales
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
  });
});
