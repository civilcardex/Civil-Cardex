import { describe, it, expect } from 'vitest';

/**
 * Las tablas de obra se calculan por red y el componente principal solo las compone.
 * Ej: san/ll/af/ac -> cada hook existe y comparte f2 (dos decimales o guion).
 */
import { useSanTables } from '../useSanTables';
import { useLlTables } from '../useLlTables';
import { useAfTables } from '../useAfTables';
import { useAcTables } from '../useAcTables';
import { f2 } from '../tableHelpers';

describe('hooks de tablas por red', () => {
  it('cada red tiene su hook', () => {
    expect(typeof useSanTables).toBe('function');
    expect(typeof useLlTables).toBe('function');
    expect(typeof useAfTables).toBe('function');
    expect(typeof useAcTables).toBe('function');
  });

  it('el helper de formato es el compartido (dos decimales o guion)', () => {
    expect(f2(1.5)).toBe('1.50');
    expect(f2(0)).toBe('-');
    expect(f2(12.345)).toBe('12.35');
  });
});
