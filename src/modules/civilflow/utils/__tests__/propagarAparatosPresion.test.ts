import { describe, it, expect, beforeEach, vi } from 'vitest';

// Propagación PERSISTENTE de aparatos af/ac (orig. usuario): RAF3 = asociación del montante
// (vía RAF1) + aparato propio de RAF2 — escrita en las claves con libro + delta.
// Aristas (verdad del motor): montante/bajante por recibeDe/alimenta o distancia, y
// GENEALOGÍA DE SPLIT (mergesFrom) gateada por geometría. Sin regla de hermanos geométrica
// (esa llevaba el aparato de la rama hacia la pieza upstream).

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
import { propagarAparatosPresion, leerHeredadosPresion } from '../propagation';

const AF_KEY = 'aparatos_by_tramo_v2';

/** Escenario de la imagen: MON1 carga ucAplicado {inodoro:1}; RAF1 nace de MON1 y llega con
 *  su cabeza a la unión J=[100,0]; RAF2 nace en J con aparato propio (lavamanos); RAF3 es la
 *  continuación (mergesFrom del split real). */
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
        aparatoFin: 'lavamanos',
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
        // Genealogía del split real (junctionAutoSplit: [anfitrión, entrante]).
        mergesFrom: ['RAF1', 'RAF2'],
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
      },
    ],
  });
  const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
  disk['af_RAF2_P1'] = { lavamanos: 1 };
  // Carga del montante FUENTE: vive en su CLAVE DE DISCO (su ucAplicado es libro de
  // herencia de receptores — en una fuente puro sería legado huérfano y se purga).
  disk['af_MON1_P1'] = { inodoro: 1 };
  saveToStorage(AF_KEY, disk);
}

function diskDe(): Record<string, Record<string, number>> {
  return loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
}

describe('propagarAparatosPresion', () => {
  it('clúster mixto: la lateral NO recibe la carga del entrante perpendicular', () => {
    // T con 2 entrantes y 2 salidas: RAF1 (oeste→T, inodoro) y RAF2 (sur→T, lavamanos)
    // llegan a la unión; RAF3 continúa colineal a RAF1 (principal) y RAF4 sale a 45°
    // (NO es continuación de nadie: dot≈0.71 < 0.9 con ambos entrantes).
    // RAF2 sin continuación propia → su carga sale por la línea principal (contGlobal):
    // RAF3 hereda inodoro+lavamanos; RAF4 (lateral) no recibe por ninguna vía.
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          aparatoFin: 'inodoro',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'RAF2',
          aparatoFin: 'lavamanos',
          net: 'af',
          pts: [
            [100, -80],
            [100, 0],
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
        {
          id: 'RAF4',
          net: 'af',
          pts: [
            [100, 0],
            [170, 70],
          ],
        },
      ],
      bajantes: [],
    });
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk['af_RAF1_P1'] = { inodoro: 1 };
    disk['af_RAF2_P1'] = { lavamanos: 1 };
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    const despues = diskDe();
    expect(despues['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
    expect(despues['af_RAF4_P1']).toBeUndefined();
    expect(despues['af_RAF1_P1']).toEqual({ inodoro: 1 });
    expect(despues['af_RAF2_P1']).toEqual({ lavamanos: 1 });
  });

  it('RAF3 = carga del montante (vía RAF1) + aparato propio de RAF2, escrito con libro', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    const disk = diskDe();
    expect(disk['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
    expect(disk['af_RAF1_P1']).toEqual({ inodoro: 1 });
    // RAF2 también recibe lo que llega a la unión (inodoro) + lo propio.
    expect(disk['af_RAF2_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
    expect(leerHeredadosPresion('af_RAF3_P1')).toEqual({ inodoro: 1, lavamanos: 1 });
    expect(leerHeredadosPresion('af_RAF2_P1')).toEqual({ inodoro: 1 });
  });

  it('es idempotente: re-correr no duplica', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    expect(diskDe()['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
  });

  it('quitar el aparato de RAF2: la bajada RAF2 se vuelve receptora del inodoro (doctrina bajada)', () => {
    seedEscenario();
    propagarAparatosPresion('af');
    const disk = diskDe();
    disk['af_RAF2_P1'] = {};
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    // Doctrina bajada (2026-10-14): RAF2 vertical hacia abajo y sin carga propia recibe el
    // inodoro del montante; RAF3 (horizontal) queda vacía.
    expect(diskDe()['af_RAF2_P1']).toEqual({ inodoro: 1 });
    expect(diskDe()['af_RAF3_P1']).toBeUndefined();
    expect(leerHeredadosPresion('af_RAF2_P1')).toEqual({ inodoro: 1 });
  });

  it('_tribReversed invalida la genealogía vieja gateada por geometría', () => {
    seedEscenario();
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
    // RAF3 invertida: su cola quedó en [200,0] — la genealogía [RAF1,RAF2] ya no la toca
    // (S ya no sigue tocando la cola de RAF3) y el delta limpia.
    expect(diskDe()['af_RAF3_P1']).toBeUndefined();
    expect(leerHeredadosPresion('af_RAF3_P1')).toEqual({});
  });

  it('montante direccional: alimenta al ramal que SALE de él, no al que ENTRA', () => {
    // Variante A: RAF1 nace del montante (cola en MON1, alimentaIds) → recibe su carga
    // (inodoro del ucAplicado) y la baja a RAF3 (mergesFrom).
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [100, -100],
            [100, 0],
          ],
          ini: 'MON1',
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
          mergesFrom: ['RAF1', 'RAF2'],
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
          alimentaIds: ['RAF1'],
          ucAplicado: { af_MON1_P1: { inodoro: 1 } },
        },
      ],
    });
    propagarAparatosPresion('af');
    expect(diskDe()['af_RAF1_P1']).toEqual({ inodoro: 1 });
    // Doctrina bajada (2026-10-14): RAF2 (vertical hacia abajo, sin carga propia) es la
    // continuación receptora — el inodoro pasa por RAF1 y termina en RAF2; RAF3 vacía.
    expect(diskDe()['af_RAF2_P1']).toEqual({ inodoro: 1 });
    expect(diskDe()['af_RAF3_P1']).toBeUndefined();

    // Variante B: RAF1 ENTRA al montante (cabeza en MON1, recibeDeIds + fin=code) — el
    // montante NO alimenta (sus aparatos se quedan en él); el ramal queda vacío.
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [100, 0],
            [100, -100],
          ],
          fin: 'MON1',
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
          mergesFrom: ['RAF1', 'RAF2'],
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
          recibeDeIds: ['RAF1'],
          ucAplicado: { af_MON1_P1: { inodoro: 1 } },
        },
      ],
    });
    propagarAparatosPresion('af');
    expect(diskDe()['af_RAF1_P1']).toBeUndefined();
    expect(diskDe()['af_RAF3_P1']).toBeUndefined();
  });

  it('ciclo: termina acotado sin colgar ni duplicar', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RA',
          net: 'af',
          aparatoFin: 'lavaplatos',
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
    // Ciclo acotado (determinista): el corte en pila hace que RB cargue la BASE de RA una
    // sola vez — sin inflación. RB pinneado también (oráculo completo, auditoría #12).
    expect(diskDe()['af_RA_P1']).toEqual({ lavaplatos: 2 });
    expect(diskDe()['af_RB_P1']).toEqual({ lavaplatos: 1 });
    expect(leerHeredadosPresion('af_RA_P1')).toEqual({ lavaplatos: 1 });
    expect(leerHeredadosPresion('af_RB_P1')).toEqual({ lavaplatos: 1 });
  });

  it('plegado de tributarios es idempotente a 3 corridas (auditoría #1)', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF4',
          net: 'af',
          pts: [
            [100, 0],
            [100, -80],
          ],
        },
        {
          id: 'TIRAF4',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAF4',
          // Campo real de la asignación: aparato en el extremo de conexión (lateral #14).
          aparatoFin: 'tina',
          pts: [
            [80, -40],
            [100, -40],
          ],
        },
      ],
      bajantes: [],
    });
    const disk = diskDe();
    disk['af_TIRAF4_P1'] = { tina: 1 };
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const d = diskDe();
    // La tina vive en su clave Y plegada una sola vez en el padre — sin crecimiento.
    expect(d['af_TIRAF4_P1']).toEqual({ tina: 1 });
    expect(d['af_RAF4_P1']).toEqual({ tina: 1 });
  });

  it('tributarios anidados T2→T1→R no duplican nietos ni dependen del orden (auditoría #7)', () => {
    // Orden de inserción adverso: T1 (padre intermedio) ANTES que R en el array.
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'T1',
          net: 'af',
          tipo: 'tributario',
          padre: 'R',
          pts: [
            [50, 0],
            [60, 0],
          ],
        },
        {
          id: 'R',
          net: 'af',
          pts: [
            [60, 0],
            [120, 0],
          ],
        },
        {
          id: 'T2',
          aparatoFin: 'ducha',
          net: 'af',
          tipo: 'tributario',
          padre: 'T1',
          pts: [
            [40, 0],
            [50, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk = diskDe();
    disk['af_T2_P1'] = { ducha: 1 };
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const d = diskDe();
    expect(d['af_T2_P1']).toEqual({ ducha: 1 });
    expect(d['af_T1_P1']).toEqual({ ducha: 1 });
    expect(d['af_R_P1']).toEqual({ ducha: 1 });
  });

  it('no hay herencia cross-piso: mismo id y mismas coordenadas en P1/P2 (auditoría #2)', () => {
    const ramal = {
      id: 'RAF1',
      aparatoFin: 'ducha',
      net: 'af',
      pts: [
        [0, 0],
        [100, 0],
      ],
    };
    saveToStorage('trazos_P1', { ramales: [ramal], bajantes: [] });
    saveToStorage('trazos_P2', { ramales: [{ ...ramal }], bajantes: [] });
    const disk = diskDe();
    disk['af_RAF1_P1'] = { ducha: 1 };
    saveToStorage(AF_KEY, disk);
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const d = diskDe();
    expect(d['af_RAF1_P1']).toEqual({ ducha: 1 });
    // P2 comparte id y px exactos (copia bit-exacta): debe quedar limpio.
    expect(d['af_RAF1_P2']).toBeUndefined();
  });
});
