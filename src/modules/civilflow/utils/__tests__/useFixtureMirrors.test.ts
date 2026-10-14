import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pin de idempotencia del movimiento 4: correrEspejos DOBLE corrida = mismo disco
// (claves de salidas + libros) — bajante con carga propia, ramal de salida espejo.

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
const eventos: string[] = [];
vi.stubGlobal('window', {
  dispatchEvent: (e: Event) => {
    eventos.push(e.type);
  },
  setTimeout: (fn: () => void) => {
    fn();
    return 0;
  },
  clearTimeout: () => {},
});

import { saveToStorage } from '../../services/storageService';
import {
  correrEspejos,
  correrSanadoSifones,
  type EspejosArgs,
} from '../../components/fixtures/useFixtureMirrors';
import { loadAll } from '../../components/fixturesStorage';

const PLAN = 5;
const TRAZOS_KEY = `trazos_${PLAN}`;

function baseArgs(counts: Record<string, Record<string, number>>): EspejosArgs {
  const raf1 = {
    id: 'RS1',
    label: 'RS1',
    net: 'san',
    tipo: 'ramal',
    pts: [
      [0, 0],
      [40, 0],
    ],
    uc: 1,
  };
  const ban1 = {
    id: 'BAN1',
    code: 'BAN1',
    net: 'san',
    tipo: 'bajante',
    x: 40,
    y: 0,
    dNominal: '4"',
  };
  const engine = {
    ramales: [raf1],
    bajantes: [ban1],
    _loadedPlanId: PLAN,
  };
  return {
    engineRef: { current: engine } as EspejosArgs['engineRef'],
    loadingPlanRef: { current: false } as EspejosArgs['loadingPlanRef'],
    netId: 'san',
    planId: PLAN,
    plans: [{ id: String(PLAN), nivel: 1, status: 'confirmed' }],
    planLoadedTick: 0,
    targetId: null,
    counts,
    setCounts: () => {},
    hidroData: {},
    setHidroData: () => {},
    agregadoBajante: (bajId: string): Record<string, number> =>
      bajId === 'BAN1' ? { inodoro: 1 } : {},
    exitsDeBajante: (bajId: string) => (bajId === 'BAN1' ? new Set(['RS1']) : new Set()),
  };
}

describe('correrEspejos (pin idempotencia movimiento 4)', () => {
  it('doble corrida = mismo disco (espejo de salida estable, sin inflación)', () => {
    saveToStorage(TRAZOS_KEY, { ramales: [], bajantes: [] });
    const counts = { [`san_RS1_${PLAN}`]: { inodoro: 1 } };
    const a = baseArgs(counts);
    correrEspejos(a);
    const despues1 = JSON.stringify(loadAll());
    expect(loadAll()[`san_RS1_${PLAN}`]).toEqual({ inodoro: 1 });
    correrEspejos(a);
    expect(JSON.stringify(loadAll())).toBe(despues1);
  });

  it('sanado de sifones: reconcilia el conteo con los glifos y es idempotente', () => {
    const a = baseArgs({});
    // glifo sifón en accesorioFin, conteo desincronizado (0): el sanado escribe 1.
    (
      a.engineRef.current as unknown as { ramales: Array<Record<string, unknown>> }
    ).ramales[0].accesorioFin = 'sifon';
    correrSanadoSifones(a);
    expect(loadAll()[`san_RS1_${PLAN}`]?.['sif']).toBe(1);
    const despues1 = JSON.stringify(loadAll());
    correrSanadoSifones(a);
    expect(JSON.stringify(loadAll())).toBe(despues1);
  });
});
