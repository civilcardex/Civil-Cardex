import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { handleSelectDown } from '../handleMouseDown';
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
    tool: 'sel',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 1 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    cmToCanvasPx: (c) => c,
    toCvs: (x, y) => ({ x, y }),
    toPlane: (x, y) => ({ x, y }),
    realMmToCanvasPx: (mm) => mm,
    mm2cvs: (mm) => mm,
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
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
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
function simLabels(engine: IPlanoEngineCore): void {
  for (const r of engine.ramales) {
    const n = r.pts.length;
    if (!n) continue;
    const mid = [
      (r.pts[Math.floor((n - 1) / 2)][0] + r.pts[Math.floor(n / 2)][0]) / 2,
      (r.pts[Math.floor((n - 1) / 2)][1] + r.pts[Math.floor(n / 2)][1]) / 2,
    ];
    r.labelX = mid[0];
    r.labelY = mid[1];
    (r as unknown as { _labelBox?: unknown })._labelBox = {
      cx: mid[0],
      cy: mid[1],
      w: 20,
      h: 10,
      angle: 0,
      minX: mid[0] - 10,
      minY: mid[1] - 5,
      maxX: mid[0] + 10,
      maxY: mid[1] + 5,
      corners: [],
    };
  }
}

describe('BUG 2 — flujo REAL: splitter recién dibujado queda SELECCIONADO', () => {
  it('clic en el downstream selecciona el downstream (no arrastra el splitter seleccionado)', () => {
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
        [0, 40],
        [0, 20],
      ],
    } as never;
    finishRamal(engine);
    simLabels(engine);
    // finishRamal deja selId = r.id (el splitter) — estado real tras dibujar
    const downstream = engine.ramales.find((rr) => rr.mergesFrom);
    handleSelectDown(engine, 0, 28, false);
    expect(engine.selId).toBe(downstream!.id);
  });
});
