import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pines del movimiento 5 (rediseño FixturesPanel): currentMapDe por rama — af/ac (clave ya
// propagada), gas con unión (suma de patas), espejo de salida (agregado del dueño), sin target.

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

import { currentMapDe, type TargetArgs } from '../../components/fixtures/useFixtureTarget';

const PLAN = 5;

function base(overrides: Partial<TargetArgs> = {}): TargetArgs {
  return {
    netId: 'af',
    storageKey: `af_RAF1_${PLAN}`,
    targetId: 'RAF1',
    mergeKeys: null,
    isBajanteSan: false,
    planId: PLAN,
    selElement: null,
    counts: { [`af_RAF1_${PLAN}`]: { inodoro: 1 } },
    hidroData: {},
    plans: [{ id: String(PLAN), nivel: 1 }],
    engineRef: {
      current: {
        ramales: [],
        bajantes: [],
        _loadedPlanId: PLAN,
      },
    } as unknown as TargetArgs['engineRef'],
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set(),
    ...overrides,
  };
}

describe('currentMapDe (pines movimiento 5)', () => {
  it('sin storageKey → {}', () => {
    expect(currentMapDe(base({ storageKey: null }))).toEqual({});
  });

  it('af: la clave YA trae la carga propagada → own sin merges (lee storage vivo)', () => {
    // La lectura es VIVA de storage (orig. usuario: 1ª selección tras reingresar mostraba
    // el arranque rancio) — sembrar el disco antes de medir.
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({
        [`af_RAF1_${PLAN}`]: { inodoro: 1 },
        [`af_RAF2_${PLAN}`]: { lavamanos: 2 },
      }),
    );
    const a = base({
      counts: {
        [`af_RAF1_${PLAN}`]: { inodoro: 1 },
        [`af_RAF2_${PLAN}`]: { lavamanos: 2 },
      },
      mergeKeys: [`af_RAF2_${PLAN}`],
    });
    expect(currentMapDe(a)).toEqual({ inodoro: 1 });
  });

  it('gas con unión: suma las patas (sin propagación)', () => {
    const a = base({
      netId: 'gas',
      storageKey: `gas_RG1_${PLAN}`,
      targetId: 'RG1',
      counts: {
        [`gas_RG1_${PLAN}`]: { estufa: 1 },
        [`gas_RG2_${PLAN}`]: { estufa: 2 },
      },
      mergeKeys: [`gas_RG2_${PLAN}`],
    });
    expect(currentMapDe(a)).toEqual({ estufa: 3 });
  });

  it('salida espejo de un bajante: muestra el agregado del DUEÑO, no la clave propia', () => {
    const engine = {
      ramales: [],
      bajantes: [{ id: 'BAN1', net: 'san', tipo: 'bajante', x: 40, y: 0 }],
      _loadedPlanId: PLAN,
    };
    const a = base({
      netId: 'san',
      isBajanteSan: false,
      storageKey: `san_RS9_${PLAN}`,
      targetId: 'RS9',
      counts: { [`san_RS9_${PLAN}`]: { basura: 9 } },
      engineRef: { current: engine } as unknown as TargetArgs['engineRef'],
      exitsDeBajante: (bajId) => (bajId === 'BAN1' ? new Set(['RS9']) : new Set()),
      agregadoBajante: (bajId): Record<string, number> => (bajId === 'BAN1' ? { inodoro: 1 } : {}),
    });
    expect(currentMapDe(a)).toEqual({ inodoro: 1 });
  });
});
