import { describe, it, expect } from 'vitest';
import { fmt, normalizeDnLabel, fmtPulg } from '../formatUtils';

describe('fmtPulg', () => {
  it('retorna "—" para valor 0', () => {
    expect(fmtPulg(0)).toBe('—');
  });

  it('retorna "—" para valor negativo', () => {
    expect(fmtPulg(-1)).toBe('—');
  });

  it('retorna entero sin fraccion', () => {
    expect(fmtPulg(2)).toBe('2"');
  });

  it('retorna fraccion sola (sin entero)', () => {
    expect(fmtPulg(0.5)).toBe('½"');
  });

  it('retorna entero + fraccion', () => {
    expect(fmtPulg(1.5)).toBe('1 ½"');
  });

  it('retorna decimal con 2 cifras si no hay fraccion Unicode', () => {
    expect(fmtPulg(1.33)).toBe('1.33"');
  });

  it('soporta 0.75 → ¾"', () => {
    expect(fmtPulg(0.75)).toBe('¾"');
  });

  it('soporta 0.25 → ¼"', () => {
    expect(fmtPulg(0.25)).toBe('¼"');
  });
});

describe('fmt', () => {
  it('formatea numero con 2 decimales por defecto', () => {
    expect(fmt(3.14159)).toBe('3.14');
  });

  it('formatea con N decimales', () => {
    expect(fmt(3.14159, 4)).toBe('3.1416');
  });

  it('retorna "—" para null', () => {
    expect(fmt(null)).toBe('—');
  });

  it('retorna "—" para undefined', () => {
    expect(fmt(undefined)).toBe('—');
  });

  it('retorna "—" para NaN', () => {
    expect(fmt(Number.NaN)).toBe('—');
  });

  it('formatea string numerico', () => {
    expect(fmt('42')).toBe('42.00');
  });

  it('retorna "—" para string no numerico', () => {
    expect(fmt('abc')).toBe('—');
  });

  it('formatea cero', () => {
    expect(fmt(0)).toBe('0.00');
  });
});

describe('normalizeDnLabel', () => {
  it('convierte fraccion unicode ½ a 1/2', () => {
    expect(normalizeDnLabel('1½"')).toContain('1/2');
  });

  it('convierte ¾ a 3/4', () => {
    expect(normalizeDnLabel('¾"')).toContain('3/4');
  });

  it('convierte ¼ a 1/4', () => {
    expect(normalizeDnLabel('¼"')).toContain('1/4');
  });

  it('digito seguido de fraccion agrega guion', () => {
    const result = normalizeDnLabel('1½"');
    expect(result).toContain('1-1/2');
  });

  it('retorna igual si no hay fracciones unicode', () => {
    expect(normalizeDnLabel('100 mm')).toBe('100 mm');
  });

  it('maneja string vacio', () => {
    expect(normalizeDnLabel('')).toBe('');
  });

  it('convierte "4 1/2" a "4-1/2"', () => {
    const r = normalizeDnLabel('4 1/2');
    expect(r).toContain('4-1/2');
  });
});
