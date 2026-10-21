import { describe, it, expect, beforeEach } from 'vitest';

/**
 * El montante debe agregar la carga de los ramales que alimenta, no solo la de los que recibe.
 * Ej: MAC1 con 2 ramales de 2.25 UC (Unidades de Consumo) -> el panel muestra 4.5, no 0.
 */

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  const g = globalThis as Record<string, unknown>;
  g.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete mockStorage[k];
    },
    get length() {
      return Object.keys(mockStorage).length;
    },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  };
  g.window = { dispatchEvent: () => {} };
});

import { agregarCargaDeBajante } from '../bajanteAggregate.ts';
import { leerHeredadosPresion } from '../../../utils/propagation';

/** Montante con dos ramales alimentados (los que llevan los aparatos). */
function argsDeMontante() {
  const counts = {
    ac_RAF1_P1: { lvm: 1 },
    ac_RAF2_P1: { tin: 1 },
  };
  mockStorage['civilflow_aparatos_by_tramo_v2'] = JSON.stringify(counts);
  return {
    bajId: 'MAC1',
    counts,
    netId: 'ac',
    planId: 'P1',
    sanConnectivity: null,
    tramosPiso: [
      { _key: 'RAF1-P1', id: 'RAF1', tipo: 'ramal', esBajante: false },
      { _key: 'RAF2-P1', id: 'RAF2', tipo: 'ramal', esBajante: false },
    ],
    exits: new Set<string>(),
    engineRef: {
      current: {
        bajantes: [
          {
            id: 'MAC1',
            net: 'ac',
            tipo: 'montante',
            x: 0,
            y: 0,
            recibeDeIds: [],
            alimentaIds: ['RAF1', 'RAF2'],
          },
        ],
        ramales: [],
      },
    },
  };
}

describe('el agregado de un MONTANTE', () => {
  it('suma los aparatos de los ramales que alimenta', () => {
    const agg = agregarCargaDeBajante(argsDeMontante());
    // Los dos ramales alimentados llevan 1 aparato cada uno.
    expect(agg.lvm).toBe(1);
    expect(agg.tin).toBe(1);
  });

  it('un bajante normal NO suma sus salidas (espejos)', () => {
    const args = argsDeMontante();
    const agg = agregarCargaDeBajante({
      ...args,
      bajId: 'BAN1',
      engineRef: {
        current: {
          bajantes: [
            {
              id: 'BAN1',
              net: 'ac',
              tipo: 'bajante',
              x: 0,
              y: 0,
              recibeDeIds: [],
              alimentaIds: ['RAF1', 'RAF2'],
            },
          ],
          ramales: [],
        },
      },
    });
    // Las salidas de un bajante son espejos: no aportan.
    expect(agg.lvm).toBeUndefined();
    expect(agg.tin).toBeUndefined();
  });
});

describe('los libros de herencia', () => {
  it('leerHeredadosPresion devuelve el libro del tramo', () => {
    mockStorage['civilflow_aparatos_heredados_v1'] = JSON.stringify({
      ac_RAF1_P1: { lvm: 1 },
    });
    expect(leerHeredadosPresion('ac_RAF1_P1')).toEqual({ lvm: 1 });
  });
});
