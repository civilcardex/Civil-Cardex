import { describe, it, expect } from 'vitest';
import { clavesRamalesVentDeBajantes } from '../ventDiameterFanout.ts';
import type { DrawingData } from '../drawingSync.ts';

// Fixture: 2 bajantes de vent (BAV2 con code BAV2-P2, BAV3) en plan "2" y un doc
// con 4 ramales vent: 2 conectados a BAV2 (por id y por code), 1 a BAV3, 1 suelto.
const doc: DrawingData = {
  bajantes: [
    { id: 'BAV2', code: 'BAV2-P2', net: 'vent', tipo: 'bajante' },
    { id: 'BAV3', net: 'vent', tipo: 'bajante' },
  ],
  ramales: [
    { id: 'RV1', net: 'vent', tipo: 'ramal', ini: 'BAV2', fin: 'arriba' },
    { id: 'RV2', net: 'vent', tipo: 'ramal', ini: 'x', fin: 'BAV2-P2' },
    { id: 'RV3', net: 'vent', tipo: 'ramal', ini: 'BAV3', fin: 'y' },
    { id: 'RV4', net: 'vent', tipo: 'ramal', ini: 'suelto1', fin: 'suelto2' },
    { id: 'RS1', net: 'san', tipo: 'ramal', ini: 'BAV2', fin: 'z' },
  ],
} as unknown as DrawingData;
const storage = { '2': doc };

describe('clavesRamalesVentDeBajantes', () => {
  it('golden: conectados por id o code, solo red vent, un batch', () => {
    expect(clavesRamalesVentDeBajantes(['BAV2-2'], null, storage)).toEqual(['RV1-2', 'RV2-2']);
  });

  it('lista vacía → cae al bajante principal; varios bajantes suman', () => {
    expect(clavesRamalesVentDeBajantes([], 'BAV2-2', storage)).toEqual(['RV1-2', 'RV2-2']);
    expect(clavesRamalesVentDeBajantes(['BAV2-2', 'BAV3-2'], null, storage)).toEqual([
      'RV1-2',
      'RV2-2',
      'RV3-2',
    ]);
  });

  it('sin doc del plan ni claves → vacío (sin writes)', () => {
    expect(clavesRamalesVentDeBajantes([], null, storage)).toEqual([]);
    expect(clavesRamalesVentDeBajantes(['BAV9-99'], null, storage)).toEqual([]);
  });
});
