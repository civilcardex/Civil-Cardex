import { describe, expect, it } from 'vitest';
import { matchDiamOption } from '../diamOptionMatch';

const LIST = [
  { n: '1/2" — 16.6 mm' },
  { n: '1-1/2" — 42.7 mm' },
  { n: '1" — 33.4 mm' },
  { n: '10" — 273.1 mm' },
  { n: '1/2" RDE 9 — 16.6 mm' },
];

describe('matchDiamOption', () => {
  it('match directo full', () => {
    expect(matchDiamOption(LIST, '1-1/2" — 42.7 mm')).toBe('1-1/2" — 42.7 mm');
  });
  it('match base-token (short sin mm)', () => {
    expect(matchDiamOption(LIST, '1-1/2"')).toBe('1-1/2" — 42.7 mm');
  });
  it('match por prefijo pulgada para forma RDE', () => {
    expect(matchDiamOption(LIST, '1/2" RDE 9')).toBe('1/2" RDE 9 — 16.6 mm');
  });
  it('no mezcla 1" con 10"', () => {
    expect(matchDiamOption(LIST, '1"')).toBe('1" — 33.4 mm');
  });
  it('vacio/undefined -> cadena vacia', () => {
    expect(matchDiamOption(LIST, '')).toBe('');
    expect(matchDiamOption(LIST, undefined)).toBe('');
    expect(matchDiamOption([], '1"')).toBe('');
    expect(matchDiamOption(LIST, null)).toBe('');
  });
  it('sin match -> cadena vacia', () => {
    expect(matchDiamOption(LIST, '2-1/2"')).toBe('');
  });
});
