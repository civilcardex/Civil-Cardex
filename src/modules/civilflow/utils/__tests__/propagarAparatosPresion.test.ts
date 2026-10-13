import { describe, it, expect, beforeEach, vi } from 'vitest';

// Propagación PERSISTENTE de aparatos af/ac (orig. usuario): RAF3 = asociación del montante
// (vía RAF1) + aparato propio de RAF2 — escrita en las claves con libro + delta.

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
import { propagarAparatosPresion, leerHeredadosPresion } from '../aparatosPresion';

const AF_KEY = 'aparatos_by_tramo_v2';

/** Escenario de la imagen: MON1 carga ucAplicado {inodoro:1}; RAF1 nace de MON1 y llega con
 *  su cabeza a la unión J=[100,0]; RAF2 nace en J con aparato propio (lavamanos); RAF3 parte
 *  de J hacia la derecha. */
function seedEscenario(): void {
  saveToStorage('trazos_P1', {
    ramales: [
      {
        id: 'RAF1',
        net: 'af',
        pts: [
          [100, -100],
          [100, 0],
        ],
      },
      {
        id: 'RAF2',
        net: 'af',
        pts: [
          [100, 0],
          [100, 80],
        ],
      },
      {
        id: 'RAF3',
        net: 'af',
        pts: [
          [100, 0],
          [200, 0],
        ],
      },
    ],
    bajantes: [
      {
        id: 'MON1',
        code: 'MON1',
        net: 'af',
        tipo: 'montante',
        x: 100,
        y: -100,
        ucAplicado: { af_MON1_P1: { inodoro: 1 } },
      },
    ],
  });
  const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
  disk['af_RAF2_P1'] = { lavamanos: 1 };
  saveToStorage(AF_KEY, disk);
}

function diskDe(): Record<string, Record<string, number>> {
  return loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
}

describe('propagarAparatosPresion', () => {
  it('RAF3 = carga del montante (vía RAF1) + aparato propio de RAF2, escrito con libro', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    const disk = diskDe();
    // RAF3 hereda inodoro (montante vía RAF1) + lavamanos (hermano RAF2).
    expect(disk['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
    // RAF1 hereda el montante.
    expect(disk['af_RAF1_P1']).toEqual({ inodoro: 1 });
    // RAF2 también recibe lo que llega a la unión (inodoro) + lo propio.
    expect(disk['af_RAF2_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
    expect(leerHeredadosPresion('af_RAF2_P1')).toEqual({ inodoro: 1 });
    // Libro = exactamente lo aplicado por herencia.
    expect(leerHeredadosPresion('af_RAF3_P1')).toEqual({ inodoro: 1, lavamanos: 1 });
  });

  it('es idempotente: re-correr no duplica', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    expect(diskDe()['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
  });

  it('quitar el aparato de RAF2 baja el delta en RAF3 y limpia el libro', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    const disk = diskDe();
    disk['af_RAF2_P1'] = {};
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    expect(diskDe()['af_RAF3_P1']).toEqual({ inodoro: 1 });
    expect(leerHeredadosPresion('af_RAF3_P1')).toEqual({ inodoro: 1 });
  });

  it('_tribReversed invierte el sentido: quien fluye hacia la unión es el upstream', () => {
    seedEscenario();
    // RAF3 invertida: su cola pasa a [200,0]; RAF1 ya no llega a su cola.
    const trazos = loadFromStorage<{ ramales: Array<Record<string, unknown>> } | null>(
      'trazos_P1',
      null,
    );
    if (!trazos) throw new Error('trazos_P1 ausente');
    trazos.ramales = trazos.ramales.map((r) =>
      r.id === 'RAF3' ? { ...r, _tribReversed: true } : r,
    );
    saveToStorage('trazos_P1', trazos);
    propagarAparatosPresion('af');
    // La herencia previa se retira (delta): RAF3 queda solo con lo que llega a su NUEVA cola.
    expect(diskDe()['af_RAF3_P1']).toBeUndefined();
    expect(leerHeredadosPresion('af_RAF3_P1')).toEqual({});
  });

  it('ciclo: termina acotado sin colgar ni duplicar', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RA',
          net: 'af',
          pts: [
            [0, 0],
            [50, 0],
          ],
        },
        {
          id: 'RB',
          net: 'af',
          pts: [
            [50, 0],
            [0, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk = diskDe();
    disk['af_RA_P1'] = { lavaplatos: 1 };
    saveToStorage(AF_KEY, disk);
    expect(() => propagarAparatosPresion('af')).not.toThrow();
    // Ciclo acotado (determinista): cada uno carga la base del otro UNA vez, sin inflar.
    expect(diskDe()['af_RA_P1']).toEqual({ lavaplatos: 2 });
    expect(leerHeredadosPresion('af_RA_P1')).toEqual({ lavaplatos: 1 });
  });
});
