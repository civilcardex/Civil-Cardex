import { describe, it, expect } from 'vitest';
import {
  autoSplitJunctionAndSumFlow,
  findGuideTCrossing,
  guideRamalJunctions,
  flowVecAt,
  ramalFlowDirectionCheck,
} from '../PlanoEngineDrawing';
import { allocTributaryNumber, rootTributarioLabel } from '../PlanoState';
import { renderJunctions } from '../renderers/renderJunctions';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

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
    bloqueado: false,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    crossFloorGhosts: [],
    selId: null,
    _isGhostSel: false,
    _yeeFlashKey: null,
    _loadedPlanId: undefined,
    multiSel: [],
    _hiddenNets: new Set(),
    snapMode: true,
    zoom: 4,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    alerts: [] as string[],
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    render: () => {},
    _markDirty: () => {},
    toCvs: (x: number, y: number) => ({ x: x * 4 + 100, y: y * 4 + 100 }),
    mm2cvs: (mm: number) => mm * 4,
    triggerAlert: (_t: string, _m: string) => {},
    getBajantesFantasma: () => [],
  } as unknown as Partial<IPlanoEngineCore>;
  return engine as IPlanoEngineCore;
}

function recordingCtx() {
  const rec = { strokes: 0, arcs: 0 };
  const ctx = {
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => rec.strokes++,
    arc: () => rec.arcs++,
    fill: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    translate: () => {},
    rotate: () => {},
    fillText: () => {},
    measureText: () => ({ width: 0 }),
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rec };
}

describe('T-crossing — canónicos', () => {
  it('cruce en extremo detecta passThrough', () => {
    const ramal = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
    ]);
    const guide = {
      pts: [
        [0, -10],
        [0, 10],
      ] as [number, number][],
    };
    const hits = guideRamalJunctions([ramal], guide);
    const tCross = findGuideTCrossing([ramal], guide);
    expect(hits.length).toBe(1);
    expect(hits[0].point).toEqual([0, 0]);
    expect(hits[0].passThrough).toBe(true);
    expect(tCross?.ramalId).toBe('RS1');
  });

  it('af: T crea ambos tributarios y dibuja tick', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    const guide = {
      pts: [
        [0, -10],
        [0, 10],
      ] as [number, number][],
    };
    const crossing = findGuideTCrossing(engine.ramales, guide)!;
    const build = (freeEnd: [number, number], id: string) => {
      const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
      const padreLabel = rootTributarioLabel(engine.ramales, ramal.id);
      const cnt = allocTributaryNumber(engine, padreLabel);
      const newTrib = {
        ...makeRamal(id, 'af', [freeEnd, pEnd]),
        tipo: 'tributario' as const,
        padre: ramal.id,
        label: `T${cnt}${padreLabel}`,
        piso: '1',
        uc: 0,
        nSalidas: 1,
        pendiente: 2,
        bloqueado: true,
      };
      engine.ramales.push(newTrib);
      autoSplitJunctionAndSumFlow(engine, newTrib);
      return newTrib;
    };
    const t1 = build([0, -10], 'T_a');
    const t2 = build([0, 10], 'T_b');
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
    expect(engine.ramales.length).toBe(3);
    const { ctx, rec } = recordingCtx();
    renderJunctions(ctx, engine);
    expect(rec.strokes).toBeGreaterThan(0);
  });

  it('san: T en extremo choca con chequeo de flujo (plural solo af/ac/gas)', () => {
    const ramal = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
    ]);
    const alerts: string[] = [];
    const engine = makeEngine([ramal]);
    engine.triggerAlert = (t: string) => alerts.push(t);
    const guide = {
      pts: [
        [0, -10],
        [0, 10],
      ] as [number, number][],
    };
    const crossing = findGuideTCrossing(engine.ramales, guide)!;
    const build = (freeEnd: [number, number], id: string) => {
      const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
      const flowEx = flowVecAt(ramal, crossing.point, 1);
      let tribReversed: boolean | undefined;
      if (flowEx) {
        const flowNew = [pEnd[0] - freeEnd[0], pEnd[1] - freeEnd[1]];
        if (flowNew[0] * flowEx[0] + flowNew[1] * flowEx[1] <= 0) tribReversed = true;
      }
      const padreLabel = rootTributarioLabel(engine.ramales, ramal.id);
      const cnt = allocTributaryNumber(engine, padreLabel);
      const newTrib = {
        ...makeRamal(id, 'san', [freeEnd, pEnd]),
        tipo: 'tributario' as const,
        padre: ramal.id,
        label: `T${cnt}${padreLabel}`,
        piso: '1',
        uc: 0,
        nSalidas: 1,
        pendiente: 2,
        bloqueado: true,
        _tribReversed: tribReversed,
      };
      const flowErr = ramalFlowDirectionCheck(engine, newTrib, [newTrib], 0.5);
      if (flowErr) {
        alerts.push(flowErr);
        return null;
      }
      engine.ramales.push(newTrib);
      autoSplitJunctionAndSumFlow(engine, newTrib);
      return newTrib;
    };
    build([0, -10], 'T_a');
    build([0, 10], 'T_b');
    expect(alerts.length).toBeGreaterThan(0);
    expect(engine.ramales.length).toBe(1);
  });
});
