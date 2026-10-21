import { describe, it, expect } from 'vitest';
import { diamFractionValue } from '../diamFractionValor.ts';

/**
 * El valor decimal de una etiqueta de di\u00e1metro: una sola fuente para el panel de acometida y
 * la tabla de rows (antes eran dos copias del mismo c\u00f3digo).
 */
describe('diamFractionValue', () => {
  it('lee las fracciones habituales', () => {
    expect(diamFractionValue('1/2"')).toBe(0.5);
    expect(diamFractionValue('3/4"')).toBe(0.75);
  });

  it('lee las fracciones COMPUESTAS ("1 1/2" -> 1.5)', () => {
    // La composed se lee ANTES que la simple: si se buscara "1/2" primero, "1 1/2" devolver\u00eda
    // 0.5 y la rama "1 1/2" quedaba inalcanzable (bug heredado).
    expect(diamFractionValue('1 1/2"')).toBe(1.5);
    expect(diamFractionValue('1 1/4"')).toBe(1.25);
    expect(diamFractionValue('2 3/4"')).toBe(2.75);
  });

  it('lee un n\u00famero suelto y descarta las comillas', () => {
    expect(diamFractionValue('20')).toBe(20);
    expect(diamFractionValue('20"')).toBe(20);
    expect(diamFractionValue('25 mm')).toBe(25);
  });

  it('devuelve 0 si no hay nada que leer', () => {
    expect(diamFractionValue('')).toBe(0);
    expect(diamFractionValue('   ')).toBe(0);
  });
});
