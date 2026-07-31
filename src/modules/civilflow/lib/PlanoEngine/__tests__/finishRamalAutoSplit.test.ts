import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Characterization coverage for the two most common ramal-creation paths that had zero test
// coverage: a plain simple ramal (no junction), and a ramal whose endpoint lands mid-body on an
// existing ramal — the auto-split/merge path (autoSplitJunctionAndSumFlow) that caused the UD/UC
// bug investigated earlier this session. Both go through finishRamal, the real entry point used
// by handleMouseDown/handleDragUp when the user finishes drawing.

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
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
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('finishRamal — simple ramal, no junction', () => {
  it('creates a single new ramal with an incrementing label and no split occurs', () => {
    const engine = makeEngine([]);
    engine.activeRamal = {
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
    } as never;

    finishRamal(engine);

    expect(engine.ramales).toHaveLength(1);
    const r = engine.ramales[0];
    expect(r.pts).toEqual([
      [0, 0],
      [40, 0],
    ]);
    expect(r.bloqueado).toBe(true);
    expect(engine.selId).toBe(r.id);
    expect(engine.activeRamal).toBeNull();
  });
});

describe('finishRamal — mid-body junction triggers autoSplitJunctionAndSumFlow', () => {
  it('splits the existing ramal at the junction and creates a downstream ramal with combined uc and larger diametro', () => {
    const existing: PlanoRamal = {
      id: 'RAF_EXIST',
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
      totalL: 0,
      label: 'RAF1',
      ini: '',
      fin: '',
      piso: '',
      dz: '',
      uc: 5,
      labelX: 0,
      labelY: 0,
      labelAngle: 0,
      material: '',
      diametro: '1/2" — 12.7 mm',
      pendiente: 0,
      bloqueado: true,
    } as PlanoRamal;
    const engine = makeEngine([existing]);
    // Incoming ramal ends exactly mid-body on `existing` at (20,0) — a true T junction.
    engine.activeRamal = {
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    engine._ramalDefaults = { material: '', diametro: '3/4" — 19.1 mm', pendiente: 0 };

    finishRamal(engine);

    // existing (upstream portion) shrinks to [0,0]-[20,0]
    const upstream = engine.ramales.find((r) => r.id === 'RAF_EXIST')!;
    expect(upstream.pts).toEqual([
      [0, 0],
      [20, 0],
    ]);

    // a new downstream ramal was created carrying the rest of the original run
    expect(engine.ramales).toHaveLength(3); // upstream + incoming + downstream
    const created = engine.ramales.filter((r) => r.mergesFrom);
    expect(created).toHaveLength(1);
    const merged = created[0];
    const incoming = engine.ramales.find((r) => r.id === merged.mergesFrom![1])!;
    expect(merged.mergesFrom).toEqual(['RAF_EXIST', incoming.id]);
    expect(merged.pts[0]).toEqual([20, 0]);
    expect(merged.pts[merged.pts.length - 1]).toEqual([40, 0]);
    // uc summed from both converging ramales (upstream's original uc=5 + incoming's uc=0)
    expect(merged.uc).toBe(5 + (incoming.uc || 0));
    // diametro picks the larger of the two converging ramales
    expect(merged.diametro).toBe('3/4" — 19.1 mm');
  });
});
