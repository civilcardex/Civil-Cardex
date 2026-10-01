import { describe, expect, it } from 'vitest';
import {
  DESCUENTO_BASE,
  DESCUENTO_POR_MODULO,
  calcularTotalCentavos,
  descuentoAplicado,
  formatCOP,
} from '../catalogo';

describe('calcularTotalCentavos', () => {
  it('un módulo mensual = precio mensual (sin descuento base)', () => {
    expect(calcularTotalCentavos(['flow'], 'mensual')).toBe(6_000_000);
  });

  it('un módulo semestral = base 10%', () => {
    expect(calcularTotalCentavos(['manage'], 'semestral')).toBe(32_400_000); // 36M × 0.90
  });

  it('un módulo anual = base 15%', () => {
    expect(calcularTotalCentavos(['manage'], 'anual')).toBe(61_200_000); // 72M × 0.85
  });

  it('deduplica módulos repetidos', () => {
    expect(calcularTotalCentavos(['flow', 'flow'], 'mensual')).toBe(6_000_000);
  });

  it('dos módulos mensual: solo +10% por adicional', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(10_800_000); // 12M × 0.90
  });

  it('dos módulos semestral: base 10% + adicional 10%', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'semestral')).toBe(57_600_000); // 72M × 0.80
  });

  it('dos módulos anual: base 15% + adicional 10%', () => {
    expect(calcularTotalCentavos(['flow', 'manage'], 'anual')).toBe(108_000_000); // 144M × 0.75
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

  it('formatCOP muestra pesos sin decimales', () => {
    expect(formatCOP(6_000_000).replace(/\s/g, '')).toBe('$60.000');
  });
});
