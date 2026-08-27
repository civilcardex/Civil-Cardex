import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import { selectAt } from '../PlanoEngineSelection';
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

describe('#1 borrar ramal usado para splitear', () => {
  it('tras borrar X, queda UN ramal y borrarlo una vez lo elimina todo', () => {
    const r = R({
      id: 'P1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([r]);
    engine.tipoTramo = 'ramal';
    engine.padreTributario = null;
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // split: P1 upstream + D downstream + X
    const x = engine.ramales.find((rr) => rr.id !== 'P1' && !rr.mergesFrom)!;
    expect(engine.ramales.length).toBe(3);
    deleteSelected(engine, [x.id]);
    // rejoin → UN solo ramal continuo
    expect(engine.ramales.length).toBe(1);
    const merged = engine.ramales[0];
    expect(merged.pts[0]).toEqual([0, 0]);
    expect(merged.pts[merged.pts.length - 1]).toEqual([40, 0]);
    // borrar ese único ramal → todo eliminado
    deleteSelected(engine, [merged.id]);
    expect(engine.ramales.length).toBe(0);
  });
});

describe('#2 tributario parte tributario: el downstream debe ser seleccionable', () => {
  it('clic en el cuerpo del tramo inferior selecciona ESE tramo, no el que partió', () => {
    const padre = R({
      id: 'P1',
      pts: [
        [-40, 0],
        [40, 0],
      ],
    });
    // T1 vertical [0,0]-[0,30]
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
    // T2 horizontal desde (20,15) hasta (0,15) — cae en el cuerpo de T1
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'T1',
      pts: [
        [20, 15],
        [0, 15],
      ],
    } as never;
    finishRamal(engine);
    console.log(
      'R2:',
      engine.ramales.map(
        (r) =>
          `id=${r.id} tipo=${r.tipo} pts=${JSON.stringify(r.pts)} label=${r.label} mer=${r.mergesFrom ? JSON.stringify(r.mergesFrom) : '-'}`,
      ),
    );
    // El tramo inferior de T1 (después de la unión) debe existir
    const downstream = engine.ramales.find(
      (rr) => rr.tipo === 'tributario' && rr.pts.some((p) => p[0] === 0 && p[1] > 15),
    );
    expect(downstream).toBeTruthy();
    // Clic en el cuerpo del downstream (0,20)
    selectAt(engine, 0, 20);
    expect(engine.selId).toBe(downstream!.id);
  });
});
