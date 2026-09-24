import { describe, expect, it } from 'vitest';
import { DESCUENTO_PAQUETE, calcularTotalCentavos, formatCOP } from '../catalogo';

describe('calcularTotalCentavos', () => {
  it('un módulo mensual = precio mensual', () => {
    expect(calcularTotalCentavos(['flow'], 'mensual')).toBe(1_990_000);
  });

  it('un módulo anual = precio anual', () => {
    expect(calcularTotalCentavos(['manage'], 'anual')).toBe(19_900_000);
  });

  it('deduplica módulos repetidos', () => {
    expect(calcularTotalCentavos(['flow', 'flow'], 'mensual')).toBe(1_990_000);
  });

  it('dos módulos aplican el descuento de paquete (mensual)', () => {
    const esperado = Math.round(2 * 1_990_000 * (1 - DESCUENTO_PAQUETE));
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(esperado);
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(3_383_000);
  });

  it('dos módulos aplican el descuento de paquete (anual)', () => {
    const esperado = Math.round(2 * 19_900_000 * (1 - DESCUENTO_PAQUETE));
    expect(calcularTotalCentavos(['flow', 'manage'], 'anual')).toBe(esperado);
    expect(calcularTotalCentavos(['flow', 'manage'], 'anual')).toBe(33_830_000);
  });

  it('formatCOP muestra pesos sin decimales', () => {
    expect(formatCOP(1_990_000).replace(/\s/g, '')).toBe('$19.900');
  });
});
