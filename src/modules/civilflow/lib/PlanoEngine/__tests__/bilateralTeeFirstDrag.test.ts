import { describe, it, expect } from 'vitest';
import { handleSelectDown } from '../handleMouseDown';
import { handleDragMove } from '../handleDragMove';
import { deleteSelected } from '../deleteSelected';
import { recalcBilateralCrossings } from '../PlanoEngineNetwork';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

function makeRamal(id: string, net: string, pts: number[][]): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
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
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    _guideStart: null,
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    _lockedNets: new Set(),
    activeNet: 'af',
    tool: 'sel',
    snapMode: false,
    multiSel: [],
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    ramalDrag: null,
    ptDrag: null,
    bajDrag: null,
    ghostDrag: null,
    lblDrag: null,
    txtDrag: null,
    dimLblDrag: null,
    txtResize: null,
    areaDrag: null,
    dimDrag: null,
    multiDrag: null,
    marqueeRect: null,
    toCvs: (px: number, py: number) => ({ x: px, y: py }),
    toPlane: (cx: number, cy: number) => ({ x: cx, y: cy }),
    mm2cvs: (mm: number) => mm,
    pxToM: (px: number) => px,
    realMmToCanvasPx: (mm: number) => mm,
    snapAngle: (_x0, _y0, x1, y1) => ({ x: x1, y: y1 }),
    snapToExisting: () => null,
    getBajantesFantasma: () => [],
    render: () => {},
    scheduleRender: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _renumberAreas: () => {},
    setActiveNet: (id: string) => {
      (engine as IPlanoEngineCore).activeNet = id;
    },
  };
  return engine as IPlanoEngineCore;
}

describe('bilateral tee — first drag by endpoint/vertex (point 24)', () => {
  it('moves both ramales of a freshly-created (never-dragged) bilateral pair on the VERY FIRST vertex drag', () => {
    // Two perpendicular af ramales crossing strictly in their interiors — a "tee salida
    // bilateral". Neither has ever been dragged, so bilateralPairIds starts empty; it's only
    // populated by recalcBilateralCrossings, which handleSelectDown now runs on every mousedown.
    const a = makeRamal('RAF1', 'af', [
      [0, 10],
      [20, 10],
    ]);
    const b = makeRamal('RAF2', 'af', [
      [10, 0],
      [10, 20],
    ]);
    const engine = makeEngine([a, b]);
    engine.selId = 'RAF1';

    // Grab RAF1 by its right endpoint (20,10) — far from the crossing point (10,10) itself, so
    // there is no shared/coincident vertex between the two ramales at the dragged point.
    handleSelectDown(engine, 20, 10);
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?._bilateralDrag).toBe(true);

    handleDragMove(engine, 20, 40);

    // RAF1's dragged endpoint moved...
    expect(a.pts[1]).toEqual([20, 40]);
    // ...and RAF2 (the bilateral partner) rigidly followed by the same delta (+30 in y), on this
    // very first drag — not only starting from the second one.
    expect(b.pts[0]).toEqual([10, 30]);
    expect(b.pts[1]).toEqual([10, 50]);
  });

  it('moves both ramales on first vertex drag when one ramal ENDS at crossing (tee, not cross)', () => {
    // Actual TEE: ramal B's endpoint (10,10) is AT the crossing with A — segmentStrictIntersectionPoint
    // would reject this (t=1 for B's segment (10,10)-(10,20)). segmentLooseIntersectionPoint catches it.
    const a = makeRamal('RAF1', 'af', [
      [0, 10],
      [20, 10],
    ]);
    const b = makeRamal('RAF2', 'af', [
      [10, 10],
      [10, 20],
    ]);
    const engine = makeEngine([a, b]);
    engine.selId = 'RAF1';

    handleSelectDown(engine, 20, 10);
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?._bilateralDrag).toBe(true);

    handleDragMove(engine, 20, 40);

    expect(a.pts[1]).toEqual([20, 40]);
    // B starts at (10,10), delta +30y → (10,40)
    expect(b.pts[0]).toEqual([10, 40]);
    expect(b.pts[1]).toEqual([10, 50]);
  });

  it('deleting one ramal of a bilateral pair does NOT delete the partner — only the selected ramal is removed', () => {
    const a = makeRamal('RAF1', 'af', [
      [0, 10],
      [20, 10],
    ]);
    const b = makeRamal('RAF2', 'af', [
      [10, 10],
      [10, 20],
    ]);
    const engine = makeEngine([a, b]);

    recalcBilateralCrossings(engine);
    expect(a.bilateralPairIds).toContain('RAF2');
    expect(b.bilateralPairIds).toContain('RAF1');

    // Delete RAF1 — RAF2 is a separate physical pipe and must survive.
    deleteSelected(engine, ['RAF1']);
    expect(engine.ramales.find((r) => r.id === 'RAF1')).toBeUndefined();
    expect(engine.ramales.find((r) => r.id === 'RAF2')).toBeDefined();
  });

  it('deleting a bilateral ramal cleans up bilateralPairIds references on the surviving partner', () => {
    const a = makeRamal('RAF1', 'af', [
      [0, 10],
      [20, 10],
    ]);
    const b = makeRamal('RAF2', 'af', [
      [10, 10],
      [10, 20],
    ]);
    const c = makeRamal('RAF3', 'af', [
      [50, 50],
      [50, 60],
    ]); // far from crossing
    const engine = makeEngine([a, b, c]);

    recalcBilateralCrossings(engine);
    expect(c.bilateralPairIds).toBeUndefined();

    deleteSelected(engine, ['RAF1']);
    // RAF2 and RAF3 both survive — RAF1 was the only one selected for deletion.
    expect(engine.ramales.map((r) => r.id).sort()).toEqual(['RAF2', 'RAF3']);
    // RAF2 no longer references the now-deleted RAF1.
    const survivingB = engine.ramales.find((r) => r.id === 'RAF2');
    expect(survivingB?.bilateralPairIds).not.toContain('RAF1');
  });
});
