import { describe, it, expect } from 'vitest';
import { ramalNumero, compareTramosPisoDesc } from '../componentHelpers';

// Tablas de diseño: piso descendente, numeración de ramal ascendente (orig. usuario).
describe('orden de tablas — piso desc + número asc', () => {
  it('ramalNumero extrae el primer entero', () => {
    expect(ramalNumero('RS1')).toBe(1);
    expect(ramalNumero('RS10')).toBe(10);
    expect(ramalNumero('T1RS1')).toBe(1);
    expect(ramalNumero('RALL12')).toBe(12);
    expect(ramalNumero('')).toBe(0);
    expect(ramalNumero(undefined)).toBe(0);
  });

  it('piso descendente manda sobre número', () => {
    const rows = [
      { piso: 1, id: 'RS1' },
      { piso: 3, id: 'RS1' },
      { piso: 2, id: 'RS9' },
    ].toSorted(compareTramosPisoDesc);
    expect(rows.map((r) => r.piso)).toEqual([3, 2, 1]);
  });

  it('a igual piso, número ascendente (10 después de 2)', () => {
    const rows = [
      { piso: 2, id: 'RS10' },
      { piso: 2, id: 'RS2' },
      { piso: 2, id: 'RS1' },
    ].toSorted(compareTramosPisoDesc);
    expect(rows.map((r) => r.id)).toEqual(['RS1', 'RS2', 'RS10']);
  });
});
