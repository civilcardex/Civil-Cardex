import { describe, it, expect } from 'vitest';
import { calcHydraulicCheck } from '../hydraulicCheck.ts';
import { NORMAS_PAIS } from '../../constants/countryStandards.ts';

const CO = NORMAS_PAIS.find((p) => p.id === 'CO')!;

// Tramo san 3" PVC (Dint 78 mm), Q 1.5 L/s, n 0.009 — pendiente 0.8% (bajo el mínimo 1.0% de
// NTC 1500 §8.3) vs 1.2% (sobre). El chequeo de pendiente mínima es por país (sanPendMin).

const base = { Q: 1.5, S: 0.008, n: 0.009, DintMm: 78 };

describe('calcHydraulicCheck — pendiente mínima por diámetro (sanPendMin)', () => {
  it('3" con 0.8% → NO CUMPLE (pendiente mínima 1%)', () => {
    const r = calcHydraulicCheck({ ...base, pendMin: CO.sanPendMin });
    expect(r.pendMinima).toBe(1.0);
    expect(r.chequeoS).toContain('NO CUMPLE');
    expect(r.chequeoS).toContain('1');
  });

  it('3" con 1.2% → O.K.', () => {
    const r = calcHydraulicCheck({ ...base, S: 0.012, pendMin: CO.sanPendMin });
    expect(r.pendMinima).toBe(1.0);
    expect(r.chequeoS).toBe('O.K.');
  });

  it('sin pendMin → chequeo no aplica (pendMinima null)', () => {
    const r = calcHydraulicCheck(base);
    expect(r.pendMinima).toBeNull();
    expect(r.chequeoS).toBe('O.K.');
  });

  it('diámetro grande usa el último escalón: 8" (203mm) con 0.2% → NO CUMPLE (mín 0.3%)', () => {
    const r = calcHydraulicCheck({
      Q: 5,
      S: 0.002,
      n: 0.009,
      DintMm: 203,
      pendMin: CO.sanPendMin,
    });
    expect(r.pendMinima).toBe(0.3);
    expect(r.chequeoS).toContain('NO CUMPLE');
  });
});

describe('calcHydraulicCheck — fuerza tractiva en dos niveles (3" PVC, Q 1.5 L/s)', () => {
  const baseFT = { Q: 1.5, n: 0.009, DintMm: 78, lim: CO.san, pendMin: CO.sanPendMin };

  // τ real por S (probe): 0.002→0.05 · 0.006→0.13 · 0.008→0.16

  it('τ 0.13 (S 0.6%): entre ftMin 0.10 y ftRec 0.15 → RECOMENDADO', () => {
    const r = calcHydraulicCheck({ ...baseFT, S: 0.006 });
    expect(r.fuerzaTractiva).toBe(0.13);
    expect(r.nivelFT).toBe('RECOMENDADO');
    expect(r.chequeoFT).toBe('RECOMENDADO');
  });

  it('τ 0.05 (S 0.2%): bajo ftMin 0.10 → NO CUMPLE', () => {
    const r = calcHydraulicCheck({ ...baseFT, S: 0.002 });
    expect(r.fuerzaTractiva).toBe(0.05);
    expect(r.nivelFT).toBe('NO CUMPLE');
    expect(r.chequeoFT).toBe('NO CUMPLE');
  });

  it('τ 0.16 (S 0.8%): sobre ftRec 0.15 → O.K.', () => {
    const r = calcHydraulicCheck({ ...baseFT, S: 0.008 });
    expect(r.fuerzaTractiva).toBe(0.16);
    expect(r.nivelFT).toBe('O.K.');
    expect(r.chequeoFT).toBe('O.K.');
  });
});
