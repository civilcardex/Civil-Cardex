import { describe, it, expect, beforeEach, vi } from 'vitest';

// Concurrencia optimistic del guardado de trazos (quick-win 2026-11-17, fixes H-01/H-02/H-04):
// 1. El reloj updated_at es POR PLANO (la cola serializa por plano pero los planos distintos
//    se guardan en paralelo — una global mezclaba relojes entre saves concurrentes).
// 2. Firma vieja en BD (PGRST202, migración 20261118000001 sin aplicar) → un solo retry sin
//    reloj degrada la sesión entera en vez de tumbar cada autosave.
// 3. conflicto_concurrencia → reloj fuera + aviso UNA sola vez por plano/sesión.
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: mockRpc,
  },
}));

import { saveTrazosToDB, loadTrazosFromDB, setActiveProyectoId } from '../storageService.ts';
import { resetConcurrenciaParaTest } from '../storage/strokesDb.ts';

const UUID = '11111111-1111-4111-8111-111111111111';

function resetStorage() {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

const docA = { ramales: [{ id: 'r1', net: 'san' }], bajantes: [], areas: [] };

describe('reloj de concurrencia por plano en save_plano_data', () => {
  beforeEach(() => {
    resetStorage();
    mockRpc.mockReset();
    // El save exige proyecto activo (guard 'sin-proyecto'); setActiveProyectoId fija la
    // sesión en memoria (getActiveProyectoId cachea la 1.ª lectura de LS).
    setActiveProyectoId(UUID);
    resetConcurrenciaParaTest();
  });

  it('el save de un plano viaja con el reloj LEÍDO de ese plano (no del último cargado)', async () => {
    mockRpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'get_plano_data') {
        // Plano 1 con reloj viejo; plano 2 con reloj más nuevo (se carga DESPUÉS).
        return {
          data: {
            plano: {
              updated_at: args.p_plano_id === 1 ? '2026-01-01T00:00:00Z' : '2026-06-01T00:00:00Z',
            },
            ramales: [],
            bajantes: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    await loadTrazosFromDB('1');
    await loadTrazosFromDB('2');
    // Guardar el plano 1: su reloj es el de ENERO, no el de junio del plano 2.
    await saveTrazosToDB('1', docA);
    const save1 = mockRpc.mock.calls.find((c) => c[0] === 'save_plano_data')!;
    expect(save1[1].p_updated_at).toBe('2026-01-01T00:00:00Z');
  });

  it('tras un save OK el reloj del plano se limpia (el próximo autosave no choca consigo mismo)', async () => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'get_plano_data'
        ? {
            data: { plano: { updated_at: '2026-01-01T00:00:00Z' }, ramales: [], bajantes: [] },
            error: null,
          }
        : { data: null, error: null },
    );
    await loadTrazosFromDB('1');
    await saveTrazosToDB('1', docA);
    await saveTrazosToDB('1', docA);
    const saves = mockRpc.mock.calls.filter((c) => c[0] === 'save_plano_data');
    expect(saves[0][1].p_updated_at).toBe('2026-01-01T00:00:00Z');
    expect(saves[1][1].p_updated_at).toBeNull();
  });

  it('PGRST202 (firma sin migrar) → un solo retry sin reloj y el resto de la sesión sin check', async () => {
    mockRpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'get_plano_data')
        return {
          data: { plano: { updated_at: '2026-01-01T00:00:00Z' }, ramales: [], bajantes: [] },
          error: null,
        };
      if ('p_updated_at' in args)
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message:
              'Could not find the function public.save_plano_data(bigint, jsonb, timestamptz) in the schema cache',
          },
        };
      return { data: null, error: null };
    });
    await loadTrazosFromDB('1');
    await saveTrazosToDB('1', docA); // choca con la firma vieja → retry → OK
    await saveTrazosToDB('1', docA); // sesión ya degradada: directo sin reloj, sin error
    const saves = mockRpc.mock.calls.filter((c) => c[0] === 'save_plano_data');
    expect(saves).toHaveLength(3);
    expect('p_updated_at' in saves[0][1]).toBe(true);
    expect('p_updated_at' in saves[1][1]).toBe(false);
    expect('p_updated_at' in saves[2][1]).toBe(false);
  });

  it('conflicto_concurrencia: reloj fuera y aviso emitido UNA sola vez por plano', async () => {
    mockRpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'get_plano_data')
        return {
          data: { plano: { updated_at: '2026-01-01T00:00:00Z' }, ramales: [], bajantes: [] },
          error: null,
        };
      if ('p_updated_at' in args)
        return { data: null, error: { code: 'P0001', message: 'conflicto_concurrencia' } };
      return { data: null, error: null };
    });
    await loadTrazosFromDB('1');
    await saveTrazosToDB('1', docA); // conflicto → aviso
    await saveTrazosToDB('1', docA); // sin reloj → pasa (no vuelve a avisar)
    const saves = mockRpc.mock.calls.filter((c) => c[0] === 'save_plano_data');
    expect(saves).toHaveLength(2);
    expect(saves[1][1].p_updated_at).toBeNull();
  });

  it('carga fallida limpia el reloj previo del plano (sin conflicto espurio)', async () => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'get_plano_data'
        ? {
            data: { plano: { updated_at: '2026-01-01T00:00:00Z' }, ramales: [], bajantes: [] },
            error: null,
          }
        : { data: null, error: null },
    );
    await loadTrazosFromDB('1');
    // Segunda carga falla (RPC error): el reloj del intento anterior debe desaparecer.
    mockRpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'boom' } }));
    await loadTrazosFromDB('1');
    await saveTrazosToDB('1', docA);
    const save = mockRpc.mock.calls.find((c) => c[0] === 'save_plano_data')!;
    expect(save[1].p_updated_at).toBeNull();
  });
});
