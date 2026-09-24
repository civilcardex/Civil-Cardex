import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { sanearAsociacionesTrasRecalibrar } from '../sanearAsociaciones';

// Recalibración del origen: los artefactos de asociación (anillo dx/dy, inicio del Ldesvio,
// ghost espejo) codifican posiciones del OTRO frame — el saneador los traslada por Δ =
// origen_nuevo − origen_viejo. Signos derivados: P inferior (host) → +Δ en anillo/LD propios
// y −Δ en el ghost que lo espeja arriba; P superior → −Δ en el anillo/LD del partner y +Δ en
// sus ghosts propios.

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

const O1_INICIAL = { x_px: 100, y_px: 100 };
const O2 = { x_px: 200, y_px: 50 };

const trazosKey = (planId: string): string => 'civilflow_' + TRAZOS_PREFIX + planId;

interface Trazos {
  origen?: { x_px: number; y_px: number } | null;
  ramales?: Array<{ id: string; pts: number[][]; totalL?: number; label?: string }>;
  bajantes?: Array<{
    id: string;
    x?: number;
    y?: number;
    origenId?: string;
    descargaEnId?: string;
    desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  }>;
  crossFloorGhosts?: Array<{
    id: string;
    x?: number;
    y?: number;
    layout?: number;
    sourcePlanId?: string;
    sourceBajanteId?: string;
    targetBajanteId?: string;
  }>;
}

const trazosDe = (planId: string): Trazos =>
  JSON.parse(localStorage.getItem(trazosKey(planId)) || '{}') as Trazos;

function seedPlan(planId: string, doc: Trazos): void {
  localStorage.setItem(trazosKey(planId), JSON.stringify(doc));
}

/** Escenario base: BAN1 superior (plan 2) en (550,380); BAN2 inferior (plan 1) en (500,400)
 *  con anillo y LD_BAN1 coherentes con los orígenes O1/O2; ghost espejo del inferior en el 2. */
function seedAsociacion(): void {
  // Derivados a mano con O1={100,100} / O2={200,50} (aFrameDe crudo aquí devolvería el punto
  // intacto: los docs aún no existen — sembrar y luego calcular sería circular).
  const upperEn1 = { x: 450, y: 430 };
  const ghostEn2 = { x: 600, y: 350 };
  seedPlan('1', {
    origen: O1_INICIAL,
    bajantes: [
      {
        id: 'BAN2',
        x: 500,
        y: 400,
        origenId: '2|BAN1',
        desplazamientos: { P2: { dx: upperEn1.x - 500, dy: upperEn1.y - 400, Ldesvio: 'LD_BAN1' } },
      },
    ],
    ramales: [
      {
        id: 'LD_BAN1',
        pts: [
          [upperEn1.x, upperEn1.y],
          [500, 400],
        ],
      },
    ],
  });
  seedPlan('2', {
    origen: O2,
    bajantes: [{ id: 'BAN1', x: 550, y: 380, descargaEnId: '1|BAN2' }],
    crossFloorGhosts: [
      {
        id: 'XFG_BAN2_1',
        x: ghostEn2.x,
        y: ghostEn2.y,
        layout: 2,
        sourcePlanId: '1',
        sourceBajanteId: 'BAN2',
        targetBajanteId: 'BAN1',
      },
    ],
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('sanearAsociacionesTrasRecalibrar', () => {
  it('P inferior recalibrado: anillo y LD propios +Δ; ghost remoto −Δ', () => {
    seedAsociacion();
    const nuevo = { x_px: 120, y_px: 110 }; // Δ = (+20, +10)
    seedPlan('1', { ...trazosDe('1'), origen: nuevo }); // stamp del nuevo origen (como fill)
    sanearAsociacionesTrasRecalibrar('1', O1_INICIAL);
    const anillo = trazosDe('1').bajantes?.[0].desplazamientos?.P2;
    expect(anillo).toEqual({ dx: -50 + 20, dy: 30 + 10, Ldesvio: 'LD_BAN1' });
    // LD pts[0] = 450,430 → +Δ; pts[1] (frame propio) intacto.
    expect(trazosDe('1').ramales?.[0].pts[0]).toEqual([470, 440]);
    expect(trazosDe('1').ramales?.[0].pts[1]).toEqual([500, 400]);
    // Ghost espejo en el piso 2: −Δ.
    expect(trazosDe('2').crossFloorGhosts?.[0]).toMatchObject({ x: 600 - 20, y: 350 - 10 });
  });

  it('P superior recalibrado: anillo y LD del partner −Δ; ghost propio +Δ', () => {
    seedAsociacion();
    const nuevo2 = { x_px: 205, y_px: 55 }; // Δ2 = (+5, +5)
    seedPlan('2', { ...trazosDe('2'), origen: nuevo2 });
    sanearAsociacionesTrasRecalibrar('2', O2);
    expect(trazosDe('1').bajantes?.[0].desplazamientos?.P2).toEqual({
      dx: -50 - 5,
      dy: 30 - 5,
      Ldesvio: 'LD_BAN1',
    });
    expect(trazosDe('1').ramales?.[0].pts[0]).toEqual([445, 425]);
    expect(trazosDe('2').crossFloorGhosts?.[0]).toMatchObject({ x: 605, y: 355 });
  });

  it('primera calibración (prevOrigen null) es no-op', () => {
    seedAsociacion();
    const antes = JSON.stringify(trazosDe('1'));
    seedPlan('1', { ...trazosDe('1'), origen: O1_INICIAL });
    sanearAsociacionesTrasRecalibrar('1', null);
    expect(JSON.stringify(trazosDe('1'))).toBe(antes);
  });

  it('Δ cero (mismo origen) es no-op — idempotente', () => {
    seedAsociacion();
    const antes = JSON.stringify(trazosDe('1'));
    sanearAsociacionesTrasRecalibrar('1', O1_INICIAL);
    expect(JSON.stringify(trazosDe('1'))).toBe(antes);
  });

  it('ids colisionados entre pisos: el rol lo decide el PUNTERO, no el id', () => {
    // P=1 recalibrado; P tiene su BAN1 local y el partner superior TAMBIÉN se llama BAN1
    // (los ids BAN<n> se renumeran por piso y colisionan). Con membresía de id el anillo
    // propio quedaba sin trasladar (falso negativo); con el puntero '2|BAN1' va bien.
    seedPlan('1', {
      origen: O1_INICIAL,
      bajantes: [
        { id: 'BAN1', x: 800, y: 800 }, // local colisionado
        {
          id: 'BAN2',
          x: 500,
          y: 400,
          origenId: '2|BAN1',
          desplazamientos: { P2: { dx: -50, dy: 30, Ldesvio: 'LD_BAN1' } },
        },
      ],
      ramales: [
        {
          id: 'LD_BAN1',
          pts: [
            [450, 430],
            [500, 400],
          ],
        },
      ],
    });
    seedPlan('2', {
      origen: O2,
      bajantes: [{ id: 'BAN1', x: 550, y: 380, descargaEnId: '1|BAN2' }],
    });
    const nuevo = { x_px: 120, y_px: 110 }; // Δ = (+20, +10)
    seedPlan('1', { ...trazosDe('1'), origen: nuevo });
    sanearAsociacionesTrasRecalibrar('1', O1_INICIAL);
    expect(trazosDe('1').bajantes?.[1].desplazamientos?.P2).toMatchObject({ dx: -30, dy: 40 });
    expect(trazosDe('1').ramales?.[0].pts[0]).toEqual([470, 440]);
  });

  it('cadena de 3 pisos: recalibrar P no toca asociaciones ajenas con ids que colisionan', () => {
    // P=3 (con BAN1 local); el piso 5 tiene un anillo cuyo superior es el BAN1 del piso 4.
    // Con membresía de id, esPartner disparaba y restaba el Δ de P a esa asociación ajena.
    seedPlan('3', {
      origen: { x_px: 300, y_px: 300 },
      bajantes: [{ id: 'BAN1', x: 100, y: 100 }],
    });
    seedPlan('4', {
      origen: { x_px: 400, y_px: 400 },
      bajantes: [{ id: 'BAN1', x: 550, y: 380 }],
    });
    seedPlan('5', {
      origen: { x_px: 500, y_px: 500 },
      bajantes: [
        {
          id: 'BAN2',
          x: 600,
          y: 600,
          origenId: '4|BAN1',
          desplazamientos: { P4: { dx: -50, dy: -220, Ldesvio: 'LD_BAN1' } },
        },
      ],
      ramales: [
        {
          id: 'LD_BAN1',
          pts: [
            [550, 380],
            [600, 600],
          ],
        },
      ],
    });
    const nuevo3 = { x_px: 310, y_px: 305 }; // Δ3 = (+10, +5)
    seedPlan('3', { ...trazosDe('3'), origen: nuevo3 });
    sanearAsociacionesTrasRecalibrar('3', { x_px: 300, y_px: 300 });
    // El piso 5 NO se mueve (su asociación es 5←4, nada que ver con P=3).
    expect(trazosDe('5').bajantes?.[0].desplazamientos?.P4).toEqual({
      dx: -50,
      dy: -220,
      Ldesvio: 'LD_BAN1',
    });
    expect(trazosDe('5').ramales?.[0].pts[0]).toEqual([550, 380]);
  });

  it('re-anclaje por carga (gemelo de ghosts para anillos) sana origen cambiado afuera', async () => {
    seedAsociacion();
    // Otro dispositivo recalibró plan 1 a {120,110} (doc + meta ya estampados al abrir).
    const nuevo = { x_px: 120, y_px: 110 };
    seedPlan('1', { ...trazosDe('1'), origen: nuevo });
    const { migrateAssocLayoutOnLoad } = await import('../assocLayoutMigration');
    // Abrir el piso 1 (host del anillo): el re-anclaje debe recolocar anillo/LD con aFrameDe.
    migrateAssocLayoutOnLoad('1', 'P1');
    expect(trazosDe('1').bajantes?.[0].desplazamientos?.P2).toEqual({
      dx: -30,
      dy: 40,
      Ldesvio: 'LD_BAN1',
    });
    expect(trazosDe('1').ramales?.[0].pts[0]).toEqual([470, 440]);
  });
});
