import { describe, it, expect } from 'vitest';
import {
  compactYeeDiam,
  ramalHasManualCodoAt,
  computeBushingCounts,
  TEES_ACC_MED,
  HYDRO_TEE_IDS,
  ACC_MED_CODOS,
  CODO_90_IDS,
  BUSHING_TOL,
  CODO_MEDIO_90,
} from '../sanFittingsCatalog.ts';

/**
 * Helpers del catálogo de accesorios sanitarios/hidro: dedupe de brazos de yee, detección
 * de codo manual en el extremo que toca al bajante, y conteo de bushings por geometría.
 * Ej: ramal de 2" que llega a un bajante de 4" → 1 bushing "4_2".
 */

describe('catálogo · sets e identidades', () => {
  it('HYDRO_TEE_IDS y CODO_90_IDS son alias (una sola fuente para cada set)', () => {
    expect(HYDRO_TEE_IDS).toBe(TEES_ACC_MED);
    expect(CODO_90_IDS).toBe(ACC_MED_CODOS);
    expect(TEES_ACC_MED.has('teeDirecto')).toBe(true);
    expect(TEES_ACC_MED.has('te_linea')).toBe(true);
    expect(ACC_MED_CODOS.has('codo90rm')).toBe(true);
    expect(ACC_MED_CODOS.has('teeDirecto')).toBe(false);
  });

  it('la columna agrupada de codos usa id y nombre estables', () => {
    expect(CODO_MEDIO_90.id).toBe('codoMedio90');
    expect(CODO_MEDIO_90.nombre).toBe('Codo medio 90°');
    expect(BUSHING_TOL).toBe(0.5);
  });
});

describe('compactYeeDiam · brazos de la yee compactados', () => {
  it('deduplica y quita vacíos/—" ', () => {
    expect(compactYeeDiam(['2"', '2"', '4"'])).toBe('2"×4"');
    expect(compactYeeDiam(['2"', '', '—', '4"'])).toBe('2"×4"');
    expect(compactYeeDiam([' 4" ', '4"'])).toBe('4"');
  });

  it('sin brazos válidos devuelve cadena vacía', () => {
    expect(compactYeeDiam(['', '—'])).toBe('');
  });
});

describe('ramalHasManualCodoAt · codo manual en el punto del bajante', () => {
  const r = (accIni?: string, accFin?: string) => ({
    pts: [
      [0, 0],
      [10, 10],
    ],
    accIni,
    accFin,
  });

  it('codo 90 o 45 en el extremo que coincide con el bajante → true', () => {
    expect(ramalHasManualCodoAt(r('codo90rm'), 0, 0)).toBe(true);
    expect(ramalHasManualCodoAt(r(undefined, 'codo45rc'), 10, 10)).toBe(true);
  });

  it('otro accesorio (tee, válvula) NO cubre el codo del bajante', () => {
    expect(ramalHasManualCodoAt(r('teeDirecto'), 0, 0)).toBe(false);
    expect(ramalHasManualCodoAt(r('valvCompuerta'), 0, 0)).toBe(false);
  });

  it('codo presente pero en el OTRO extremo → false', () => {
    expect(ramalHasManualCodoAt(r('codo90rm'), 10, 10)).toBe(false);
    expect(ramalHasManualCodoAt(r(undefined, 'codo90rm'), 0, 0)).toBe(false);
  });

  it('datos insuficientes (sin pts o sin punto de bajante) → false', () => {
    expect(ramalHasManualCodoAt({ accIni: 'codo90rm' }, 0, 0)).toBe(false);
    expect(ramalHasManualCodoAt(r('codo90rm'), undefined, undefined)).toBe(false);
    expect(ramalHasManualCodoAt({ pts: [[0, 0]], accIni: 'codo90rm' }, 0, 0)).toBe(false);
  });
});

describe('computeBushingCounts · bushings por geometría', () => {
  const minor = (over: Record<string, unknown> = {}) =>
    ({
      id: 'm1',
      diametro: '2"',
      pts: [
        [0, 0],
        [10, 0],
      ],
      ...over,
    }) as {
      id: string;
      diametro: string;
      pts: number[][];
    };
  const bajante = (over: Record<string, unknown> = {}) =>
    ({ id: 'b1', diametro: '4"', x: 0, y: 0, ...over }) as {
      id: string;
      diametro: string;
      x: number;
      y: number;
    };

  it('ramal menor que toca al bajante mayor en un extremo → 1 bushing', () => {
    expect(computeBushingCounts([minor()], [], [bajante()])).toEqual({ '4_2': 1 });
  });

  it('cada extremo conectado cuenta: dos bajantes distintos → 2 bushings', () => {
    const b2 = bajante({ id: 'b2', x: 10, y: 0 });
    expect(computeBushingCounts([minor()], [], [bajante(), b2])).toEqual({ '4_2': 2 });
  });

  it('bajante del MISMO diámetro o menor no genera bushing: se revisa contra ramales mayores', () => {
    const misma = bajante({ diametro: '2"' });
    const major = {
      id: 'M1',
      diametro: '3"',
      pts: [
        [10, 0],
        [20, 0],
      ],
    };
    // extremo (0,0) pega a bajante de 2" (sin bushing) y (10,0) cae sobre el ramal de 3"
    expect(computeBushingCounts([minor()], [major], [misma])).toEqual({ '3_2': 1 });
  });

  it('extremo en la unión de DOS ramales mayores: un bushing por cada mayor que toca el punto', () => {
    const minorTee = minor({
      diametro: '4"',
      pts: [
        [10, 0],
        [10, -10],
      ],
    });
    const m1 = {
      id: 'M1',
      diametro: '6"',
      pts: [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    };
    const m2 = {
      id: 'M2',
      diametro: '6"',
      pts: [
        [10, 0],
        [10, 10],
      ],
    };
    expect(computeBushingCounts([minorTee], [m1, m2], [])).toEqual({ '6_4': 2 });
  });

  it('sin conexiones ni diferencias de diámetro no hay bushings', () => {
    expect(
      computeBushingCounts(
        [
          minor({
            pts: [
              [100, 100],
              [110, 100],
            ],
          }),
        ],
        [],
        [],
      ),
    ).toEqual({});
    expect(computeBushingCounts([minor({ diametro: '4"' })], [], [bajante()])).toEqual({});
    expect(computeBushingCounts([minor({ diametro: 'x"' })], [], [bajante()])).toEqual({});
  });
});
