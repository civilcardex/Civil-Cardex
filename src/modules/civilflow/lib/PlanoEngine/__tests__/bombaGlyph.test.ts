import { describe, expect, it } from 'vitest';
import { renderBajantes } from '../renderers/renderBajantes';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';

// Bomba: los brazos nacen AL RAS del borde de la volute (sin entrar ni flotar) y la
// volute se interrumpe en las bocas justo en el filo de cada línea.

function makeCtx() {
  const segs: Array<{ from: number[]; to: number[] }> = [];
  let lastMove: number[] | null = null;
  const arcs: { r: number; a: number; b: number }[] = [];
  let rects = 0;
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'moveTo')
          return (x: number, y: number) => {
            lastMove = [x, y];
          };
        if (k === 'lineTo')
          return (x: number, y: number) => {
            if (lastMove) segs.push({ from: lastMove, to: [x, y] });
          };
        if (k === 'arc')
          return (x: number, y: number, r: number, a: number, b: number) => {
            void x;
            void y;
            arcs.push({ r, a, b });
          };
        if (k === 'rect' || k === 'strokeRect' || k === 'roundRect') {
          return () => {
            rects += 1;
          };
        }
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctxStub, segs, arcs, rectCount: () => rects };
}

function makeEngine(bajantes: PlanoBajante[]): IPlanoEngineCore {
  return {
    ramales: [],
    bajantes,
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    zoom: 1,
    _loadedPlanId: 1,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
    multiSel: [],
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    pxToM: (px: number) => px,
    realMmToCanvasPx: (mm: number) => mm,
    mm2cvs: (mm: number) => mm,
    MM: { lblName: 2, lblInfo: 2, coord: 2 },
    labelScaleM: 1,
    lineWidthScale: 1,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
  } as unknown as IPlanoEngineCore;
}

const bomba = (): PlanoBajante =>
  ({
    id: 'BOMAN-S1',
    net: 'san',
    tipo: 'bomba',
    code: 'BOMAN-S1',
    x: 0,
    y: 0,
    pisoBase: 'P1',
    recibeDeIds: [],
    labelAngle: 0,
    labelX: 0,
    labelY: 20,
    desplazamientos: {},
    dNominal: '',
    ucAcum: 0,
  }) as unknown as PlanoBajante;

describe('glifo de bomba', () => {
  it('brazos al ras del borde (sin entrar ni flotar) y volute interrumpida en bocas', () => {
    const { ctxStub, segs, arcs, rectCount } = makeCtx();
    renderBajantes(ctxStub, makeEngine([bomba()]));
    const R = 350 / 4;
    const dist = (p: number[]) => Math.hypot(p[0], p[1]);
    // Los 4 arranques de boquilla nacen SOBRE el círculo (al ras) y salen hacia afuera.
    const arranques = segs.filter((s) => Math.abs(dist(s.from) - R) <= 3);
    expect(arranques.length).toBeGreaterThanOrEqual(4);
    for (const s of arranques) {
      expect(dist(s.to)).toBeGreaterThanOrEqual(dist(s.from) - 1);
    }
    // Volute: arcos parciales (suman menos que el círculo completo por las 2 bocas).
    const volute = arcs.filter((a) => Math.abs(a.r - R) < 1);
    expect(volute.length).toBeGreaterThan(0);
    const sweep = volute.reduce((s, a) => s + (a.b - a.a), 0);
    expect(sweep).toBeLessThan(Math.PI * 2 - 0.2);
    expect(sweep).toBeGreaterThan(Math.PI * 2 - 2.0);
    // Centro concéntrico intacto + 2 bridas.
    expect(arcs.some((a) => Math.abs(a.r - R * 0.3) < 1)).toBe(true);
    expect(rectCount()).toBeGreaterThanOrEqual(2);
  });
});
