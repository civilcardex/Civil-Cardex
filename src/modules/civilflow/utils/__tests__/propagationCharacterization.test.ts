import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * CARACTERIZACIÓN de la propagación de presión (aparatosPresion).
 *
 * Congelan el comportamiento ACTUAL de cada fase (por eso son "goldens": el valor esperado es
 * el que el código produce hoy). Sirven de red de seguridad para partir el archivo en módulos:
 * si una extracción cambia un número, estos tests lo cantan.
 *
 * Fases cubiertas: 1) colección por piso · 2) carga del bajante/montante · 3) down-trib y
 * clusters (aristas) · 3b) entrega del montante · 4) plegado de tributarios · 5) DFS y totales
 * · 6) escritura idempotente.
 */

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

const AF_KEY = 'aparatos_by_tramo_v2';
const HER_KEY = 'aparatos_heredados_v1';
const TRIB_KEY = 'aparatos_heredados_trib_v1';

const disco = () => loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
const libros = () => loadFromStorage<Record<string, Record<string, number>>>(HER_KEY, {}) || {};
const librosTrib = () =>
  loadFromStorage<Record<string, Record<string, number>>>(TRIB_KEY, {}) || {};

const sembrar = (key: string, data: unknown): void => {
  saveToStorage(key, data);
};
const conteo = (m: Record<string, Record<string, number>>, clave: string): number =>
  Object.values(m[clave] || {}).reduce((s, v) => s + v, 0);

describe('fase 1 · la colección se particiona por piso', () => {
  it('el mismo id en dos pisos NO se mezcla (cada plano mantiene su carga)', () => {
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'ducha',
        },
      ],
      bajantes: [],
    });
    sembrar('trazos_P2', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'ducha',
        },
      ],
      bajantes: [],
    });
    const d = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    d['af_RAF1_P1'] = { ducha: 1 };
    d['af_RAF1_P2'] = { lavamanos: 2 };
    saveToStorage(AF_KEY, d);

    propagarAparatosPresion('af');

    const r = disco();
    expect(r['af_RAF1_P1']).toEqual({ ducha: 1 });
    expect(r['af_RAF1_P2']).toEqual({ lavamanos: 2 });
  });
});

describe('fase 2 · la carga del bajante/montante', () => {
  it('el libro se toma con MÁXIMO (no suma): el ramal que alimenta recibe la carga una vez', () => {
    // El montante entrega su carga (libro con DOS entradas de la misma carga: Ldesvio + ramal).
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
      bajantes: [
        {
          id: 'MON1',
          code: 'MON1',
          net: 'af',
          tipo: 'montante',
          x: 0,
          y: 0,
          alimentaIds: ['RAF1'],
          ucAplicado: { af_LD_X_P1: { ino: 2 }, af_RAF1_P1: { ino: 2 } },
        },
      ],
    });
    propagarAparatosPresion('af');
    expect(disco()['af_RAF1_P1']).toEqual({ ino: 2 });
  });
});

describe('fase 3 · down-trib y clusters', () => {
  it('el tributario vertical hacia abajo es la continuación receptora de su unión', () => {
    // RAF1 horizontal (padre) con el tributario RAF2 vertical ABAJO en su extremo. El padre
    // fluye HACIA la unión (cola en [100,0]) y el tributario baja (cola en [100,0], cabeza
    // abajo): la carga del padre baja al tributario (plegado invertido).
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [100, 0],
            [0, 0],
          ],
          aparatoFin: 'inodoro',
        },
        {
          id: 'RAF2',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAF1',
          aparatoFin: 'lavamanos',
          pts: [
            [100, 0],
            [100, 60],
          ],
        },
      ],
      bajantes: [],
    });
    const d = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    d['af_RAF1_P1'] = { inodoro: 1 };
    d['af_RAF2_P1'] = { lavamanos: 1 };
    saveToStorage(AF_KEY, d);

    propagarAparatosPresion('af');

    // El padre conserva lo suyo y el tributario recibe su carga UNA vez (plegado invertido).
    expect(disco()['af_RAF1_P1']).toEqual({ inodoro: 1 });
    expect(disco()['af_RAF2_P1']).toEqual({ lavamanos: 1, inodoro: 1 });
    expect(librosTrib()['af_RAF2_P1']).toEqual({ inodoro: 1 });
  });
});

describe('fase 3b · el montante entrega su carga al ramal que nace en él', () => {
  it('el ramal alimentado por el montante recibe su carga', () => {
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
      bajantes: [
        {
          id: 'MON1',
          code: 'MON1',
          net: 'af',
          tipo: 'montante',
          x: 0,
          y: 0,
          alimentaIds: ['RAF1'],
          ucAplicado: { af_RAF1_P1: { ino: 1 } },
        },
      ],
    });
    propagarAparatosPresion('af');
    expect(disco()['af_RAF1_P1']).toEqual({ ino: 1 });
    expect(libros()['af_RAF1_P1']).toEqual({ ino: 1 });
  });
});

describe('fase 5 · el DFS reparte la carga aguas abajo', () => {
  it('la cadena A→B→C lleva la carga del extremo al final', () => {
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAFA',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'inodoro',
        },
        {
          id: 'RAFB',
          net: 'af',
          pts: [
            [100, 0],
            [200, 0],
          ],
        },
        {
          id: 'RAFC',
          net: 'af',
          pts: [
            [200, 0],
            [300, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const d = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    d['af_RAFA_P1'] = { inodoro: 1 };
    saveToStorage(AF_KEY, d);
    propagarAparatosPresion('af');
    const r = disco();
    expect(conteo(r, 'af_RAFA_P1')).toBe(1);
    expect(conteo(r, 'af_RAFB_P1')).toBe(1);
    expect(conteo(r, 'af_RAFC_P1')).toBe(1);
  });
});

describe('fase 6 · la escritura es idempotente', () => {
  it('correr la propagación dos veces NO cambia el resultado', () => {
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAFA',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'inodoro',
        },
        {
          id: 'RAFB',
          net: 'af',
          pts: [
            [100, 0],
            [200, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const d = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    d['af_RAFA_P1'] = { inodoro: 1 };
    saveToStorage(AF_KEY, d);
    propagarAparatosPresion('af');
    const primera = JSON.stringify(disco());
    const libros1 = JSON.stringify(libros());
    propagarAparatosPresion('af');
    expect(JSON.stringify(disco())).toBe(primera);
    expect(JSON.stringify(libros())).toBe(libros1);
  });

  it('el heredado de la unión queda en el libro (no en el disco como propio)', () => {
    sembrar('trazos_P1', {
      ramales: [
        {
          id: 'RAFA',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'inodoro',
        },
        {
          id: 'RAFB',
          net: 'af',
          pts: [
            [100, 0],
            [200, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const d = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    d['af_RAFA_P1'] = { inodoro: 1 };
    saveToStorage(AF_KEY, d);
    propagarAparatosPresion('af');
    // RAFB no tiene aparato propio: su carga es HEREDADA (va en el libro, no en el manual).
    expect(libros()['af_RAFB_P1']).toEqual({ inodoro: 1 });
  });
});
