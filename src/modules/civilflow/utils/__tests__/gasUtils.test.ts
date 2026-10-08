import { describe, expect, it } from 'vitest';
import { renouardByType, factoresGas, qDisenoGas } from '../gasUtils';

// Spec: criterio de simultaneidad y factores del Excel "Calculo red de Gas KML 2025"
// (hoja "Red de Gas": AA = criterio Renouard de tipos, AB/AC/AD factores redondeados
// a 2 decimales, AE = Q de diseño con piso 2.7 m³/h).

describe('renouardByType — criterio de los dos tipos mayores (Excel celda AA)', () => {
  it('1 solo tipo: la mitad de su consumo total', () => {
    expect(renouardByType({ est4: 2 })).toBeCloseTo(1.35, 2); // 2·1.35/2
  });

  it('2 tipos: promedio de los dos totales', () => {
    expect(renouardByType({ est4: 1, sauna: 1 })).toBeCloseTo(1.215, 3); // (1.35+1.08)/2
  });

  it('3+ tipos: los dos mayores al 50 % + el resto al 100 % (fila del Excel: 5.81)', () => {
    // pisc 6.08 + jac 3.38 + sauna 1.08 → (6.08+3.38)/2 + 1.08 = 5.81
    expect(renouardByType({ pisc: 1, jac: 1, sauna: 1 })).toBeCloseTo(5.81, 2);
  });

  it('el resto solo cuenta tipos ESTRICTAMENTE menores que el segundo mayor', () => {
    // empate en el 2° mayor: est4 (1.35) NO es < 1.35 → no suma: (6.08+1.35)/2 = 3.715
    expect(renouardByType({ pisc: 1, turco: 1, est4: 1 })).toBeCloseTo(3.715, 3);
  });

  it('sin aparatos → 0', () => {
    expect(renouardByType({})).toBe(0);
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
