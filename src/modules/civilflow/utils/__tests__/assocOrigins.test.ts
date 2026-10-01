import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { applyBajanteAssociation } from '../bajanteAssociation';
import { sincronizarDesvioBomba } from '../bombaAssociation';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// Alineación por ORIGEN de calibración: las láminas del mismo AutoCAD no comparten posición
// absoluta (el edificio cae en px distintos por hoja), así que la asociación entre pisos debe
// comparar y escribir coordenadas origen-relativas — mismo punto físico = alineado aunque los
// px crudos difieran; el fantasma/anillo/Ldesvio apuntan al punto físico traducido de hoja.

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
const ORIGEN1 = { x_px: 100, y_px: 100 }; // piso inferior (plan 1)
const ORIGEN2 = { x_px: 200, y_px: 50 }; // piso superior (plan 2)

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Record<string, unknown> = {
    ramales: [],
    bajantes: [],
    crossFloorGhosts: [],
    _loadedPlanId: loadedPlanId,
    nivelActual: { label: 'P2', n: 1, npt: 320 },
    activeNet: 'san',
    scaleM: 0.5,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    triggerAlert: () => {},
    updateElementById: (id: string, fields: Record<string, unknown>) => {
      const el = [
        ...(engine.bajantes as Array<Record<string, unknown>>),
        ...(engine.ramales as Array<Record<string, unknown>>),
      ].find((x) => x.id === id);
      if (el) Object.assign(el, fields);
    },
  };
  return engine as never as IPlanoEngineCore;
}

function seedPlan(planId: string, origen: { x_px: number; y_px: number } | null): void {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + planId,
    JSON.stringify({
      origen,
      // setBajanteDesplazamientoInStorage solo escribe sobre bajantes presentes en el doc.
      bajantes: [
        planId === '1'
          ? { id: 'BAN2', net: 'san', tipo: 'bajante' }
          : { id: 'BAN1', net: 'san', tipo: 'bajante' },
      ],
    }),
  );
}

interface Trazos {
  origen?: { x_px: number; y_px: number };
  ramales?: Array<{ id: string; pts?: number[][] }>;
  bajantes?: Array<{
    id: string;
    desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  }>;
  crossFloorGhosts?: Array<{ id: string; x?: number; y?: number }>;
}

const trazosDe = (planId: string): Trazos =>
  JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}') as Trazos;

const endpoint = (planId: string, id: string, x: number, y: number, npt: number) => ({
  planId,
  id,
  x,
  y,
  net: 'san',
  dNominal: '4"',
  code: id,
  nivelN: npt === 0 ? 0 : 1,
  npt,
});

beforeEach(() => {
  localStorage.clear();
  seedPlan('1', ORIGEN1);
  seedPlan('2', ORIGEN2);
});

describe('asociación entre pisos con orígenes de lámina distintos', () => {
  it('físicamente alineados (px crudos distintos): sin Ldesvio ni anillo, ghost en el punto traducido', () => {
    // BAN1 (superior) rel (50,60) → crudo (250,110); BAN2 (inferior) rel (50,60) → crudo (150,160).
    const eng = makeEngine('2');
    eng.bajantes.push(endpoint('2', 'BAN1', 250, 110, 320) as never);

    applyBajanteAssociation(
      eng,
      endpoint('2', 'BAN1', 250, 110, 320),
      endpoint('1', 'BAN2', 150, 160, 0),
      [],
    );

    const t1 = trazosDe('1');
    expect((t1.ramales || []).some((r) => r.id === 'LD_BAN1')).toBe(false);
    const ban2 = (t1.bajantes || []).find((b) => b.id === 'BAN2');
    expect(ban2?.desplazamientos ?? {}).toEqual({});

    // Fantasma en el piso superior: bajante inferior traducido a SU hoja (150−100+200, 160−100+50).
    const t2 = trazosDe('2');
    const ghost = (t2.crossFloorGhosts || []).find((g) => g.id === 'XFG_BAN2_1');
    expect(ghost?.x).toBe(250);
    expect(ghost?.y).toBe(110);
  });

  it('físicamente desalineados: anillo con el delta FÍSICO y Ldesvio con coords traducidas', () => {
    // BAN1 rel (80,60) → crudo (280,110): delta físico (30,0) px respecto a BAN2.
    const eng = makeEngine('2');
    eng.bajantes.push(endpoint('2', 'BAN1', 280, 110, 320) as never);

    applyBajanteAssociation(
      eng,
      endpoint('2', 'BAN1', 280, 110, 320),
      endpoint('1', 'BAN2', 150, 160, 0),
      [],
    );

    // El anillo vive en el bajante inferior (piso 1, escrito a storage: piso cargado es el 2).
    const t1 = trazosDe('1');
    const ban2 = (t1.bajantes || []).find((b) => b.id === 'BAN2');
    const desp = ban2?.desplazamientos?.['Piso 0'];
    expect(desp?.dx).toBe(30);
    expect(desp?.dy).toBe(0);

    // Ldesvio del punto del superior TRADUCIDO (180,160) al inferior (150,160) — no desde el
    // px crudo (280,110) de otra lámina.
    const ld = (t1.ramales || []).find((r) => r.id === 'LD_BAN1');
    expect(ld?.pts?.[0]).toEqual([180, 160]);
    expect(ld?.pts?.[1]).toEqual([150, 160]);
  });

  it('sin orígenes stampados (legacy): fallback crudo intacto', () => {
    seedPlan('1', null);
    seedPlan('2', null);
    const eng = makeEngine('2');
    eng.bajantes.push(endpoint('2', 'BAN1', 0, 0, 320) as never);

    applyBajanteAssociation(
      eng,
      endpoint('2', 'BAN1', 0, 0, 320),
      endpoint('1', 'BAN2', 0, 0, 0),
      [],
    );

    const t1 = trazosDe('1');
    expect((t1.ramales || []).some((r) => r.id === 'LD_BAN1')).toBe(false);
    const t2 = trazosDe('2');
    const ghost = (t2.crossFloorGhosts || []).find((g) => g.id === 'XFG_BAN2_1');
    expect(ghost?.x).toBe(0);
    expect(ghost?.y).toBe(0);
  });

  it('bomba→bajante: fantasma y desvío traducidos entre hojas corridas', () => {
    // Bomba en plan 1 (10,10) rel (−90,−90); bajante alineado físicamente en plan 2 = (110,−40).
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN9',
      net: 'san',
      tipo: 'bajante',
      x: 110,
      y: -40,
    } as never);

    sincronizarDesvioBomba(eng as never, { id: 'BAN9', net: 'san', x: 110, y: -40 }, '2', {
      planId: '1',
      id: 'BOMAN-S1',
      code: 'BOMAN-S1',
      caja: 'CAN1',
      nivel: 'S1',
      nivelN: -1,
      x: 10,
      y: 10,
      net: 'san',
    });

    // Alineados físicamente: sin LD ni anillo; fantasma en la posición de la bomba TRADUCIDA.
    const t1 = trazosDe('1');
    expect((t1.ramales || []).some((r) => r.id === 'LD_BAN9')).toBe(false);
    const bomba = (t1.bajantes || []).find((b) => b.id === 'BOMAN-S1');
    expect(bomba?.desplazamientos ?? {}).toEqual({});
    const t2 = trazosDe('2');
    const ghost = (t2.crossFloorGhosts || []).find((g) => g.id === 'XFG_BOMAN-S1_1');
    expect(ghost?.x).toBe(110);
    expect(ghost?.y).toBe(-40);
  });

  it('bomba→bajante desalineados: anillo con delta físico y LD desde la bomba al punto traducido', () => {
    // Bajante en (160,40) rel (−40,−10): delta físico (50,80) px respecto a la bomba.
    const eng = makeEngine('2');
    eng.bajantes.push({ id: 'BAN9', net: 'san', tipo: 'bajante', x: 160, y: 40 } as never);

    sincronizarDesvioBomba(eng as never, { id: 'BAN9', net: 'san', x: 160, y: 40 }, '2', {
      planId: '1',
      id: 'BOMAN-S1',
      code: 'BOMAN-S1',
      caja: 'CAN1',
      nivel: 'S1',
      nivelN: -1,
      x: 10,
      y: 10,
      net: 'san',
    });

    const t1 = trazosDe('1');
    const ld = (t1.ramales || []).find((r) => r.id === 'LD_BAN9');
    // Del punto de la bomba (10,10) al de la bajante TRADUCIDA a esta hoja (60,90).
    expect(ld?.pts?.[0]).toEqual([10, 10]);
    expect(ld?.pts?.[1]).toEqual([60, 90]);
  });
});
