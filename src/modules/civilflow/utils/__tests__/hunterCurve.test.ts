import { describe, expect, it } from 'vitest';
import { hunterCurva, hunterQ } from '../hunterCurve.ts';

// La ÚNICA copia de la curva de Hunter simplificado (doctrina 2026-11): si la norma cambia,
// se parchea hunterCurve.ts y los 4 módulos (agua/san/bomba/calentador) quedan al día.
// Valores congelados del waterPhysics.test + docs de /docs.

describe('hunterCurve (única fuente de la curva de Hunter simplificado)', () => {
  it('curva cruda: rama baja <240 y rama alta ≥240', () => {
    expect(hunterCurva(60)).toBeCloseTo(1.941148, 5);
    expect(hunterCurva(40)).toBeCloseTo(1.468913, 5);
    expect(hunterCurva(240)).toBeCloseTo(4.522122, 5); // frontera: 240 cae en la rama alta
    expect(hunterCurva(1000)).toBeCloseTo(13.195678, 5);
  });

  it('guards: 0, negativo y NaN → 0', () => {
    expect(hunterCurva(0)).toBe(0);
    expect(hunterCurva(-5)).toBe(0);
  });

  it('hunterQ = curva redondeada a 3 decimales (paridad con las tablas de agua)', () => {
    expect(hunterQ(100)).toBe(2.758);
    expect(hunterQ(240)).toBe(4.522);
    expect(hunterQ(0)).toBe(0);
    for (const n of [1, 2, 60, 120, 239, 241, 500]) {
      expect(hunterQ(n)).toBe(Math.round(hunterCurva(n) * 1000) / 1000);
    }
  });
});
