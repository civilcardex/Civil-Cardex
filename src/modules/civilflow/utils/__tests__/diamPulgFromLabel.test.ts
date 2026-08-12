import { describe, it, expect } from 'vitest';
import { diamPulgFromLabel } from '../diamPulgFromLabel';

describe('diamPulgFromLabel', () => {
  it('parses integers and decimals with double quotes', () => {
    expect(diamPulgFromLabel('2"')).toBe(2);
    expect(diamPulgFromLabel('1.5"')).toBe(1.5);
  });

  it('parses space-separated fractions with double quotes', () => {
    expect(diamPulgFromLabel('1 1/2"')).toBe(1.5);
    expect(diamPulgFromLabel('2 3/4"')).toBe(2.75);
  });

  it('parses simple fractions with double quotes', () => {
    expect(diamPulgFromLabel('1/2"')).toBe(0.5);
    expect(diamPulgFromLabel('3/4"')).toBe(0.75);
  });

  it('parses Unicode fractions', () => {
    expect(diamPulgFromLabel('½"')).toBe(0.5);
    expect(diamPulgFromLabel('1½"')).toBe(1.5);
    expect(diamPulgFromLabel('½')).toBe(0.5);
    expect(diamPulgFromLabel('1½')).toBe(1.5);
    expect(diamPulgFromLabel('1 ½"')).toBe(1.5);
    expect(diamPulgFromLabel('1 ½')).toBe(1.5);
  });

  it('parses values without double quotes as fallback', () => {
    expect(diamPulgFromLabel('1 1/2')).toBe(1.5);
    expect(diamPulgFromLabel('3/4')).toBe(0.75);
    expect(diamPulgFromLabel('1.5')).toBe(1.5);
    expect(diamPulgFromLabel('2')).toBe(2);
  });

  it('handles spaces and different dash types', () => {
    expect(diamPulgFromLabel('1 - 1/2')).toBe(1.5);
  });

  it('converts metric labels to inches (snapped to nominal)', () => {
    expect(diamPulgFromLabel('54.5 mm')).toBe(2);
    expect(diamPulgFromLabel('16.6 mm')).toBe(0.5);
    expect(diamPulgFromLabel('107.7')).toBe(4);
    expect(diamPulgFromLabel('42.68')).toBe(1.5);
    expect(diamPulgFromLabel('63.0 mm')).toBe(2);
    expect(diamPulgFromLabel('315')).toBe(12);
  });

  it('ignores plain specs without a leading diameter', () => {
    expect(diamPulgFromLabel('RDE 21')).toBe(0);
    expect(diamPulgFromLabel('RDE 13.5')).toBe(0);
    expect(diamPulgFromLabel('SCH 80')).toBe(0);
    expect(diamPulgFromLabel('CPVC 13.6')).toBe(0);
  });

  it('keeps bare inch values within catalog range untouched', () => {
    expect(diamPulgFromLabel('2')).toBe(2);
    expect(diamPulgFromLabel('12')).toBe(12);
  });

  it('parses full labeled options with letters', () => {
    expect(diamPulgFromLabel('2" — 54.5 mm')).toBe(2);
    expect(diamPulgFromLabel('1/2" RDE 13.5 — 18.18 mm')).toBe(0.5);
    expect(diamPulgFromLabel('1-1/2" RDE 21 — 43.68 mm')).toBe(1.5);
    expect(diamPulgFromLabel('4" RDE 21 — 103.42 mm')).toBe(4);
  });

  it('parses typographic double-prime quote', () => {
    expect(diamPulgFromLabel('1/2″')).toBe(0.5);
    expect(diamPulgFromLabel('2″ — 54.5 mm')).toBe(2);
  });

  it('returns 0 for empty or invalid values', () => {
    expect(diamPulgFromLabel('')).toBe(0);
    expect(diamPulgFromLabel(null)).toBe(0);
    expect(diamPulgFromLabel('abc')).toBe(0);
  });
});
