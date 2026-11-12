import { describe, it, expect, beforeEach } from 'vitest';
import { asociarCanalesPorOBB, derivarCanalesLlAuto } from '../rainwaterDerived.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import type { BajanteLL, CanalLL } from '../rainwaterTypes.ts';
import type { RawElement } from '../../utils/drawingSync.ts';

/**
 * Caracterización de la derivación pesada de lluvias (ll (Lluvias)) extraída de
 * RainwaterContext: congela la asociación canal↔bajante por OBB (bounding box orientado)
 * y el armado de las filas auto de canal ANTES de confiar en el split. Los valores son los
 * que hoy produce el motor — si cambian, alguien tocó la lógica y hay que decidirlo.
 */

/** Guarda el doc crudo de trazos de un plano donde loadFromStorage lo lee (misma clave civilflow_trazos_<planId>). */
const guardarDoc = (planId: number, doc: unknown): void => {
  localStorage.setItem(`civilflow_${TRAZOS_PREFIX}${planId}`, JSON.stringify(doc));
};

const bajante = (baj: string, extras: Partial<BajanteLL> = {}): BajanteLL => ({
  id: `BLL-${baj}`,
  bajante: baj,
  areaParcial: 0,
  areaOtras: 0,
  areaAcumulada: 0,
  intensidad: 100,
  coeficienteC: 0,
  R: '',
  manning: 0,
  diamPropuesto: 0,
  ...extras,
});

const canalManual = (id: string, sector: string, extras: Partial<CanalLL> = {}): CanalLL => ({
  id,
  sector,
  areaParcial: 0,
  areaOtras: 0,
  areaAcumulada: 0,
  intensidad: 100,
  coeficienteC: 0,
  manning: 0.009,
  pendiente: 2,
  b: 0,
  h: 0,
  ...extras,
});

const glifoCanal = (extras: Partial<RawElement>): RawElement => ({
  id: 'C1',
  tipo: 'canal',
  net: 'll',
  ...extras,
});

beforeEach(() => {
  localStorage.clear();
});

describe('asociarCanalesPorOBB', () => {
  it('asocia bajantes por OBB (directo + ramal manual esCanalId) y suma sus áreas', () => {
    guardarDoc(1, {
      scaleM: 0.5,
      areas: [{ areaM2: 30 }, { areaM2: 70 }],
      // Canal horizontal en (100,100): 100 cm de largo x 20 cm de ancho (sin ángulo).
      bajantes: [
        { id: 'C1', tipo: 'canal', net: 'll', x: 100, y: 100, longitud: 100, base: 20 },
        // BALL1 cae DENTRO del OBB del canal (sin ramal) → alimentador directo.
        { id: 'B1', tipo: 'bajante', net: 'll', x: 120, y: 105, area_m2: 120, code: 'BALL1' },
        // BALL2 lejos del canal → llega solo por el ramal asociado a mano (esCanalId).
        { id: 'B2', tipo: 'bajante', net: 'll', x: 400, y: 400, area_m2: 50, code: 'BALL2' },
      ],
      ramales: [
        // Un extremo dentro del canal (130,110), el otro a 0 px del glifo de BALL2.
        {
          id: 'R1',
          net: 'll',
          esCanalId: 'C1',
          pts: [
            [130, 110],
            [400, 400],
          ],
        },
      ],
    });

    const out = asociarCanalesPorOBB([{ id: 1, nivel: 1 }]);

    expect(out.areaAcumMap).toEqual({ '1': 100 });
    expect(out.drawnCanalGlyphs).toHaveLength(1);
    expect(out.drawnCanalGlyphs[0].id).toBe('C1');
    expect(out.drawnCanalGlyphs[0].piso).toBe('1');
    expect(out.drawnCanalGlyphs[0].planId).toBe(1);
    // Chips ordenados, con piso corto: BALL1-P1 y BALL2-P1.
    expect(out.canalBajantes['C1']).toEqual(['BALL1-P1', 'BALL2-P1']);
    // Alimentadores en orden de inserción (manual BALL2 primero, geométrico BALL1 después).
    expect(out.canalAlimIds['C1']).toEqual(['1|B2', '1|B1']);
    // Insumo ordenado por código, SIN piso (es la clave del override en bajantesLl).
    expect(out.canalAlimInfo['C1']).toEqual([
      { code: 'BALL1', areaDib: 120 },
      { code: 'BALL2', areaDib: 50 },
    ]);
    // Área del canal = Σ una sola vez por bajante alimentador (120 + 50).
    expect(out.canalAreaMap['C1']).toBe(170);
  });

  it('ignora plan sin nivel y plano sin doc de trazos', () => {
    const out = asociarCanalesPorOBB([
      { id: 2, nivel: null },
      { id: 3, nivel: 2 },
    ]);
    expect(out).toEqual({
      areaAcumMap: {},
      drawnCanalGlyphs: [],
      canalAreaMap: {},
      canalBajantes: {},
      canalAlimIds: {},
      canalAlimInfo: {},
    });
  });
});

describe('derivarCanalesLlAuto', () => {
  it('con asociados: Parcial/Otras/Material salen de los overrides de los BAJANTES', () => {
    const glyphs = [
      {
        ...glifoCanal({
          id: 'C1',
          code: 'CNL1',
          base: 30,
          altura: 20,
          longitud: 300,
          pendiente: 2,
        }),
        piso: '1',
        planId: 1,
      },
    ];
    const canalesManuales = [
      // Override manual del sector CNL1: solo manda intensidad/bordeLibre (el área viene
      // de los asociados — canalAreaMap se IGNORA cuando hay asociados).
      canalManual('CLL-1', 'CNL1', { intensidad: 90, bordeLibreCm: 12 }),
      // Fila puramente manual (sin glifo): pasa al final tal cual.
      canalManual('CLL-2', 'MAN1'),
    ];
    const bajantes = [
      // areaParcial manual 118 NO gana: el área dibujada (120) manda en areaParcialBajanteLl.
      bajante('BALL1', { areaParcial: 118, areaOtras: 5, materialCubierta: 'Concreto' }),
      bajante('BALL2', { materialCubierta: 'Concreto' }),
    ];
    const out = derivarCanalesLlAuto(
      glyphs,
      canalesManuales,
      bajantes,
      { '1': 500 },
      { C1: 210 },
      {
        C1: [
          { code: 'BALL1', areaDib: 120 },
          { code: 'BALL2', areaDib: 80 },
        ],
      },
    );

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'cg_C1',
      sector: 'CNL1',
      areaParcial: 200, // Σ areaDib de los asociados (120 + 80)
      areaOtras: 5, // Σ areaOtras de los asociados
      areaAcumulada: 205,
      intensidad: 90, // override manual del canal
      coeficienteC: 0,
      manning: 0.009,
      materialCubierta: 'Concreto', // común a TODOS los asociados
      materialCanal: undefined,
      muroVertical: undefined,
      bordeLibreCm: 12,
      pendiente: 2, // la del glifo manda
      b: 30,
      h: 20,
      longitud: 300,
      piso: 1,
      fromCanal: true,
      drawId: 'C1',
      drawPlanId: 1,
    });
    // La fila manual sin glifo se agrega intacta.
    expect(out[1]).toEqual(canalesManuales[1]);
  });

  it('sin asociados: cae a los fallbacks (override manual → área dibujada → total del piso)', () => {
    const glyphs = [
      {
        // Legacy sin pendiente/base/altura: defaults 2 y 0.
        ...glifoCanal({ id: 'C2', code: 'CNL2-P3' }),
        piso: '1',
        planId: 1,
      },
    ];
    const out = derivarCanalesLlAuto(glyphs, [], [], { '1': 500 }, {}, {});

    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 'cg_C2',
      sector: 'CNL2', // solo el nombre base de "CNL2-P3"
      areaParcial: 500, // sin manual ni bajantes → total dibujado del piso
      areaOtras: 0,
      areaAcumulada: 500,
      intensidad: 100,
      coeficienteC: 0,
      manning: 0.009,
      materialCubierta: undefined,
      materialCanal: undefined,
      muroVertical: undefined,
      bordeLibreCm: undefined,
      pendiente: 2, // default legacy
      b: 0,
      h: 0,
      longitud: 0,
      piso: 1,
      fromCanal: true,
      drawId: 'C2',
      drawPlanId: 1,
    });
  });
});
