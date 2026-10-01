import { describe, it, expect, beforeEach } from 'vitest';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { rebasarEscalaTrazos, type PlanoWorkData } from '../PlanoPersistence';

// Prueba de validación (orig. usuario 2026-09-21): un elemento copiado a varias pisos en la
// MISMA posición relativa debe producir COTAS IDÉNTICAS en todos los pisos. Causa raíz del
// drift 0.03–0.05 m: scaleM propio por piso (calibraciones manuales divergentes) + el copiado
// reescribiendo coordenadas con toFixed aunque la escala fuera igual.

const pxParaM = (m: number, scaleM: number): number => (m * 96) / (2.54 * scaleM);

function elementoEn(distPx: number): Record<string, unknown> {
  return {
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    // Ramal vertical de 1 segmento: extremo superior = elemento, extremo inferior = la
    // línea de referencia (a distancia conocida).
    pts: [
      [500, 500 + distPx],
      [500, 500],
    ],
    totalL: distPx,
    label: 'RS1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 500,
    labelY: 500 + distPx / 2,
    labelAngle: 0,
    material: '',
    diametro: '2"',
    pendiente: 0,
    bloqueado: false,
  };
}

function makeEngine(scaleM: number, id: string) {
  const eng = {
    ramales: [] as Record<string, unknown>[],
    bajantes: [] as Record<string, unknown>[],
    crossFloorGhosts: [] as unknown[],
    dims: [] as unknown[],
    scaleM,
    definedScaleM: 0,
    activeNet: 'san',
    zoom: 1,
    offX: 0,
    offY: 0,
    lineWidthScale: 1,
    nets: [],
    areas: [],
    textAnnots: [],
    guideLines: [],
    nptLevels: [],
    _netCounts: { san: { ramal: 0, tributario: 0 } },
    nivelActual: { label: id, n: 1, npt: 0 },
    _dirty: false,
    _markDirty: () => {},
    render: () => {},
    setScaleM: (v: number) => {
      eng.scaleM = v;
    },
    saveWork: () => ({
      v: 6,
      scaleM: eng.scaleM,
      definedScaleM: 0,
      activeNet: 'san',
      zoom: 1,
      offX: 0,
      offY: 0,
      ramales: eng.ramales,
      dims: eng.dims,
      textAnnots: [],
      bajantes: eng.bajantes,
      areas: [],
      nptLevels: [],
      guideLines: [],
      crossFloorGhosts: [],
    }),
  };
  return eng;
}

function dimEntre(el: Record<string, unknown>, ref: number[]): Record<string, unknown> {
  // Misma cuenta que handleDimDown: endpoints de plano; L la llena cada test con su escala.
  const pts = el.pts as number[][];
  const pEl = pts[0];
  return { id: 'D1', x1: pEl[0], y1: pEl[1], x2: ref[0], y2: ref[1], L: undefined };
}

const pxToM = (px: number, scaleM: number): number => +((px / 96) * 2.54 * scaleM).toFixed(3);

describe('cotas idénticas entre pisos con elementos copiados', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('3 pisos con la MISMA escala: copia bit-exacta y cotas idénticas (3.990 m)', () => {
    const escala = 0.5;
    const distPx = pxParaM(3.99, escala);
    const ref: number[] = [500, 500];

    // Piso origen
    const eng1 = makeEngine(escala, 'P1');
    eng1.ramales.push(elementoEn(distPx));
    const dim1 = dimEntre(eng1.ramales[0], ref);
    dim1.L = pxToM(Math.hypot((dim1.x1 as number) - 500, (dim1.y1 as number) - 500), escala);

    // Copiar a pisos 2 y 3 (mismo scaleM en trazos origen y engine destino)
    const seed = (piso: string): void => {
      localStorage.setItem(
        `civilflow_trazos_${piso}`,
        JSON.stringify({ ramales: [elementoEn(distPx)], bajantes: [], scaleM: escala }),
      );
    };
    seed('1');
    const eng2 = makeEngine(escala, 'P2');
    copyDrawingFromPlan(eng2 as never, '2', '1', [{ netId: 'san', tipos: new Set(['ramal']) }]);
    const eng3 = makeEngine(escala, 'P3');
    copyDrawingFromPlan(eng3 as never, '3', '1', [{ netId: 'san', tipos: new Set(['ramal']) }]);

    // Cota en cada piso: MISMOS plane coords relativos (elemento→referencia)
    const l2 = pxToM(
      Math.hypot(
        (eng2.ramales[0].pts as number[][])[0][0] - 500,
        (eng2.ramales[0].pts as number[][])[0][1] - 500,
      ),
      escala,
    );
    const l3 = pxToM(
      Math.hypot(
        (eng3.ramales[0].pts as number[][])[0][0] - 500,
        (eng3.ramales[0].pts as number[][])[0][1] - 500,
      ),
      escala,
    );

    expect(dim1.L).toBeCloseTo(3.99, 9);
    expect(l2).toBe(dim1.L);
    expect(l3).toBe(dim1.L);
    // Bit-exacto: coordenadas de la copia idénticas al origen (equal estricto)
    expect(eng2.ramales[0].pts).toEqual(elementoEn(distPx).pts);
    expect(eng3.ramales[0].pts).toEqual(elementoEn(distPx).pts);
  });

  it('piso con escala divergente (0.4937): el re-base preserva la posición REAL y unifica escala', () => {
    const global = 0.5;
    const divergente = 0.4937;
    const distPx = pxParaM(3.99, divergente);

    const doc: PlanoWorkData = {
      v: 6,
      scaleM: divergente,
      definedScaleM: 0,
      activeNet: 'san',
      zoom: 1,
      offX: 0,
      offY: 0,
      nets: [],
      ramales: [elementoEn(distPx)],
      dims: [],
      textAnnots: [],
      bajantes: [],
      areas: [],
      nptLevels: [],
      guideLines: [],
    };
    // Distancia real ANTES del re-base (largo del segmento: el elemento Y su referencia
    // viven en el mismo piso — ambos se re-basan juntos, la distancia RELATIVA se preserva)
    const pts0 = doc.ramales[0] as unknown as { pts: number[][] };
    const realAntes = pxToM(
      Math.hypot(pts0.pts[0][0] - pts0.pts[1][0], pts0.pts[0][1] - pts0.pts[1][1]),
      divergente,
    );

    rebasarEscalaTrazos(doc, global);

    expect(doc.scaleM).toBe(global);
    // Misma distancia REAL (px se redujo en la misma proporción que la escala creció)
    const pts = doc.ramales[0] as unknown as { pts: number[][] };
    const realDespues = pxToM(
      Math.hypot(pts.pts[0][0] - pts.pts[1][0], pts.pts[0][1] - pts.pts[1][1]),
      global,
    );
    expect(realDespues).toBe(realAntes);
    // Idempotente
    const snapshot = JSON.stringify(doc);
    rebasarEscalaTrazos(doc, global);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('cotas idénticas tras re-base: piso divergente + copia con escala unificada', () => {
    const global = 0.5;
    const divergente = 0.4937;
    // Piso origen dibujó con SU escala divergente: elemento a 3.99 m reales
    const distPxDiv = pxParaM(3.99, divergente);
    const eng2 = makeEngine(global, 'P2');
    // Copia desde el piso divergente (trazos con scaleM divergente) al piso con global:
    // la normalización por ratio preserva la posición real → cota idéntica.
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({ ramales: [elementoEn(distPxDiv)], bajantes: [], scaleM: divergente }),
    );
    copyDrawingFromPlan(eng2 as never, '2', '1', [{ netId: 'san', tipos: new Set(['ramal']) }]);
    const pts = eng2.ramales[0].pts as number[][];
    // Largo del segmento copiado (elemento→referencia relativa) medido con la escala global.
    const l2 = pxToM(Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), global);
    expect(l2).toBeCloseTo(3.99, 2);
  });

  it('láminas desalineadas (origen de calibración distinto): la copia aterriza en el mismo punto físico', () => {
    const escala = 0.5;
    // El eje del AutoCAD está a 5.99 m reales del origen de cada lámina. Las láminas NO están
    // alineadas: el mismo punto físico cae 12 px más a la derecha en la lámina del piso 2
    // (origen de calibración marcado 12 px más a la izquierda).
    const distPx = pxParaM(5.99, escala);
    const oSrc = { x_px: 400, y_px: 300 };
    const oDst = { x_px: 388, y_px: 300 };
    const eng2 = makeEngine(escala, 'P2');
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({ ramales: [elementoEn(distPx)], bajantes: [], scaleM: escala }),
    );
    copyDrawingFromPlan(eng2 as never, '2', '1', [{ netId: 'san', tipos: new Set(['ramal']) }], {
      origenSrc: oSrc,
      origenDst: oDst,
    });
    const pts = eng2.ramales[0].pts as number[][];
    // El eje del AutoCAD es la base del elemento (500,500) en la lámina 1; el mismo punto
    // físico en la lámina 2 = eje_src − origen_src + origen_dst.
    const ejeDst = { x: 500 - oSrc.x_px + oDst.x_px, y: 500 - oSrc.y_px + oDst.y_px };
    const l2 = pxToM(Math.hypot(pts[0][0] - ejeDst.x, pts[0][1] - ejeDst.y), escala);
    expect(l2).toBeCloseTo(5.99, 2);
    // Y la posición NO es la cruda (sin alineación la copia quedaba 12 px lejos del eje):
    expect(Math.abs(pts[0][0] - ejeDst.x)).toBeLessThan(0.01);
  });
});

describe('re-base cubre TODOS los elementos con px (audit 2026-09-22)', () => {
  it('crossFloorGhosts, ghostData de etiquetas y desplazamientos se re-basan junto al resto', () => {
    const global = 0.5;
    const divergente = 0.4937;
    const f = divergente / global;
    const doc: PlanoWorkData = {
      v: 6,
      scaleM: divergente,
      definedScaleM: 0,
      activeNet: 'san',
      zoom: 1,
      offX: 0,
      offY: 0,
      nets: [],
      ramales: [],
      dims: [],
      textAnnots: [],
      areas: [],
      nptLevels: [],
      guideLines: [],
      bajantes: [
        {
          id: 'BAN2',
          x: 400,
          y: 300,
          desplazamientos: { P1: { dx: 12, dy: -4, Ldesvio: 'LD_BAN1' } },
          ghostData: { P1: { direccion: 'sube', labelX: 420, labelY: 280 } },
        },
      ],
      crossFloorGhosts: [{ id: 'XFG_BAN1_2', x: 388, y: 300 }],
    } as unknown as PlanoWorkData;

    rebasarEscalaTrazos(doc, global);

    expect(doc.scaleM).toBe(global);
    const b = doc.bajantes[0] as unknown as {
      x: number;
      y: number;
      desplazamientos: Record<string, { dx: number; dy: number }>;
      ghostData: Record<string, { labelX: number; labelY: number }>;
    };
    expect(b.x).toBeCloseTo(400 * f, 6);
    expect(b.y).toBeCloseTo(300 * f, 6);
    expect(b.desplazamientos.P1.dx).toBeCloseTo(12 * f, 6);
    expect(b.desplazamientos.P1.dy).toBeCloseTo(-4 * f, 6);
    expect(b.ghostData.P1.labelX).toBeCloseTo(420 * f, 6);
    expect(b.ghostData.P1.labelY).toBeCloseTo(280 * f, 6);
    const ghost = (doc.crossFloorGhosts || [])[0] as unknown as { x: number; y: number };
    expect(ghost.x).toBeCloseTo(388 * f, 6);
    expect(ghost.y).toBeCloseTo(300 * f, 6);

    // Idempotente
    const snapshot = JSON.stringify(doc);
    rebasarEscalaTrazos(doc, global);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
