import { describe, it, expect } from 'vitest';
import { handleSelectDown } from '../handleMouseDown';
import { handleDragMove } from '../handleDragMove';
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

// A full-ish fake engine: identity coordinate mapping (canvas px === plane units) so click
// points can be reasoned about directly, everything else empty/no-op so only the real drag
// machinery under test can block the cascade.
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
    activeNet: 'san',
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
    _markDirty: () => {},
    triggerAlert: () => {},
    setActiveNet: (id: string) => {
      (engine as IPlanoEngineCore).activeNet = id;
    },
  };
  return engine as IPlanoEngineCore;
}

describe('san/vent whole-body drag cascade (end-to-end)', () => {
  it('moving the SAN ramal body drags the connected VENT ramal (tapped at an interior vertex) along with it', () => {
    // San ramal: a long horizontal run with an interior tap point at (10,0), far (>15px) from
    // either polyline endpoint so the click below is unambiguously a BODY click.
    // bloqueado:false on the ramal being DIRECTLY dragged — "Bloquear movimiento" now genuinely
    // blocks direct drag of the ramal it's checked on (cascade-follow is unaffected either way).
    const san = {
      ...makeRamal('RS1', 'san', [
        [0, 0],
        [10, 0],
        [50, 0],
      ]),
      bloqueado: false,
    };
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const engine = makeEngine([san, vent]);
    engine.selId = 'RS1'; // simulates the ramal already being selected from a prior click

    // mousedown on the san ramal's body, well clear of any endpoint
    handleSelectDown(engine, 30, 0);
    expect(engine.ramalDrag).not.toBeNull();
    expect(engine.ramalDrag?.connRamales?.some((r) => r.id === 'REV1')).toBe(true);

    // drag it sideways
    handleDragMove(engine, 30, 20);

    expect(vent.pts[0][1]).toBeCloseTo(20, 5); // vent's tapped endpoint followed san upward
    expect(vent.pts[1][1]).toBeCloseTo(30, 5); // and the rest of vent moved rigidly with it
  });

  it('moving the SAN ramal by its ENDPOINT (first-click path) also drags the connected VENT ramal', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [50, 0],
    ]);
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const engine = makeEngine([san, vent]);
    // Nothing pre-selected — this exercises _tryRamalEndpointHit, the one-click select+drag path.

    handleSelectDown(engine, 50, 0); // click right on san's far endpoint
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?.id).toBe('RS1');

    handleDragMove(engine, 50, 30);

    // Endpoint drag bends only that one vertex of san — it must NOT drag the whole vent ramal
    // (that's the whole-body case above); this just confirms the endpoint path actually starts
    // a real drag at all instead of silently no-op'ing (the _tryRamalEndpointHit bug).
    expect(san.pts[2]).toEqual([50, 30]);
  });
});

describe('dragging a TRIBUTARIO (T-prefixed) ramal by its body', () => {
  it('starts a whole-body drag for a tributario just like a normal ramal (regression: id prefix used to gate this)', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [50, 0],
    ]);
    // vent tap modeled as a tributario of san — this is the standard way this app represents a
    // branch off a parent ramal (see copyDrawingFromPlan.ts's tPfx='T' / PlanoRamal.padre).
    // bloqueado:false since this tributario is the one being DIRECTLY dragged.
    const vent = {
      ...makeRamal('T1', 'vent', [
        [10, 0],
        [10, 30],
      ]),
      padre: 'RS1',
      bloqueado: false,
    };
    const engine = makeEngine([san, vent]);
    engine.selId = 'T1';

    // click on the tributario's own body, far from its endpoints
    handleSelectDown(engine, 10, 15);

    expect(engine.ramalDrag).not.toBeNull();
  });
});
