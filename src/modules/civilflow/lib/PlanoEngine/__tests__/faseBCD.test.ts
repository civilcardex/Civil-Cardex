import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { direccionBajaPermitida, direccionSegura } from '../direccionReglas';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { writeSanDrawingSync } from '../../../utils/drawingSync';
import type { IPlanoEngineCore } from '../PlanoState';

// Fase B/C/D del prompt de depuración: (9) 'baja' prohibida en el último nivel; (5+13) copia
// excluye LD_, recalcula totalL y copia cotas con la escala destino; (10) GC↔reanclar ya no
// hacen ping-pong sobre la clave stub del calentador (mismo mapeo fixtureStoreKey).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
});

function makeEngine(
  nptLevels: Array<{ npt?: number; n?: number; label?: string }>,
  loadedPlanId: string,
): IPlanoEngineCore {
  return {
    _loadedPlanId: loadedPlanId,
    nptLevels,
    nivelActual: nptLevels[nptLevels.length - 1] || null,
    ramales: [],
    bajantes: [],
    dims: [],
    crossFloorGhosts: [],
    scaleM: 1.0, // escala destino DIFERENTE de la del origen (0.5) para probar el recálculo
    _netCounts: {},
    updateElementById: () => {},
    render: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    saveWork: () => ({ ramales: [], bajantes: [], dims: [] }),
  } as unknown as IPlanoEngineCore;
}

describe('punto 9 — dirección baja en el último nivel inferior', () => {
  // Convención NPT = ELEVACIÓN: el sótano (último nivel inferior, visto de arriba hacia abajo)
  // es el de MENOR npt.
  const niveles = [
    { label: 'P2', n: 2, npt: 6400 },
    { label: 'P1', n: 1, npt: 3200 },
    { label: 'S1', n: -1, npt: 1600 },
  ];

  it('S1 (menor npt = último nivel inferior) NO permite baja; P1/P2 sí', () => {
    expect(direccionBajaPermitida({ nptLevels: niveles }, { nptBase: 1600 })).toBe(false);
    expect(direccionBajaPermitida({ nptLevels: niveles }, { nptBase: 3200 })).toBe(true);
    expect(direccionBajaPermitida({ nptLevels: niveles }, { nptBase: 6400 })).toBe(true);
  });

  it('direccionSegura coerces baja→continua en el último nivel y deja el resto igual', () => {
    expect(direccionSegura({ nptLevels: niveles }, { nptBase: 1600 }, 'baja')).toBe('continua');
    expect(direccionSegura({ nptLevels: niveles }, { nptBase: 3200 }, 'baja')).toBe('baja');
    expect(direccionSegura({ nptLevels: niveles }, { nptBase: 1600 }, 'sube')).toBe('sube');
  });

  it('sin niveles conocidos no bloquea (comportamiento previo)', () => {
    expect(direccionBajaPermitida({ nptLevels: [] }, { nptBase: 9600 })).toBe(true);
  });
});

describe('puntos 5+13 — copia entre pisos', () => {
  beforeEach(() => localStorage.clear());

  it('LD_ NO se copia; totalL recalculado con escala destino; las COTAS no se copian', () => {
    // Origen: escala 0.5 — ramal 192px → totalL 1.0m; LD_ + cota junto al ramal.
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [192, 0],
            ],
            totalL: 2.54, // escala origen 0.5: (192/96)*2.54*0.5
            diametro: '1"',
          },
          {
            id: 'LD_BAN9',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [96, 0],
            ],
            totalL: 0.5,
          },
        ],
        bajantes: [],
        dims: [
          {
            id: 'D1',
            x1: 0,
            y1: 0,
            x2: 192,
            y2: 0,
            L: 2.54, // congela la escala origen 0.5
          },
        ],
      }),
    );

    const eng = makeEngine([{ npt: 3200, n: 1, label: 'P1' }], '2');
    const res = copyDrawingFromPlan(eng as never, '2', '1', [
      { netId: 'af', tipos: new Set(['ramal']) },
    ]);

    // Copió SOLO RS1 (LD_ excluido — punto 5).
    expect(eng.ramales).toHaveLength(1);
    expect(eng.ramales[0].id).not.toContain('LD_');
    // PUNTO 13 + normalización de calibración (orig. 0.5 → destino 1.0): las coordenadas se
    // escalan ×0.5 y el totalL medido con la escala destino conserva LOS METROS DEL ORIGEN
    // (2.54m) — la copia aterriza a la misma distancia real de las referencias.
    expect(eng.ramales[0].totalL).toBe(2.54);
    // Las COTAS del origen NO viajan con la copia (se acotan manualmente en el destino).
    expect(eng.dims).toHaveLength(0);
    expect(res.copied).toBeGreaterThan(0);
  });
});

describe('punto 10 — GC y reanclar ya no hacen ping-pong (clave stub calentador)', () => {
  beforeEach(() => localStorage.clear());

  it('dos syncs seguidos: la clave ac_<calId>_<plan> sobrevive (sin borrado en la 2ª pasada)', () => {
    // Trazos con stub de calentador AC-01-CALENT1 (net ac) + su bajante calentador.
    // El stub restaura la clave `ac_CALENT1_2` vía fixtureStoreKey — y con el fix el GC la
    // considera válida (antes armaba `ac_AC-01-CALENT1_2` y la borraba en cada sync).
    localStorage.setItem(
      'civilflow_trazos_2',
      JSON.stringify({
        ramales: [
          {
            id: 'AC-01-CALENT1',
            net: 'ac',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [10, 0],
            ],
          },
        ],
        bajantes: [{ id: 'CALENT1', net: 'ac', tipo: 'calentador', x: 0, y: 0 }],
      }),
    );
    localStorage.setItem('civilflow_aparatos_by_tramo_v2', {
      toString: () => '',
    } as unknown as string);
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ ac_CALENT1_2: { agua: 1 } }),
    );

    const plans = [{ id: '2', status: 'confirmed' }] as never;
    writeSanDrawingSync(plans);
    expect(
      JSON.parse(localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}')['ac_CALENT1_2'],
    ).toEqual({ agua: 1 });

    // Segunda pasada: la clave SIGUE (sin ping-pong borrado/restauración).
    writeSanDrawingSync(plans);
    expect(
      JSON.parse(localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}')['ac_CALENT1_2'],
    ).toEqual({ agua: 1 });
  });
});
