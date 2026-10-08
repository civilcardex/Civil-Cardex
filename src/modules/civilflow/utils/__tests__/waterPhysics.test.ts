import { describe, expect, it } from 'vitest';
import { hunterK, hunterQ, computeDesignRow } from '../../components/waterNetworkDesign/rowPhysics';
import type { Tramo } from '../../context/tramosReducer';

// Spec: curva de Hunter (NTC 1500) y física de fila de la tabla de diseño AF/AC.

describe('hunterK — coeficiente según número de descargas', () => {
  it('1 descarga → 1', () => expect(hunterK(1)).toBe(1));
  it('5 descargas → 1/√4 = 0.5', () => expect(hunterK(5)).toBe(0.5));
  it('0 descargas → 0', () => expect(hunterK(0)).toBe(0));
});

describe('hunterQ — caudal probable Hunter (L/s)', () => {
  it('rama < 240 UC: 100 UC con 5 descargas → 1.379 L/s', () => {
    expect(hunterQ(100, 5)).toBe(1.379); // 0.5·0.1163·100^0.6875
  });

  it('cambio de fórmula a 240 UC: 240 UC con 2 descargas → 4.522 L/s', () => {
    expect(hunterQ(240, 2)).toBe(4.522); // 1·0.074·240^0.7504
  });

  it('sin UC → 0', () => expect(hunterQ(0, 5)).toBe(0));
});

describe('computeDesignRow — velocidad y pérdida de la fila', () => {
  const opts = [{ pulg: 0.75, nominal: '3/4"', dInt: 21 }];
  const params = {
    qprob: 0.346,
    diamOpts: opts,
    diamNomMap: {},
    diamIntMap: {},
    lookupFn: () => 0,
  };
  const t = {
    id: 't1',
    totalL: 10,
    diamDisPulg: 0.75,
    material: 'PVC-PR',
    accesorios: {},
  } as unknown as Tramo;

  it('V ≈ 1000 mm/s con 0.346 L/s en 21 mm', () => {
    const r = computeDesignRow(t, params);
    expect(r.Vmms).toBeGreaterThan(990);
    expect(r.Vmms).toBeLessThan(1010);
  });

  it('hfM en METROS (hfPct es m/km): 3/4" @1 m/s, 10 m → ≈0.58 m', () => {
    const r = computeDesignRow(t, params);
    expect(r.hfPct).toBeGreaterThan(55);
    expect(r.hfPct).toBeLessThan(60);
    expect(r.hfM).toBeGreaterThan(0.5);
    expect(r.hfM).toBeLessThan(0.65);
  });

  it('Lt = horizontal + vertical (+ Le de accesorios, vacíos aquí)', () => {
    const r = computeDesignRow({ ...t, Lv: 3 } as Tramo, params);
    expect(r.Lt).toBe(13);
  });
});
