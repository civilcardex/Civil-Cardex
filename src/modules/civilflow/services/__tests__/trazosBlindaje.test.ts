import { describe, it, expect, beforeEach, vi } from 'vitest';

// Blindaje contra la pérdida de datos "todo se borró excepto un piso": el RPC save_plano_data
// es destructivo (borra y re-inserta TODAS las colecciones del piso), así que cada escritor
// que guarde un documento vacío/parcial con ts fresco borra el piso en BD y el árbitro de
// carga (mayor ts gana) lo consolida. Estas pruebas cubren los invariantes nuevos:
// 1. Tumba: push a BD sin contenido sobre caché local con contenido → bloqueado.
// 2. Árbitro: BD sin contenido jamás gana a caché local con contenido.
// 3. Migración/ghosts/Ldesvio no fabrican documentos sobre pisos sin caché.
// 4. El prefetch recupera de BD los pisos sin caché (fetch ANTES de migrar).
// 5. clearBajanteAssociation no escribe null sobre la clave del piso destino.

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: mockRpc,
  },
}));

import { saveTrazosToDB, trazosDocHasContent, trazosLocalGanaABdVacia } from '../storageService';
import { writeCrossFloorGhost, createCrossFloorLdesvioRamal } from '../../utils/crossFloorStorage';
import { migrateAssocLayoutOnLoad, markAssocLayout } from '../../utils/assocLayoutMigration';
import { prefetchAllTrazos } from '../../utils/prefetchTrazos';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';

function resetStorage() {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));
const getLS = (k: string) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(k);

const ghost = {
  id: 'XFG_BAN1_777',
  net: 'san',
  code: 'BAN1',
  x: 100,
  y: 80,
  dNominal: '4"',
  direccion: 'sube' as const,
  piso: 'P2',
  sourcePlanId: '1',
  sourceBajanteId: 'BAN1',
};

beforeEach(() => {
  resetStorage();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('trazosDocHasContent', () => {
  it('true con alguna colección con elementos', () => {
    expect(trazosDocHasContent({ ramales: [{ id: 'R1' }] })).toBe(true);
    expect(trazosDocHasContent({ bajantes: [{ id: 'B1' }] })).toBe(true);
    expect(trazosDocHasContent({ crossFloorGhosts: [{}] })).toBe(true);
    expect(trazosDocHasContent({ guideLines: [{ id: 'G1' }] })).toBe(true);
  });

  it('false con colecciones vacías, doc vacío, null o string legado', () => {
    expect(trazosDocHasContent({ ramales: [], bajantes: [] })).toBe(false);
    expect(trazosDocHasContent({})).toBe(false);
    expect(trazosDocHasContent(null)).toBe(false);
    expect(trazosDocHasContent('trazos legacy')).toBe(false);
  });
});

describe('árbitro: la local gana sobre BD sin contenido', () => {
  it('local con contenido vs BD vacía → gana local (aunque la BD tenga ts mayor)', () => {
    expect(trazosLocalGanaABdVacia({ ramales: [{ id: 'R1' }], ts: 100 }, { ts: 999 })).toBe(true);
  });
  it('BD con contenido → regla no aplica (manda el ts)', () => {
    expect(trazosLocalGanaABdVacia({ ramales: [{ id: 'R1' }] }, { ramales: [{ id: 'R2' }] })).toBe(
      false,
    );
  });
  it('local vacía o ausente → regla no aplica', () => {
    expect(trazosLocalGanaABdVacia({ ramales: [] }, {})).toBe(false);
    expect(trazosLocalGanaABdVacia(null, {})).toBe(false);
  });
});

describe('tumba anti-vacío en saveTrazosToDB', () => {
  it('push vacío sobre caché local CON contenido → abortado (la BD no se toca)', async () => {
    setLS('civilflow_trazos_501', { ramales: [{ id: 'R1' }], bajantes: [], ts: 1 });
    await saveTrazosToDB('501', { ramales: [], bajantes: [], ts: Date.now() });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('push con contenido sí llega a la BD', async () => {
    // clave cruda (getActiveProyectoId lee el raw y hace Number)
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'civilflow_active_proyecto_id',
      '111',
    );
    setLS('civilflow_trazos_501', { ramales: [{ id: 'R1' }] });
    await saveTrazosToDB('501', { ramales: [{ id: 'R1' }], bajantes: [], ts: Date.now() });
    expect(mockRpc).toHaveBeenCalledWith(
      'save_plano_data',
      expect.objectContaining({ p_plano_id: 501 }),
    );
  });

  it('borrado legítimo converge: caché ya sin contenido → el push vacío pasa', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'civilflow_active_proyecto_id',
      '111',
    );
    setLS('civilflow_trazos_501', { origen: 1 }); // sin colecciones: no es contenido
    await saveTrazosToDB('501', { ramales: [], bajantes: [], ts: Date.now() });
    expect(mockRpc).toHaveBeenCalled();
  });
});

describe('escritores de asociación sobre piso SIN caché local', () => {
  it('migrateAssocLayoutOnLoad no fabrica documento', () => {
    migrateAssocLayoutOnLoad('777', 'P1');
    expect(getLS('civilflow_trazos_777')).toBeNull();
  });

  it('markAssocLayout no fabrica documento', () => {
    markAssocLayout('777');
    expect(getLS('civilflow_trazos_777')).toBeNull();
  });

  it('writeCrossFloorGhost no fabrica documento', () => {
    writeCrossFloorGhost('777', ghost);
    expect(getLS('civilflow_trazos_777')).toBeNull();
  });

  it('createCrossFloorLdesvioRamal no fabrica documento', () => {
    createCrossFloorLdesvioRamal('777', 'BAN1', 'san', 0, 0, 10, 10, '4"', 1);
    expect(getLS('civilflow_trazos_777')).toBeNull();
  });

  it('con caché presente el comportamiento normal se conserva (ghost + ramales intactos)', () => {
    setLS('civilflow_trazos_777', { ramales: [{ id: 'R1', net: 'san' }], bajantes: [] });
    writeCrossFloorGhost('777', ghost);
    markAssocLayout('777');
    const doc = JSON.parse(getLS('civilflow_trazos_777') || '{}');
    expect(doc.crossFloorGhosts).toHaveLength(1);
    expect(doc.ramales).toHaveLength(1);
    expect(doc.assocLayout).toBe(2);
  });
});

describe('prefetch: fetch de BD ANTES de migrar', () => {
  it('piso sin caché recupera sus trazos de la BD y la migración no los borra', async () => {
    setLS('civilflow_active_proyecto_id', '111');
    mockRpc.mockImplementation(async (name: string) =>
      name === 'get_plano_data'
        ? {
            data: {
              plano: { version: 6, ts: '2026-09-12T00:00:00Z' },
              ramales: [
                {
                  client_id: 'R1',
                  net: 'san',
                  tipo: 'ramal',
                  pts: [
                    [0, 0],
                    [5, 5],
                  ],
                },
              ],
              bajantes: [],
            },
            error: null,
          }
        : { data: null, error: null },
    );
    await prefetchAllTrazos([{ id: 888, nivel: 1, status: 'confirmed' }] as unknown as Parameters<
      typeof prefetchAllTrazos
    >[0]);
    const doc = JSON.parse(getLS('civilflow_trazos_888') || '{}');
    expect(doc.ramales?.map((r: { id: string }) => r.id)).toContain('R1');
    expect(doc.assocLayout).toBe(2);
  });
});

describe('clearBajanteAssociation con libro vivo y sin caché del piso destino', () => {
  it('no escribe null en la clave del trazos destino', () => {
    const eng = {
      _loadedPlanId: '2',
      bajantes: [{ id: 'BAN1', ucAcum: 5, ucAplicado: { san_T1_2: { ino: 2 } } }],
      ramales: [],
      crossFloorGhosts: [],
      updateElementById: () => {},
    };
    clearBajanteAssociation(
      eng as unknown as Parameters<typeof clearBajanteAssociation>[0],
      '1',
      'BAN1',
      'san',
      '2|BAN1',
      [{ id: '1' }, { id: '2' }],
    );
    expect(getLS('civilflow_trazos_2')).toBeNull();
  });
});
