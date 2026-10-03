import { describe, expect, it } from 'vitest';
import { configurarMoneda, fmt, fmtMoneda } from '../calc';

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

  it('respeta los decimales pedidos', () => {
    configurarMoneda('USD');
    expect(fmtMoneda(5, 0)).toBe('$5');
    expect(fmtMoneda(5.256, 3)).toBe('$5.256');
  });
});
