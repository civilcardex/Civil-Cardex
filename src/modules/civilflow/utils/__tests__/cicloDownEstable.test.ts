import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pin anti-divergencia (auditoría 2026-10-16, hallazgo H8): ciclo A↔B con down-trib
// alimentado por trib lateral. Alcance: ESTABILIDAD bit a bit entre corridas (D1==D3),
// no exactitud del conteo — en un ciclo degenerado la carga circula por diseño y el
// número estable es el contrato (la metodología UC no parte mallas no declaradas).
const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
});
vi.stubGlobal('window', { dispatchEvent: () => {} });

import { saveToStorage, loadFromStorage } from '../../services/storageService.ts';
import { propagarAparatosPresion } from '../propagation';

const AC_KEY = 'aparatos_by_tramo_v2';

describe('ciclo con down-trib: idempotente entre corridas', () => {
  it('D1 == D3 (sin crecimiento +N/corrida)', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'A',
          net: 'ac',
          aparatoFin: 'lavamanos',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'B',
          net: 'ac',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'DOWN',
          net: 'ac',
          tipo: 'tributario',
          padre: 'A',
          pts: [
            [100, 0],
            [100, 100],
          ],
        },
        {
          id: 'T',
          net: 'ac',
          tipo: 'tributario',
          padre: 'B',
          aparatoInicio: 'ducha',
          pts: [
            [100, 0],
            [180, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    disk0['ac_A_P1'] = { lavamanos: 1 };
    disk0['ac_T_P1'] = { ducha: 1 };
    saveToStorage(AC_KEY, disk0);
    propagarAparatosPresion('ac');
    const d1 = JSON.stringify(
      loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {},
    );
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const d3 = JSON.stringify(
      loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {},
    );
    expect(d3).toBe(d1);
  });
});
