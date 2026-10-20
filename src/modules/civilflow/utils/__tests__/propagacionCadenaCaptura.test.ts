import { describe, it, expect, beforeEach, vi } from 'vitest';

// Cadena EXACTA de la captura del usuario (P2, red ac): T1RAC4 (trib vertical arriba, tina en
// la punta) y RAC1 (horizontal derecha, lavamanos en la punta) llegan al nudo donde arranca
// RAC4; RAC4 viaja a la izquierda hasta el segundo nudo donde bajan RAC2 (vertical abajo) y
// RAC3 (continúa a la izquierda). Los aparatos de las puntas deben ATRAVESAR los nudos:
// RAC4 termina con {tin, lvm} y RAC2 los recibe todos ("y así sucesivamente").

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

import { saveToStorage, loadFromStorage } from '../../services/storageService';
import { propagarAparatosPresion } from '../propagation';

const AP_KEY = 'aparatos_by_tramo_v2';
const PID = 'P2';

/** Topología de la captura: dos nudos, aparatos en las puntas de T1RAC4 y RAC1. */
function sembrarCaptura(): void {
  saveToStorage(`trazos_${PID}`, {
    ramales: [
      // Nudo F1 en (100,0): RAC4 nace allí y viaja a la izquierda (flecha ←).
      {
        id: 'RAC4',
        net: 'ac',
        pts: [
          [100, 0],
          [-150, 0],
        ],
      },
      // T1RAC4: tributario de RAC4, sube desde el nudo; tina en la punta (extremo lejano).
      {
        id: 'T1RAC4',
        net: 'ac',
        tipo: 'tributario',
        padre: 'RAC4',
        pts: [
          [100, 0],
          [100, -83],
        ],
        aparatoFin: 'tin',
      },
      // RAC1: nace en el nudo y va a la derecha (flecha →); lavamanos en la punta.
      {
        id: 'RAC1',
        net: 'ac',
        pts: [
          [100, 0],
          [209, 0],
        ],
        aparatoFin: 'lvm',
      },
      // Nudo F2 en (-150,0): RAC2 baja vertical (+3.500 → piso inferior).
      {
        id: 'RAC2',
        net: 'ac',
        pts: [
          [-150, 0],
          [-150, 150],
        ],
      },
      // RAC3: continúa a la izquierda desde F2 (flecha ←).
      {
        id: 'RAC3',
        net: 'ac',
        pts: [
          [-150, 0],
          [-300, 0],
        ],
      },
    ],
    bajantes: [],
  });
  const disk = loadFromStorage<Record<string, Record<string, number>>>(AP_KEY, {}) || {};
  disk[`ac_T1RAC4_${PID}`] = { tin: 1 };
  disk[`ac_RAC1_${PID}`] = { lvm: 1 };
  saveToStorage(AP_KEY, disk);
}

describe('propagación cadena de la captura (RAC1+T1RAC4 → RAC4 → RAC2)', () => {
  it('RAC4 recibe tin+lvm en la 1ª corrida y RAC2 los hereda', () => {
    sembrarCaptura();
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AP_KEY, {}) || {};
    expect(disk[`ac_RAC4_${PID}`]).toEqual({ tin: 1, lvm: 1 });
    expect(disk[`ac_RAC2_${PID}`]).toEqual({ tin: 1, lvm: 1 });
    // Las puntas conservan lo propio; RAC3 (pieza de paso consumida) queda vacía.
    expect(disk[`ac_T1RAC4_${PID}`]).toEqual({ tin: 1 });
    expect(disk[`ac_RAC1_${PID}`]).toEqual({ lvm: 1 });
    expect(disk[`ac_RAC3_${PID}`]).toBeUndefined();
  });

  it('es idempotente: la 2ª corrida no cambia nada', () => {
    sembrarCaptura();
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AP_KEY, {}) || {};
    expect(disk[`ac_RAC4_${PID}`]).toEqual({ tin: 1, lvm: 1 });
    expect(disk[`ac_RAC2_${PID}`]).toEqual({ tin: 1, lvm: 1 });
    expect(disk[`ac_T1RAC4_${PID}`]).toEqual({ tin: 1 });
    expect(disk[`ac_RAC1_${PID}`]).toEqual({ lvm: 1 });
  });
});
