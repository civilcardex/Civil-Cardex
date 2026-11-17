import { describe, expect, it } from 'vitest';
import { configurarMoneda, fmt, fmtMoneda } from '../calc.ts';

describe('moneda general (símbolo por país escogido)', () => {
  it('fmtMoneda antepone el símbolo de la moneda configurada', () => {
    configurarMoneda('USD');
    expect(fmtMoneda(1234.5)).toBe('$1,234.50');
    configurarMoneda('EUR');
    expect(fmtMoneda(1234.5)).toBe('€1,234.50');
  });

  it('moneda desconocida cae al símbolo genérico $', () => {
    configurarMoneda('XYZ');
    expect(fmtMoneda(100)).toBe('$100.00');
  });

  it('fmt (números de ingeniería) NO lleva símbolo — solo fmtMoneda', () => {
    configurarMoneda('USD');
    expect(fmt(1234.5)).toBe('1,234.50');
  });

  it('monedas del selector de países: PEN S/ y BOB Bs con prefijo compuesto (M-07)', () => {
    configurarMoneda('PEN');
    expect(fmtMoneda(1230)).toBe('S/1,230.00');
    configurarMoneda('BOB');
    expect(fmtMoneda(3300)).toBe('Bs3,300.00');
    configurarMoneda('CLP');
    expect(fmtMoneda(553553)).toBe('$553,553.00');
    configurarMoneda('COP');
    expect(fmtMoneda(100)).toBe('$100.00');
  });

  it('respeta los decimales pedidos', () => {
    configurarMoneda('USD');
    expect(fmtMoneda(5, 0)).toBe('$5');
    expect(fmtMoneda(5.256, 3)).toBe('$5.256');
  });
});
