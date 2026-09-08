import { describe, it, expect } from 'vitest';
import { handleGuideDown, commitOpenGuide, snapGuideSegmentToRamal } from '../guideLines';
import type { IPlanoEngineCore } from '../PlanoState';
import type { PlanoRamal } from '../PlanoState';

// Ítem 2: una línea guía se compone de varios segmentos consecutivos (L, U) — cada clic agrega
// un vértice y el cierre (re-clic sobre el último vértice = doble-click, Esc, o cambio de
// herramienta) commitea UNA entidad con todos los segmentos y un solo snapshot.
// Ítems 3/4/7: el segmento que conecta con el extremo de un ramal en ángulo fuera de regla se
// corrige LOCALMENTE (pivote fijo = vértice anterior); los segmentos anteriores jamás se mueven.
function makeEngine(opts?: { snapMode?: boolean; ramales?: PlanoRamal[] }): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    guideLines: [],
    _guideStart: null,
    _guidePts: null,
    activeNet: 'san',
    tool: 'guide',
    snapMode: false,
    zoom: 1,
    mouseX: 0,
    mouseY: 0,
    ramales: [],
    _hiddenNets: new Set<string>(),
    // Stub identidad: el foco de estos tests es la corrección de conexión, no la cuadrícula.
    snapAngle: (_x0: number, _y0: number, x1: number, y1: number) => ({ x: x1, y: y1 }),
    snapToExisting: () => null,
    render: () => {},
    _markDirty: () => {},
    ...opts,
  };
  return engine as IPlanoEngineCore;
}

/** Ramal mínimo para los tests de conexión (solo net + pts son leídos por la corrección). */
function hostRamal(net: string, pts: [number, number][]): PlanoRamal {
  return { id: 'RX', net, pts } as unknown as PlanoRamal;
}

describe('ítem 2 — guías multisegmento', () => {
  it('los clics encadenan segmentos en la misma guía', () => {
    const eng = makeEngine();
    handleGuideDown(eng, 0, 0);
    handleGuideDown(eng, 40, 0);
    handleGuideDown(eng, 40, 30);
    expect(eng.guideLines.length).toBe(0);
    expect(eng._guidePts).toEqual([
      [0, 0],
      [40, 0],
      [40, 30],
    ]);
  });

  it('re-clic sobre el último vértice commitea una sola guía con 3 vértices', () => {
    const eng = makeEngine();
    handleGuideDown(eng, 0, 0);
    handleGuideDown(eng, 40, 0);
    handleGuideDown(eng, 40, 30);
    handleGuideDown(eng, 40, 30);
    expect(eng.guideLines.length).toBe(1);
    expect(eng.guideLines[0].pts).toEqual([
      [0, 0],
      [40, 0],
      [40, 30],
    ]);
    expect(eng._guidePts).toBeNull();
  });

  it('commit con 0-1 vértices descarta (no crea entidad)', () => {
    const eng = makeEngine();
    handleGuideDown(eng, 5, 5);
    commitOpenGuide(eng);
    expect(eng.guideLines.length).toBe(0);
    expect(eng._guidePts).toBeNull();
  });
});

describe('ítems 3/4/7 — corrección local de ángulo al conectar con trazo existente', () => {
  // Caso obligatorio del pedido: guía de 3 segmentos cuyo 3.º conecta con un ramal san en
  // ángulo relativo ~108° (fuera de regla) → se corrige a 90° relativa SOLO ese segmento.
  it('san: 3er segmento corregido a 90° relativa; segmentos 1-2 intactos; una sola entidad', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    handleGuideDown(eng, 0, 0);
    handleGuideDown(eng, 80, 0);
    handleGuideDown(eng, 80, 30);
    // Clic sobre el extremo del ramal (100,50): la relative queda 108.4° → se corrige.
    handleGuideDown(eng, 100, 50);
    expect(eng._guidePts).toEqual([
      [0, 0],
      [80, 0],
      [80, 30],
      [92, 54], // cruce exacto del rayo a 90° relativa con la línea del ramal
    ]);
    // Commit (re-clic sobre el último vértice) → una sola guía, pasada idempotente.
    const last = eng._guidePts![eng._guidePts!.length - 1];
    handleGuideDown(eng, last[0], last[1]);
    expect(eng.guideLines.length).toBe(1);
    expect(eng.guideLines[0].pts).toEqual([
      [0, 0],
      [80, 0],
      [80, 30],
      [92, 54],
    ]);
  });

  it('san: continuar con un 4.º segmento tras la corrección — misma guía (ítem 8)', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    handleGuideDown(eng, 0, 0);
    handleGuideDown(eng, 80, 0);
    handleGuideDown(eng, 80, 30);
    handleGuideDown(eng, 100, 50); // corrección local del 3.er segmento
    handleGuideDown(eng, 92, 100); // 4.º segmento alejándose del extremo — misma guía
    expect(eng._guidePts).toEqual([
      [0, 0],
      [80, 0],
      [80, 30],
      [92, 54],
      [92, 100],
    ]);
    commitOpenGuide(eng);
    expect(eng.guideLines.length).toBe(1);
    expect(eng.guideLines[0].pts.length).toBe(5);
  });

  it('gas: conexión a 135° relativa se corrige a 90° relativa', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('gas', [
          [0, 200],
          [100, 200],
        ]),
      ],
    });
    handleGuideDown(eng, 60, 240);
    handleGuideDown(eng, 100, 200);
    expect(eng._guidePts![0]).toEqual([60, 240]);
    expect(eng._guidePts![1][0]).toBeCloseTo(60, 6);
    expect(eng._guidePts![1][1]).toBeCloseTo(200, 6);
  });

  it('conexión ya válida (45° relativa san) no se modifica', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    // Segmento a 108.435° absoluto = 45.0° relativa al host (dir 153.435°), pasando a <16 px
    // del extremo (100,50) → detectado pero válido → sin cambio.
    handleGuideDown(eng, 88, 38);
    handleGuideDown(eng, 75.351, 75.947);
    expect(eng._guidePts).toEqual([
      [88, 38],
      [75.351, 75.947],
    ]);
  });

  it('guía de 2 puntos: corrección LOCAL — el primer vértice no se mueve (antes se trasladaba global)', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    handleGuideDown(eng, 80, 30);
    handleGuideDown(eng, 100, 50);
    commitOpenGuide(eng);
    expect(eng.guideLines.length).toBe(1);
    expect(eng.guideLines[0].pts).toEqual([
      [80, 30],
      [92, 54],
    ]);
  });

  it('snapMode off: sin corrección (dibujo libre)', () => {
    const eng = makeEngine({
      snapMode: false,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    handleGuideDown(eng, 80, 30);
    handleGuideDown(eng, 100, 50);
    commitOpenGuide(eng);
    expect(eng.guideLines[0].pts).toEqual([
      [80, 30],
      [100, 50],
    ]);
  });

  it('sin conexión cercana no modifica nada', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    handleGuideDown(eng, 0, 0);
    handleGuideDown(eng, 40, 0);
    expect(eng._guidePts).toEqual([
      [0, 0],
      [40, 0],
    ]);
  });

  it('snapGuideSegmentToRamal: cruce corregido cae sobre la línea del ramal con ángulo exacto', () => {
    const eng = makeEngine({
      snapMode: true,
      ramales: [
        hostRamal('san', [
          [0, 100],
          [100, 50],
        ]),
      ],
    });
    const out = snapGuideSegmentToRamal(eng, { x: 80, y: 30 }, { x: 100, y: 50 });
    expect(out.x).toBeCloseTo(92, 6);
    expect(out.y).toBeCloseTo(54, 6);
    // Ángulo relativo exacto: u=(92,54)-(80,30) vs d̂=(-0.8944,0.4472) → cos = 0 → 90°.
    const ux = (out.x - 80) / Math.hypot(out.x - 80, out.y - 30);
    const uy = (out.y - 30) / Math.hypot(out.x - 80, out.y - 30);
    const cos = ux * -0.894427 + uy * 0.447214;
    expect(Math.abs(cos)).toBeLessThan(1e-5);
  });
});
