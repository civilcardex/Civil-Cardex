import { describe, it, expect } from 'vitest';
import {
  autoSplitJunctionAndSumFlow,
  findGuideTCrossing,
  guideRamalJunctions,
  snapGuideLineToRamal,
  snapGuideCrossingToEndpoint,
  flowVecAt,
  ramalFlowDirectionCheck,
} from '../PlanoEngineDrawing';
import { allocTributaryNumber, rootTributarioLabel } from '../PlanoState';
import { checkRamalAngles } from '../drawingAngles';
import { renderJunctions } from '../renderers/renderJunctions';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ítem 1.3: la línea guía que ATRAVIESA el extremo de un ramal habilita "Crear tributarios"
// (división en T). Regresiones: (a) la detección del cruce (el parámetro t de la proyección
// debe normalizarse por la longitud de la guía — sin el divisor el cruce nunca se detectaba);
// (b) el tick de unión se dibuja en el cruce cuando existen los dos tributarios; (c) el botón
// plural está restringido a af/ac/gas porque en san/ll/vent el chequeo de dirección de flujo
// rechaza siempre uno de los dos lados (la unión quedaría en punto muerto).

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
  const calls: string[] = [];
  const rec = { strokes: 0, arcs: 0 };
  const ctx = {
    beginPath: () => calls.push('bp'),
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {
      rec.strokes++;
      calls.push('st');
    },
    arc: () => {
      rec.arcs++;
      calls.push('arc');
    },
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
  return { ctx, rec, calls };
}

describe('T-crossing repro', () => {
  it('guide crossings at the ramal endpoint are detected', () => {
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

  it('creates both tributaries and draws the junction tick at the crossing', () => {
    const ramal = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    const t1 = makeRamal('T1_a', 'san', [
      [0, -10],
      [0, 0],
    ]);
    t1.tipo = 'tributario';
    t1.padre = 'RS1';
    const t2 = makeRamal('T1_b', 'san', [
      [0, 10],
      [0, 0],
    ]);
    t2.tipo = 'tributario';
    t2.padre = 'RS1';
    engine.ramales.push(t1, t2);
    autoSplitJunctionAndSumFlow(engine, t1);
    autoSplitJunctionAndSumFlow(engine, t2);

    expect(engine.ramales.length).toBe(3);
    // El padre NO se dividió (el cruce es su extremo, no su cuerpo)
    expect(ramal.pts.length).toBe(2);

    const { ctx, rec } = recordingCtx();
    renderJunctions(ctx, engine);
    // Si el símbolo de unión se dibujó, hubo al menos un stroke con 3 brazos (tick)
    expect(rec.strokes).toBeGreaterThan(0);
  });

  it('san/ll/vent: la división en T del extremo siempre choca con el chequeo de flujo (por eso el botón plural es solo af/ac/gas)', () => {
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
    expect(crossing.point).toEqual([0, 0]);

    const build = (freeEnd: [number, number], id: string): PlanoRamal | null => {
      const pStart = freeEnd;
      const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
      let tribReversedForFlow: boolean | undefined;
      const flowEx = flowVecAt(ramal, crossing.point, 1);
      if (flowEx) {
        const flowNew = [pEnd[0] - pStart[0], pEnd[1] - pStart[1]];
        if (flowNew[0] * flowEx[0] + flowNew[1] * flowEx[1] <= 0) {
          tribReversedForFlow = true;
        }
      }
      const padreLabel = rootTributarioLabel(engine.ramales, ramal.id);
      const cnt = allocTributaryNumber(engine, padreLabel);
      const label = `T${cnt}${padreLabel}`;
      const newTrib = {
        ...makeRamal(id, 'san', [pStart, pEnd]),
        tipo: 'tributario' as const,
        padre: ramal.id,
        label,
        piso: '1',
        uc: 0,
        nSalidas: 1,
        pendiente: 2,
        bloqueado: true,
        _tribReversed: tribReversedForFlow,
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

    const base = 'T' + Date.now();
    build([guide.pts[0][0], guide.pts[0][1]], base + '_a');
    build([guide.pts[1][0], guide.pts[1][1]], base + '_b');

    // Cruce perpendicular: los dos lados quedan en contra de la dirección del padre → nada se
    // crea y la alerta dispara. Es el motivo de que el botón plural esté restringido a af/ac/gas.
    expect(alerts.length).toBeGreaterThan(0);
    expect(engine.ramales.length).toBe(1);
  });

  it('af: la división en T crea ambos tributarios y dibuja el tick de unión', () => {
    const ramal = makeRamal('RAF1', 'af', [
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
    expect(crossing.point).toEqual([0, 0]);

    const build = (freeEnd: [number, number], id: string): PlanoRamal | null => {
      const pStart = freeEnd;
      const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
      // af/ac/gas no tienen chequeo de flujo san/ll/vent
      const padreLabel = rootTributarioLabel(engine.ramales, ramal.id);
      const cnt = allocTributaryNumber(engine, padreLabel);
      const label = `T${cnt}${padreLabel}`;
      const newTrib = {
        ...makeRamal(id, 'af', [pStart, pEnd]),
        tipo: 'tributario' as const,
        padre: ramal.id,
        label,
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

    const base = 'T' + Date.now();
    const t1 = build([guide.pts[0][0], guide.pts[0][1]], base + '_a');
    const t2 = build([guide.pts[1][0], guide.pts[1][1]], base + '_b');

    expect(alerts).toEqual([]);
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
    expect(engine.ramales.length).toBe(3);
    // El padre NO se dividió (el cruce es su extremo, no su cuerpo)
    expect(ramal.pts.length).toBe(2);

    const { ctx, rec } = recordingCtx();
    renderJunctions(ctx, engine);
    expect(rec.strokes).toBeGreaterThan(0);
  });

  it('el highlight de conexión también marca cruces con el CUERPO del ramal', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const guide = {
      pts: [
        [5, -10],
        [5, 10],
      ] as [number, number][],
    };
    const hits = guideRamalJunctions([ramal], guide);
    expect(hits.some((h) => Math.hypot(h.point[0] - 5, h.point[1] - 0) < 0.01)).toBe(true);
  });

  it('snap de conexión: guía cerca de un extremo con ángulo fuera de snap se traslada y rota a 90°', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    // Guía a ~78.7° que pasa a ~0.8 del extremo (0,0) — dentro del radio de snap (16/zoom=4).
    const line = snapGuideLineToRamal(engine, { x: -2, y: -10 }, { x: 2, y: 10 });
    const gx = line.p.x - line.s.x;
    const gy = line.p.y - line.s.y;
    const glen = Math.hypot(gx, gy);
    // Dirección perpendicular al ramal (90°)
    expect(Math.abs((gx / glen) * 1 + (gy / glen) * 0)).toBeLessThan(1e-6);
    // Pasa exactamente por el extremo (0,0)
    const t = ((0 - line.s.x) * (gx / glen) + (0 - line.s.y) * (gy / glen)) / glen;
    const dist = Math.hypot(
      0 - (line.s.x + (gx / glen) * glen * t),
      0 - (line.s.y + (gy / glen) * glen * t),
    );
    expect(dist).toBeLessThan(1e-6);
  });

  it('snap de conexión: guía lejos de todo extremo queda intacta', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    const line = snapGuideLineToRamal(engine, { x: 50, y: -10 }, { x: 50, y: 10 });
    expect(line.s).toEqual({ x: 50, y: -10 });
    expect(line.p).toEqual({ x: 50, y: 10 });
  });

  it('cruce del singular CERCA del extremo del ramal se ajusta al extremo exacto (codo, no tee)', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    // La guía cruza el último segmento a 1 unidad del extremo (10,0) — dentro del umbral de snap.
    const snapped = snapGuideCrossingToEndpoint(engine, 'RAF1', [9, 0]);
    expect(snapped).toEqual([10, 0]);
    // Tributario que aterriza en el extremo: autoSplit NO divide al padre (extremo-con-extremo).
    const trib = makeRamal('T1', 'af', [
      [9, -10],
      [10, 0],
    ]);
    trib.tipo = 'tributario';
    trib.padre = 'RAF1';
    engine.ramales.push(trib);
    autoSplitJunctionAndSumFlow(engine, trib);
    expect(ramal.pts.length).toBe(2);
    // Solo 2 brazos en la unión → renderJunctions no dibuja tick de tee.
    const { ctx, rec } = recordingCtx();
    renderJunctions(ctx, engine);
    expect(rec.strokes).toBe(0);
  });

  it('cruce del singular LEJOS del extremo se conserva (tee legítima a mitad de cuerpo)', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    const kept = snapGuideCrossingToEndpoint(engine, 'RAF1', [5, 0]);
    expect(kept).toEqual([5, 0]);
  });

  it('plural af: BOTH tribunarios sobreviven y NINGUNO lleva accesorio tras la conversión (sin modal, sin codo)', () => {
    const ramal = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([ramal]);
    engine.triggerAlert = () => {};
    // Guía vertical que atraviesa el extremo (0,0) — escenario del botón "Crear tributarios".
    const crossing = findGuideTCrossing(engine.ramales, {
      pts: [
        [0, -10],
        [0, 10],
      ] as [number, number][],
    })!;
    expect(crossing).not.toBeNull();
    const padre = engine.ramales.find((r) => r.id === crossing.ramalId)!;

    // Misma creación que buildTribFromGuide (DrawingElementContextMenu.tsx) — af NO tiene
    // chequeo de flujo san/ll/vent, así que solo importa checkRamalAngles + autoSplit.
    const build = (freeEnd: [number, number], id: string): PlanoRamal | null => {
      const pStart: [number, number] = [freeEnd[0], freeEnd[1]];
      const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
      if (!checkRamalAngles([pStart, pEnd], padre.net, 'tributario')) return null;
      const padreLabel = rootTributarioLabel(engine.ramales, padre.id);
      const cnt = allocTributaryNumber(engine, padreLabel);
      const label = `T${cnt}${padreLabel}`;
      const newTrib = {
        ...makeRamal(id, 'af', [pStart, pEnd]),
        tipo: 'tributario' as const,
        padre: padre.id,
        label,
        piso: '1',
        uc: 0,
        nSalidas: 1,
        pendiente: 2,
        // buildTribFromGuide define labelX/labelY/labelAngle pero NO accesorioInicio/Fin.
        labelX: (pStart[0] + pEnd[0]) / 2,
        labelY: (pStart[1] + pEnd[1]) / 2,
        labelAngle: 0,
        bloqueado: true,
      };
      engine.ramales.push(newTrib);
      autoSplitJunctionAndSumFlow(engine, newTrib);
      return newTrib;
    };

    const [p0, p1] = [
      [0, -10],
      [0, 10],
    ] as [number, number][];
    const base = 'T' + Date.now();
    const t1 = build([p0[0], p0[1]], base + '_a');
    const t2 = build([p1[0], p1[1]], base + '_b');
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();

    // Los TRES ramales sobreviven (padre + t1 + t2) — regresión "se borro ambos tributarios".
    expect(engine.ramales.filter((r) => r.id === t1!.id).length).toBe(1);
    expect(engine.ramales.filter((r) => r.id === t2!.id).length).toBe(1);
    expect(engine.ramales.length).toBe(3);

    // NINGÚN accesorio de extremo en los tributarios — regresión "símbolo C90".
    expect(t1!.accesorioInicio || t1!.accesorioFin).toBeFalsy();
    expect(t2!.accesorioInicio || t2!.accesorioFin).toBeFalsy();
  });
});
