import { describe, expect, it } from 'vitest';
import {
  DESCUENTO_BASE,
  DESCUENTO_POR_MODULO,
  calcularTotalCentavos,
  descuentoAplicado,
  formatUSD,
} from '../catalog';

describe('calcularTotalCentavos (USD)', () => {
  it('un módulo mensual = $25.00 (sin descuento base)', () => {
    expect(calcularTotalCentavos(['flow'], 'mensual')).toBe(2500);
  });

  it('un módulo semestral = base 10% → $135.00', () => {
    expect(calcularTotalCentavos(['manage'], 'semestral')).toBe(13500); // 15000 × 0.90
  });

  it('un módulo anual = base 15% → $255.00', () => {
    expect(calcularTotalCentavos(['manage'], 'anual')).toBe(25500); // 30000 × 0.85
  });

  it('deduplica módulos repetidos', () => {
    expect(calcularTotalCentavos(['flow', 'flow'], 'mensual')).toBe(2500);
  });

  it('dos módulos mensual: +10% adicional Y volumen 2 puestos −10% → $40.50', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(4050); // 5000 × 0.90 × 0.90
  });

  it('dos módulos semestral: 0.80 acumulativo × 0.90 volumen → $216.00', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'semestral')).toBe(21600); // 30000 × 0.80 × 0.90
  });

  it('dos módulos anual: 0.75 acumulativo × 0.90 volumen → $405.00', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'anual')).toBe(40500); // 60000 × 0.75 × 0.90
  });

  it('descuentoAplicado acumula', () => {
    expect(descuentoAplicado([], 'mensual')).toBe(0);
    expect(descuentoAplicado(['flow'], 'mensual')).toBe(0);
    expect(descuentoAplicado(['flow'], 'semestral')).toBe(DESCUENTO_BASE.semestral);
    expect(descuentoAplicado(['flow', 'manage'], 'anual')).toBeCloseTo(
      0.15 + DESCUENTO_POR_MODULO,
      6,
    );
    // Catálogo actual = 2 módulos → máximo alcanzable 25% (el clamp 100% es red de seguridad).
    expect(descuentoAplicado(['flow', 'manage'], 'anual')).toBeLessThanOrEqual(1);
  });

  it('formatUSD muestra dólares con decimales', () => {
    expect(formatUSD(2500)).toBe('$25.00');
    expect(formatUSD(13500)).toBe('$135.00');
  });
});
