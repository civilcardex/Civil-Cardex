import { describe, it, expect } from 'vitest';
import { fmt, normalizeDnLabel, fmtPulg, sanitizeMojibake } from '../formatUtils';

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

describe('sanitizeMojibake', () => {
  it('repara em-dash mojibake sabor CP1252 (\\u00E2\\u20AC\\u201D → —)', () => {
    expect(sanitizeMojibake('1/2" \u00E2\u20AC\u201D 12.7 mm')).toBe('1/2" — 12.7 mm');
  });

  it('repara em-dash mojibake sabor Latin-1 (\\u00E2\\u20AC\\u0094 → —)', () => {
    expect(sanitizeMojibake('1/2" \u00E2\u20AC\u0094 12.7 mm')).toBe('1/2" — 12.7 mm');
  });

  it('repara simbolo mojibake (\\u00E2\\u2021\\u201E → ⇄)', () => {
    expect(sanitizeMojibake('\u00E2\u2021\u201E Invertir dirección de flujo')).toBe(
      '⇄ Invertir dirección de flujo',
    );
  });

  it('repara fraccion mojibake (\\u00C2\\u00BD → ½)', () => {
    expect(sanitizeMojibake('1Â½"')).toBe('1½"');
  });

  it('repara punto medio mojibake (\\u00C2\\u00B7 → ·)', () => {
    expect(sanitizeMojibake('PVC Â· 12')).toBe('PVC · 12');
  });

  it('repara acentos mojibake (\\u00C3\\u00A1 → á, \\u00C3\\u00B1 → ñ)', () => {
    expect(sanitizeMojibake('CÃ¡mara NÃºmero Ã±')).toBe('Cámara Número ñ');
  });

  it('repara mojibake mezclado con texto limpio', () => {
    expect(sanitizeMojibake('Diámetro \u00E2\u20AC\u201D 12.7 \u00E2\u2021\u201E')).toBe(
      'Diámetro — 12.7 ⇄',
    );
  });

  it('elimina Â huerfano', () => {
    expect(sanitizeMojibake('Â10')).toBe('10');
  });

  it('deja intacto texto limpio', () => {
    expect(sanitizeMojibake('PVC — 1/2" · 12.7 mm ⇄ á é ñ')).toBe('PVC — 1/2" · 12.7 mm ⇄ á é ñ');
  });

  it('normalizeDnLabel repara diametro mojibake con em-dash', () => {
    const r = normalizeDnLabel('1/2" \u00E2\u20AC\u201D 12.7 mm'.split(' \u00E2\u20AC\u201D ')[0]);
    expect(r).toBe('1/2"');
  });
});
