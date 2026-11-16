import { describe, it, expect } from 'vitest';
import {
  caudalHunterLPS,
  caudalTuboLleno,
  velocidadTuboLleno,
  diametroManning,
} from '../calcSanitaryCore.ts';

// Hunter simplificado (decisión producto 2026-11-16): curva pura f(UD), sin K de simultaneidad.

describe('caudalHunterLPS', () => {
  it('UD=10 usa rama UD < 240', () => {
    const result = caudalHunterLPS(10);
    const expected = 0.1163 * Math.pow(10, 0.6875);
    expect(result).toBeCloseTo(expected, 6);
  });

  it('UD=240 usa rama UD >= 240', () => {
    const result = caudalHunterLPS(240);
    const expected = 0.074 * Math.pow(240, 0.7504);
    expect(result).toBeCloseTo(expected, 6);
  });

  it('UD=1000 usa rama UD >= 240', () => {
    const result = caudalHunterLPS(1000);
    const expected = 0.074 * Math.pow(1000, 0.7504);
    expect(result).toBeCloseTo(expected, 6);
  });

  it('UD<=0 retorna 0', () => {
    expect(caudalHunterLPS(0)).toBe(0);
  });
});

describe('Manning functions', () => {
  it('caudalTuboLleno computes correctly', () => {
    const Q = caudalTuboLleno(0.1, 0.009, 0.02);
    expect(Q).toBeGreaterThan(0);
  });

  it('caudalTuboLleno returns 0 for D_m <= 0', () => {
    expect(caudalTuboLleno(0, 0.009, 0.02)).toBe(0);
  });

  it('caudalTuboLleno returns 0 for S <= 0', () => {
    expect(caudalTuboLleno(0.1, 0.009, 0)).toBe(0);
  });

  it('velocidadTuboLleno computes correctly', () => {
    const V = velocidadTuboLleno(0.1, 0.009, 0.02);
    expect(V).toBeGreaterThan(0);
  });

  it('velocidadTuboLleno returns 0 for D_m <= 0', () => {
    expect(velocidadTuboLleno(0, 0.009, 0.02)).toBe(0);
  });

  it('diametroManning returns a positive value for valid inputs', () => {
    const D = diametroManning(0.005, 0.009, 0.02);
    expect(D).toBeGreaterThan(0);
  });

  it('diametroManning returns 0 for S <= 0', () => {
    expect(diametroManning(0.005, 0.009, 0)).toBe(0);
  });
});
