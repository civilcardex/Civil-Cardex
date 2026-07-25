import { describe, it, expect } from 'vitest';
import { dec, parseIntInput, parseDecimalInput } from '../parseDecimal';

describe('dec', () => {
  it('convierte string numerico a numero', () => {
    expect(dec('3.14')).toBe(3.14);
  });

  it('retorna 0 para string vacio', () => {
    expect(dec('')).toBe(0);
  });

  it('convierte string entero', () => {
    expect(dec('42')).toBe(42);
  });

  it('convierte string con coma decimal', () => {
    expect(dec('1,5')).toBe(1.5);
  });

  it('soporta valores negativos', () => {
    expect(dec('-10.5')).toBe(-10.5);
  });
});

describe('parseDecimalInput', () => {
  it('retorna numero para string valido', () => {
    expect(parseDecimalInput('3.14')).toBe(3.14);
  });

  it('retorna null para string vacio', () => {
    expect(parseDecimalInput('')).toBeNull();
  });

  it('retorna null para texto no numerico', () => {
    expect(parseDecimalInput('abc')).toBeNull();
  });

  it('soporta coma como decimal', () => {
    expect(parseDecimalInput('1,5')).toBe(1.5);
  });

  it('soporta punto como decimal', () => {
    expect(parseDecimalInput('2.75')).toBe(2.75);
  });
});

describe('parseIntInput', () => {
  it('retorna entero para string valido', () => {
    expect(parseIntInput('42')).toBe(42);
  });

  it('retorna 0 para string "0"', () => {
    expect(parseIntInput('0')).toBe(0);
  });

  it('retorna null para string vacio', () => {
    expect(parseIntInput('')).toBeNull();
  });

  it('retorna null para texto no numerico', () => {
    expect(parseIntInput('abc')).toBeNull();
  });

  it('redondea decimales cercanos a entero', () => {
    expect(parseIntInput('3.0001')).toBe(3);
  });

  it('retorna null para decimal lejano de entero', () => {
    expect(parseIntInput('3.5')).toBeNull();
  });
});
