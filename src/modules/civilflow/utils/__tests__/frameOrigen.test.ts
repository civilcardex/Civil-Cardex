import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { aFrameDe, updateCrossFloorGhostPositionBySource } from '../crossFloorStorage';
import { migrateAssocLayoutOnLoad } from '../assocLayoutMigration';
import { rebasarEscalaTrazos, type PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence';

// Frame del origen de calibración (auditoría 2026-09-22 F-1..F-6): UNA sola fuente del origen
// (meta de plans, que viaja a BD — el doc de trazos es fallback y el autosave lo borra), ghosts
// siempre en el frame de su anfitrión (creación, arrastre y migración), y re-base de escala
// anclado al origen (px−origen constante = posición física preservada; deltas escalan puros).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  }
});

// Hojas corridas: el mismo punto físico cae 100 px a la derecha y 50 px arriba en la lámina 2.
const ORIGEN1 = { x_px: 100, y_px: 100 };
const ORIGEN2 = { x_px: 200, y_px: 50 };

const trazosKey = (planId: string): string => 'civilflow_' + TRAZOS_PREFIX + planId;

interface Trazos {
  origen?: { x_px: number; y_px: number } | null;
  bajantes?: Array<{ id: string; x?: number; y?: number }>;
  crossFloorGhosts?: Array<Record<string, unknown>>;
  assocLayout?: number;
}

const trazosDe = (planId: string): Trazos =>
  JSON.parse(localStorage.getItem(trazosKey(planId)) || '{}') as Trazos;

function seedPlan(planId: string, doc: Trazos): void {
  localStorage.setItem(trazosKey(planId), JSON.stringify(doc));
}

beforeEach(() => {
  localStorage.clear();
});

describe('origenDePlan — meta de plans como fuente única', () => {
  it('aFrameDe usa el origen del META aunque el doc traiga otro', () => {
    seedPlan('1', { origen: { x_px: 999, y_px: 999 }, bajantes: [{ id: 'BAN2' }] });
    seedPlan('2', { origen: { x_px: 888, y_px: 888 }, bajantes: [{ id: 'BAN1' }] });
    localStorage.setItem(
      'civilflow_plans_meta',
      JSON.stringify([
        { id: 1, origen: ORIGEN1 },
        { id: 2, origen: ORIGEN2 },
      ]),
    );
    // Delta por META: (100,100)−(100,100) vs (200,50) → +100,−50.
    expect(aFrameDe({ x: 100, y: 100 }, '1', '2')).toEqual({ x: 200, y: 50 });
  });

  it('sobrevive al autosave que borra doc.origen (serializeWork no lo serializa)', () => {
    seedPlan('1', { origen: ORIGEN1, bajantes: [{ id: 'BAN2' }] });
    seedPlan('2', { origen: ORIGEN2, bajantes: [{ id: 'BAN1' }] });
    localStorage.setItem(
      'civilflow_plans_meta',
      JSON.stringify([
        { id: 1, origen: ORIGEN1 },
        { id: 2, origen: ORIGEN2 },
      ]),
    );
    // El autosave re-escribe el doc SIN origen.
    seedPlan('2', { origen: null, bajantes: [{ id: 'BAN1' }] });
    expect(aFrameDe({ x: 100, y: 100 }, '1', '2')).toEqual({ x: 200, y: 50 });
  });

  it('sin meta cae al doc (fallback legacy/test)', () => {
    seedPlan('1', { origen: ORIGEN1, bajantes: [{ id: 'BAN2' }] });
    seedPlan('2', { origen: ORIGEN2, bajantes: [{ id: 'BAN1' }] });
    expect(aFrameDe({ x: 100, y: 100 }, '1', '2')).toEqual({ x: 200, y: 50 });
  });
});

describe('updateCrossFloorGhostPositionBySource — ghost en frame del anfitrión', () => {
  it('convierte las coords crudas del origen al frame del piso destino', () => {
    seedPlan('1', { origen: ORIGEN1, bajantes: [{ id: 'BAN2', x: 100, y: 100 }] });
    seedPlan('2', {
      origen: ORIGEN2,
      bajantes: [{ id: 'BAN1' }],
      crossFloorGhosts: [
        { id: 'XFG_BAN2_1', sourcePlanId: '1', sourceBajanteId: 'BAN2', x: 0, y: 0 },
      ],
    });
    // El bajante origen se arrastra a (100,100) en SU plano → el ghost del piso 2 queda en
    // (100−100+200, 100−100+50) = (200,50), no en (100,100) crudo.
    updateCrossFloorGhostPositionBySource('1', 'BAN2', 100, 100);
    expect(trazosDe('2').crossFloorGhosts?.[0]).toMatchObject({ x: 200, y: 50 });
  });
});

describe('migrateAssocLayoutOnLoad — re-anclaje de ghosts layout-2', () => {
  it('re-ancla el ghost al frame actual aunque el doc ya esté migrado (flag 2)', () => {
    seedPlan('1', { origen: ORIGEN1, bajantes: [{ id: 'BAN2', x: 80, y: 70 }] });
    seedPlan('2', {
      origen: ORIGEN2,
      bajantes: [{ id: 'BAN1' }],
      assocLayout: 2,
      crossFloorGhosts: [
        {
          id: 'XFG_BAN2_2',
          sourcePlanId: '1',
          sourceBajanteId: 'BAN2',
          targetBajanteId: 'BAN1',
          x: 0,
          y: 0,
          layout: 2,
        },
      ],
    });
    // Recalibrar cambió la traducción entre frames: el ghost persistido (0,0) queda en px del
    // frame viejo — la apertura lo re-ancla a aFrameDe({80,70},'1','2') = (180,20).
    migrateAssocLayoutOnLoad('2', 'P2');
    expect(trazosDe('2').crossFloorGhosts?.[0]).toMatchObject({ x: 180, y: 20 });
  });
});

describe('rebasarEscalaTrazos — anclado al origen de calibración', () => {
  it('puntos absolutos preservan px−origen; deltas y offsets escalan puros', () => {
    const doc = {
      scaleM: 0.5,
      ramales: [{ id: 'R1', pts: [[400, 300]], labelX: 400, labelY: 300 }],
      bajantes: [
        {
          id: 'BAN2',
          x: 400,
          y: 300,
          desplazamientos: { P2: { dx: 50, dy: 25, Ldesvio: 'LD_BAN2' } },
        },
      ],
      textAnnots: [{ id: 'T1', x: 100, y: 100, lblOffX: 10, lblOffY: 5 }],
      areas: [],
      dims: [],
    } as unknown as PlanoWorkData;
    rebasarEscalaTrazos(doc, 1, { x_px: 100, y_px: 50 });
    // Absoluto: (px−origen)·f + origen → 250 = 100+(400−100)·f (px−origen 300 → 150 ✓).
    expect((doc.ramales as Array<{ pts: number[][] }>)[0].pts[0]).toEqual([250, 175]);
    // Delta: escala puro — anclarlo lo desplazaría.
    expect(
      (doc.bajantes as Array<{ desplazamientos: Record<string, { dx: number; dy: number }> }>)[0]
        .desplazamientos.P2,
    ).toEqual({ dx: 25, dy: 12.5, Ldesvio: 'LD_BAN2' });
    // Offset de texto: relativo al punto — puro. Punto: anclado.
    expect((doc.textAnnots as Array<{ x: number; lblOffX: number }>)[0].x).toBe(100);
    expect((doc.textAnnots as Array<{ lblOffX: number; lblOffY: number }>)[0].lblOffX).toBe(5);
    expect((doc.textAnnots as Array<{ lblOffY: number }>)[0].lblOffY).toBe(2.5);
    expect(doc.scaleM).toBe(1);
  });
});
