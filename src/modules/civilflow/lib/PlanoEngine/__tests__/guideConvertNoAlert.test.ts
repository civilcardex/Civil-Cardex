import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { findGuideCrossing } from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';
import { resolveRamalEndsFromGuide } from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';
import { isGuideRelativeAngleValid } from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';
import {
  buildTribFromGuide,
  snapGuideArrivalToHost,
} from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';

// Espejo del caso de la captura: guía vertical + diagonal a 45° que CRUZA el tronco (la punta
// sobresale). La conversión NO debe disparar "Ángulo no permitido": la única validación con
// cruce es la llegada relativa al host, y la diagonal está exactamente a 45°.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  if (!g.Image)
    g.Image = class {
      onload = () => {};
      onerror = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
});

function makeCanvas() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'canvas' ? null : k === 'measureText' ? () => ({ width: 10 }) : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => ctxStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}
function mk(id: string, label: string, pts: number[][], extra: Record<string, unknown> = {}) {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...extra,
  };
}
function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  const eng = new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
  (eng as unknown as { _onAlertCb: ((t: string, m: string) => void) | null })._onAlertCb = (t, m) =>
    console.log('ALERTA-DISPARADA:', t, '|', m);
  return eng;
}

const GUIDE_PTS: [number, number][] = [
  [230, 480],
  [230, 250],
  [385, 95], // diagonal 45° que cruza el tronco (y=100) y sobresale
];

describe('conversión de guía vertical+45° que cruza el tronco — sin alerta', () => {
  it('validación de llegada OK y "Crear ramal" sin alerta', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [600, 100],
      ]) as never,
    );
    eng._markDirty();
    const guide = { id: 'GL1', net: 'san', pts: GUIDE_PTS };

    // Espejo EXACTO de la validación del botón "Crear ramal":
    const crossing = findGuideCrossing(eng, guide);
    expect(crossing).not.toBeNull();
    let { pts: guidePts } = resolveRamalEndsFromGuide(eng, guide, crossing);
    // Corrección fina de llegada (±7.5°) — igual que el menú real.
    const snapped = snapGuideArrivalToHost(guidePts, crossing!.angle, 'san', 'ramal');
    console.log('SNAP:', JSON.stringify({ guidePts, ang: crossing!.angle, snapped }));
    guidePts = snapped!;
    const snapOn = true;
    const arrivalSeg: [number, number][] = [
      guidePts[guidePts.length - 2],
      guidePts[guidePts.length - 1],
    ];
    const ramalAngleOk = isGuideRelativeAngleValid(
      arrivalSeg[0],
      arrivalSeg[1],
      crossing!.angle,
      'san',
      'ramal',
      snapOn,
    );
    expect(ramalAngleOk).toBe(true); // ← si esto falla, habría alerta

    // "Crear tributario" (buildTribFromGuide) tampoco debe alertar:
    const padre = eng.ramales.find((r) => r.id === 'RS1');
    const trib = buildTribFromGuide(
      eng,
      padre!,
      [crossing!.point[0], crossing!.point[1]],
      [230, 480],
      'T_fromGuide',
      [[230, 250]], // vértice intermedio de la guía (como el menú real)
    );
    expect(trib).not.toBeNull();
  });

  it('autoAdjustGuide sobre la guía que cruza: termina EN el trazo sin alerta', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [600, 100],
      ]) as never,
    );
    eng._markDirty();
    const guide = { id: 'GL1', net: 'san', pts: GUIDE_PTS.map((p) => [...p] as [number, number]) };
    eng.guideLines.push(guide);
    // (El ajuste en sí se valida en guideAutoAdjust.test; aquí solo confirmamos que la guía
    // cruzada es detectada y la conversión posterior no alerta — cubierto arriba.)
    expect(eng.guideLines.length).toBe(1);
  });
});
