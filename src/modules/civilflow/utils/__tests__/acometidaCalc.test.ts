import { describe, expect, it } from 'vitest';
import { calcFila } from '../../components/waterNetworkDesign/acometidaCalc';

// Spec: la pérdida de la acometida usa la MISMA escala m/km que la red (÷1000 en
// rowPhysics). hfPct = 60.1·V^1.852/(C^1.852·d^1.167) es m/km — verificado contra
// Hazen-Williams SI (hf = 10.67·L·Q^1.852/(C^1.852·D^4.87)).

const DIAMS = [{ pulg: 0.75, nominal: '3/4"', dInt: 21 }];

describe('calcFila — física de la acometida', () => {
  it('velocidad: V = 1e6·Q/(π/4·d²) en mm/s', () => {
    const Q = ((Math.PI / 4) * 21 * 21 * 1000) / 1e6; // L/s para V ≈ 1000 mm/s
    const r = calcFila('3/4"', 10, 0, 0, 20, 150, DIAMS, Q);
    expect(r.V).toBeGreaterThan(990);
    expect(r.V).toBeLessThan(1010);
  });

  it('hfM en metros con escala m/km: 3/4" @1 m/s, 10 m → ≈0.58 m (Hazen-Williams SI ±10 %)', () => {
    const Q = ((Math.PI / 4) * 21 * 21 * 1000) / 1e6;
    const r = calcFila('3/4"', 10, 0, 0, 20, 150, DIAMS, Q);
    const qm3 = Q / 1000;
    const hw = (10.67 * 10 * Math.pow(qm3, 1.852)) / (Math.pow(150, 1.852) * Math.pow(0.021, 4.87));
    expect(r.hfM).toBeGreaterThan(hw * 0.9);
    expect(r.hfM).toBeLessThan(hw * 1.1);
  });

  it('Pfin = Pin − elevación − hf', () => {
    const Q = ((Math.PI / 4) * 21 * 21 * 1000) / 1e6;
    const r = calcFila('3/4"', 10, 2, 0, 20, 150, DIAMS, Q);
    expect(r.Pfin).toBeLessThan(18);
    expect(r.Pfin).toBeGreaterThan(17);
  });

  it('diámetro desconocido → dInt 0 y V 0 (sin división por cero)', () => {
    const r = calcFila('5"', 10, 0, 0, 20, 150, DIAMS, 1);
    expect(r.dInt).toBe(0);
    expect(r.V).toBe(0);
    expect(r.hfM).toBe(0);
  });
});
