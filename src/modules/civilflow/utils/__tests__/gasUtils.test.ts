import { describe, expect, it } from 'vitest';
import { fsGas, renouardByType, factoresGas, qDisenoGas, patmDeAltitud } from '../gasUtils.ts';

// Spec: criterio de simultaneidad y factores del Excel "Calculo red de Gas KML 2025"
// (hoja "Red de Gas": AA = criterio Renouard de tipos, AB/AC/AD factores redondeados
// a 2 decimales, AE = Q de diseño con piso 2.7 m³/h).

describe('renouardByType — fs tabulada NTC 3728 §5.3 por N° de aparatos', () => {
  it('2 aparatos del mismo tipo: fs=1.0 → 2·1.35 = 2.7 m³/h', () => {
    expect(renouardByType({ est4: 2 })).toBeCloseTo(2.7, 2);
  });

  it('2 tipos (2 aparatos): fs=1.0 → 1.35 + 1.08 = 2.43', () => {
    expect(renouardByType({ est4: 1, sauna: 1 })).toBeCloseTo(2.43, 2);
  });

  it('3 aparatos (3 tipos): fs=0.8 → (6.08+3.38+1.08)·0.8 = 8.43', () => {
    expect(renouardByType({ pisc: 1, jac: 1, sauna: 1 })).toBeCloseTo(8.43, 2);
  });

  it('GLP: usa qglp del CAT_GAS — cal11 GN 1.88 → GLP 0.75', () => {
    expect(renouardByType({ cal11: 1 }, 'gn')).toBeCloseTo(1.88, 2);
    expect(renouardByType({ cal11: 1 }, 'glp')).toBeCloseTo(0.75, 2);
  });

  it('sin aparatos → 0', () => {
    expect(renouardByType({})).toBe(0);
  });
});

describe('fsGas — tabla por N° total de aparatos (NTC 3728 §5.3)', () => {
  it('1–2 → 1.0', () => {
    expect(fsGas(1)).toBe(1.0);
    expect(fsGas(2)).toBe(1.0);
  });
  it('3–5 → 0.8 · 6–10 → 0.7 · 11–20 → 0.6 · >20 → 0.5', () => {
    expect(fsGas(3)).toBe(0.8);
    expect(fsGas(5)).toBe(0.8);
    expect(fsGas(6)).toBe(0.7);
    expect(fsGas(10)).toBe(0.7);
    expect(fsGas(11)).toBe(0.6);
    expect(fsGas(20)).toBe(0.6);
    expect(fsGas(21)).toBe(0.5);
  });
});

describe('factoresGas — redondeo a 2 decimales como el Excel (AB/AC/AD)', () => {
  const f = factoresGas({ patm: '90.32', temp: '23', densRel: '0.67' });

  it('f_alt = 101.325/90.32 → 1.12', () => expect(f.fAlt).toBe(1.12));
  it('f_temp = √(288/296) → 0.99', () => expect(f.fTemp).toBe(0.99));
  it('f_dens = √(0.67/0.67) → 1.00', () => expect(f.fDens).toBe(1));
  it('expone pAtm y DR numéricos para el resto de fórmulas', () => {
    expect(f.pAtm).toBeCloseTo(90.32, 2);
    expect(f.DR).toBeCloseTo(0.67, 2);
  });
});

describe('qDisenoGas — celda AE del Excel (producto redondeado + piso 2.7)', () => {
  const f = factoresGas({ patm: '90.32', temp: '23', densRel: '0.67' });

  it('fila 2 del Excel: 5.81·1.12·0.99·1.00 → 6.44', () => {
    expect(qDisenoGas(5.81, f)).toBe(6.44);
  });

  it('consumo bajo → piso de 2.7 m³/h (fila 1 del Excel: 2.70)', () => {
    expect(qDisenoGas(1.215, f)).toBe(2.7);
  });
});

describe('patmDeAltitud — la presión atmosférica sale de la altura (Excel F11)', () => {
  it('a nivel del mar es 101.33 kPa (el valor de referencia)', () => {
    expect(patmDeAltitud(0)).toBe('101.33');
  });

  it('más altura → menos presión (el aire pesa menos arriba)', () => {
    const baja = Number(patmDeAltitud(0));
    const alta = Number(patmDeAltitud(2640));
    expect(alta).toBeLessThan(baja);
  });

  it('texto vacío o inválido → nivel del mar (no NaN)', () => {
    expect(patmDeAltitud('')).toBe('101.33');
    expect(patmDeAltitud('abc')).toBe('101.33');
  });
});
