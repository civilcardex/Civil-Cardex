import { describe, it, expect } from 'vitest';
import { handleDragMove } from '../handleDragMove';
import { hitTestBajanteLabelForDrag } from '../PlanoEngineHitTesting';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';

// Regression coverage for the "ghost label moves instead of selecting the parent" bug: clicking
// the PARENT bajante's label while a same-floor GHOST-displaced bajante was previously selected
// used to drag the ghost's displaced label to wherever the parent's label was clicked. Root cause
// was twofold: (1) hitTestBajanteLabelForDrag always won for the currently-selected bajante's own
// label even when a neighboring bajante's label was genuinely closer to the click, and (2)
// handleDragMove's target (real labelX/Y vs. ghostData[floor].labelX/Y) was driven by a
// `_lblDragIsParent` flag that a bypass path left stale from the PREVIOUS interaction.

function makeBajante(
  id: string,
  x: number,
  y: number,
  labelX: number,
  labelY: number,
): PlanoBajante {
  return {
    id,
    net: 'san',
    tipo: 'bajante',
    code: id,
    x,
    y,
    labelX,
    labelY,
    labelAngle: 0,
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    dNominal: '',
    direccion: 'baja',
    _circ: { x, y, r: 8 },
  } as unknown as PlanoBajante;
}

function makeEngine(bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    activeNet: 'san',
    tool: 'sel',
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    lblDrag: null,
    ramalDrag: null,
    ptDrag: null,
    bajDrag: null,
    ghostDrag: null,
    txtDrag: null,
    dimLblDrag: null,
    txtResize: null,
    areaDrag: null,
    dimDrag: null,
    multiDrag: null,
    marqueeRect: null,
    toCvs: (px: number, py: number) => ({ x: px, y: py }),
    toPlane: (cx: number, cy: number) => ({ x: cx, y: cy }),
    scheduleRender: () => {},
    render: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('hitTestBajanteLabelForDrag — only wins when genuinely closest', () => {
  it('returns the selected bajante label when no neighbor is closer', () => {
    const a = makeBajante('BAN1', 0, 0, 0, 20);
    const b = makeBajante('BAN2', 200, 200, 200, 220);
    const engine = makeEngine([a, b]);
    engine.selId = 'BAN1';

    const hit = hitTestBajanteLabelForDrag(engine, 0, 20);

    expect(hit?.id).toBe('BAN1');
  });

  it('bails out (returns null) when a neighboring bajante label is genuinely closer to the click', () => {
    const parent = makeBajante('BAN1', 0, 0, 0, 20); // selected bajante's own label at (0,20)
    const neighbor = makeBajante('BAN2', 5, 0, 5, 21); // neighbor's label sits almost on top of the click
    const engine = makeEngine([parent, neighbor]);
    engine.selId = 'BAN1';

    // Click much closer to BAN2's label (5,21) than to BAN1's own label (0,20).
    const hit = hitTestBajanteLabelForDrag(engine, 5, 21);

    expect(hit).toBeNull();
  });
});

describe('handleDragMove label target — _lblDragIsParent selects real vs. ghost position', () => {
  it('writes to the real labelX/labelY when _lblDragIsParent is true', () => {
    const baj = makeBajante('BAN1', 0, 0, 0, 0);
    const engine = makeEngine([baj]);
    engine.lblDrag = { id: 'BAN1', offX: 0, offY: 0 };
    engine._lblDragIsParent = true;

    handleDragMove(engine, 50, 50);

    expect(baj.labelX).toBeCloseTo(50, 5);
    expect(baj.labelY).toBeCloseTo(50, 5);
    expect(baj.ghostData?.P1).toBeUndefined();
  });

  it('writes to ghostData[floor] instead of labelX/labelY when _lblDragIsParent is false', () => {
    const baj = makeBajante('BAN1', 0, 0, 0, 0);
    const engine = makeEngine([baj]);
    engine.lblDrag = { id: 'BAN1', offX: 0, offY: 0 };
    engine._lblDragIsParent = false;

    handleDragMove(engine, 50, 50);

    expect(baj.ghostData?.P1?.labelX).toBeCloseTo(50, 5);
    expect(baj.ghostData?.P1?.labelY).toBeCloseTo(50, 5);
    // The real (parent) label position must stay untouched — this is exactly the bug: a stale
    // `_lblDragIsParent` used to make this branch write into the wrong target's fields.
    expect(baj.labelX).toBe(0);
    expect(baj.labelY).toBe(0);
  });
});
