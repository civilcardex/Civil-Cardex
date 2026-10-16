import { describe, it, expect, beforeEach, vi } from 'vitest';

// Σ vertical de CalcUC (orig. usuario RAC5/RAC6-P2): propia = clave − heredado − plegado,
// sumando TODAS las filas (el tributario de cadena solo viaja por arista: excluirlo dejaba
// la Σ en 0 con las filas llenas).

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
import { esReceptorPropagacion, propagarAparatosPresion, udPropiaDe } from '../aparatosPresion';
import { sigma } from './sigmaHelper';

const AC_KEY = 'aparatos_by_tramo_v2';

describe('udPropiaDe', () => {
  it('carga sin libros = toda propia', () => {
    expect(udPropiaDe({ ducha: 1 }, {}, {})).toEqual({ ducha: 1 });
  });
  it('heredado se descuenta', () => {
    expect(udPropiaDe({ ducha: 1 }, { ducha: 1 }, {})).toEqual({});
  });
  it('plegado se descuenta', () => {
    expect(udPropiaDe({ lavamanos: 1 }, {}, { lavamanos: 1 })).toEqual({});
  });
  it('nunca negativo (heredado mayor que carga stale)', () => {
    expect(udPropiaDe({}, { ducha: 2 }, {})).toEqual({});
  });
});

describe('Σ con tributario de cadena (aparato solo por arista)', () => {
  it('la ducha del trib T1 cuenta 1 aunque el padre la herede', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC',
          net: 'ac',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'T1',
          net: 'ac',
          tipo: 'tributario',
          padre: 'RAC',
          aparatoFin: 'ducha',
          pts: [
            [100, 0],
            [100, -80],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    disk0['ac_T1_P1'] = { ducha: 1 };
    saveToStorage(AC_KEY, disk0);
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    // El trib conserva su manual y el padre no lo descuenta dos veces.
    expect(sigma(['ac_T1_P1', 'ac_RAC_P1'], 'ducha')).toBe(1);
  });
});

describe('down-trib + consumida horizontal: estable, sin crecimiento por corrida', () => {
  it('el down absorbe la consumida una sola vez (libro registra su foldN)', () => {
    // J=[200,0]: RAC llega por el oeste, DOWN baja (receptor) y C sale al este (consumida).
    // Sin foldNDe en el libro, fase A divergía +lvm/corrida (disco {lvm:1}→{lvm:2}→{lvm:3}).
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC',
          net: 'ac',
          pts: [
            [0, 0],
            [200, 0],
          ],
        },
        {
          id: 'DOWN',
          net: 'ac',
          tipo: 'tributario',
          padre: 'RAC',
          pts: [
            [200, 0],
            [200, 100],
          ],
        },
        {
          id: 'C',
          net: 'ac',
          aparatoFin: 'lavamanos',
          pts: [
            [200, 0],
            [300, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    disk0['ac_C_P1'] = { lavamanos: 1 };
    saveToStorage(AC_KEY, disk0);
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    expect(disk['ac_DOWN_P1']).toEqual({ lavamanos: 1 });
    expect(disk['ac_C_P1']).toEqual({ lavamanos: 1 });
    // El lavamanos cuenta UNA vez (en C): el DOWN lo absorbe pero su triple lo descuenta
    // vía el libro (foldN registrado) — sin foldNDe contaría 0 en C y N en el DOWN.
    expect(sigma(['ac_DOWN_P1', 'ac_C_P1', 'ac_RAC_P1'], 'lavamanos')).toBe(1);
  });
});

describe('esReceptorPropagacion (API conservada: criterio por libro de bajadas)', () => {
  it('lee el libro de bajadas receptoras por clave exacta', () => {
    expect(esReceptorPropagacion('ac_RAC3_P1')).toBe(false);
    saveToStorage('bajadas_receptoras_v1', { ac_RAC3_P1: 1 });
    expect(esReceptorPropagacion('ac_RAC3_P1')).toBe(true);
    expect(esReceptorPropagacion('ac_RAC9_P1')).toBe(false);
  });
});

describe('Σ con lateral plegado (sin regresión: total sigue 1)', () => {
  it('padre + trib lateral suman 1, atribuido al trib', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC',
          net: 'ac',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'T1',
          net: 'ac',
          tipo: 'tributario',
          padre: 'RAC',
          aparatoInicio: 'ducha',
          pts: [
            [50, 0],
            [50, -80],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    disk0['ac_T1_P1'] = { ducha: 1 };
    saveToStorage(AC_KEY, disk0);
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AC_KEY, {}) || {};
    // El padre pliega la ducha a su clave (carga visible en su fila).
    expect(disk['ac_RAC_P1']).toEqual({ ducha: 1 });
    // Pero la Σ la cuenta una sola vez, en el trib que la sirve.
    expect(sigma(['ac_T1_P1', 'ac_RAC_P1'], 'ducha')).toBe(1);
  });
});
