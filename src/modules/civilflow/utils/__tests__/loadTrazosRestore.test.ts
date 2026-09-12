import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async () => ({
      error: null,
      data: {
        plano: {},
        bajantes: [],
        ramales: [
          { client_id: 'TX', net: 'san', tipo: 'tributario', fixtures: { lvm: 1 } },
          { client_id: 'RS1', net: 'san', tipo: 'ramal', fixtures: {} },
        ],
      },
    }),
  },
}));

import { loadTrazosFromDB } from '../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';

// Restauración (orig. usuario piso 2): al abrir, los fixtures que viajan en la BD rellenan
// las claves AUSENTES del store local — sin pisar las existentes. Con el GC endurecido la
// clave restaurada ya no se vuelve a borrar.

function resetLS(seed: Record<string, unknown> = {}) {
  const m = new Map<string, string>(
    Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)] as [string, string]),
  );
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
    key: (_i: number) => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const lsGet = (k: string) =>
  JSON.parse((globalThis.localStorage.getItem('civilflow_' + k) || '{}') as string) as Record<
    string,
    unknown
  >;

describe('loadTrazosFromDB restaura fixtures ausentes', () => {
  beforeEach(() => {
    resetLS();
    const g = globalThis as Record<string, unknown>;
    if (!g.window) g.window = new EventTarget();
  });

  it('clave de trib borrada + fixtures en BD → se restaura; existente no se pisa', async () => {
    resetLS({ ['civilflow_' + APARATOS_BY_TRAMO_KEY]: { san_RS1_12: { san: 9 } } });
    const work = await loadTrazosFromDB('12');
    expect(work).not.toBeNull();
    const counts = lsGet(APARATOS_BY_TRAMO_KEY);
    expect(counts['san_TX_12']).toEqual({ lvm: 1 });
    expect(counts['san_RS1_12']).toEqual({ san: 9 });
  });
});
