import { describe, it, expect, beforeEach, vi } from 'vitest';

// Renumeración de MONTANTES al eliminar: compacta (MAC1, MAC3 → MAC1, MAC2) y ARRASTRA todo
// lo que cuelga del id — extremos ini/fin de ramales (por código), punteros entre pisos,
// claves de UDs del montante y la clave del LDesvio. Antes solo renombraba id/code y dejaba
// punteros y aparatos huérfanos (orig. usuario).

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

vi.stubGlobal('window', { dispatchEvent: () => {}, addEventListener: () => {} });

import { saveToStorage, loadFromStorage } from '../../../services/almacenamientoServicio.ts';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../../../constants/almacenamientoClaves.ts';
import { _renumberMontantes } from '../redRenumera.ts';
import type { IPlanoEngineCore } from '../PlanoEstado.ts';

function makeEngine(): IPlanoEngineCore {
  return {
    bajantes: [
      { id: 'MAC1_ac', code: 'MAC1', net: 'ac', tipo: 'montante', x: 0, y: 0 },
      { id: 'MAC2_ac', code: 'MAC2', net: 'ac', tipo: 'montante', x: 30, y: 30 },
      { id: 'MAC3_ac', code: 'MAC3', net: 'ac', tipo: 'montante', x: 60, y: 60 },
    ],
    ramales: [
      // El ramal ancla su extremo al CÓDIGO del montante (así escribe la creación).
      {
        id: 'RAC9',
        net: 'ac',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [10, 0],
        ],
        ini: 'MAC2',
      },
      // El LDesvio del MAC2 vive como ramal LD_.
      {
        id: 'LD_MAC2_ac',
        net: 'ac',
        tipo: 'ramal',
        pts: [
          [30, 30],
          [40, 40],
        ],
      },
    ],
    crossFloorGhosts: [],
    _loadedPlanId: '1',
  } as unknown as IPlanoEngineCore;
}

describe('_renumberMontantes: compacta y arrastra referencias', () => {
  it('al eliminar el MAC1, MAC2→MAC1 y MAC3→MAC2 sin perder ni una referencia', () => {
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      ac_MAC2_ac_1: { lvp: 2 },
      ac_LD_MAC2_ac_1: { duc: 1 },
      ac_MAC3_ac_1: { tin: 4 },
    });
    saveToStorage(HYDRO_DATA_STORAGE_KEY, { ac_MAC2_ac_1: { accesorios: { codo90: 3 } } });

    const eng = makeEngine();
    // "Eliminar" el MAC1 (el caller ya lo sacó; aquí compacta los restantes).
    eng.bajantes = eng.bajantes.filter((b) => b.id !== 'MAC1_ac');
    _renumberMontantes(eng);

    const ids = eng.bajantes.map((b) => (b as { id: string }).id).sort();
    expect(ids).toEqual(['MAC1_ac', 'MAC2_ac']);
    const codes = eng.bajantes.map((b) => (b as { code: string }).code).sort();
    expect(codes).toEqual(['MAC1', 'MAC2']);

    // El ex-MAC2 (hoy MAC1) arrastra sus extremos de ramal.
    const r9 = eng.ramales.find((r) => r.id === 'RAC9') as unknown as { ini?: string };
    expect(r9.ini).toBe('MAC1');
    // Y su LDesvio sigue el renombre del id.
    expect(eng.ramales.some((r) => (r as { id: string }).id === 'LD_MAC1_ac')).toBe(true);
    expect(eng.ramales.some((r) => (r as { id: string }).id === 'LD_MAC2_ac')).toBe(false);

    // Claves de UDs movidas (aparatos, LD e hidráulica) — nada viejo colgando.
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    expect(apos['ac_MAC1_ac_1']).toEqual({ lvp: 2 });
    expect(apos['ac_LD_MAC1_ac_1']).toEqual({ duc: 1 });
    expect(apos['ac_MAC2_ac_1']).toEqual({ tin: 4 });
    expect(apos['ac_MAC3_ac_1']).toBeUndefined();
    const hidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
    expect(hidro['ac_MAC1_ac_1']).toBeDefined();
    expect(hidro['ac_MAC2_ac_1']).toBeUndefined();
  });
});
