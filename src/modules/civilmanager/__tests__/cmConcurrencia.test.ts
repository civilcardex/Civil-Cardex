import { describe, it, expect, beforeEach, vi } from 'vitest';

// Concurrencia optimistic de cm_save_state (quick-win del reporte 2026-11-17): el cliente
// manda p_updated_at = el reloj leído al cargar; la RPC rechaza con 'conflicto_concurrencia'
// si la BD tiene uno mayor → el cliente lo mapea a mensaje accionable (no last-write-wins).
const rpc = vi.hoisted(() => ({
  resultado: null as null | { data: unknown; error: { message: string } | null },
  captured: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.captured.push({ fn, args });
      if (rpc.resultado) return rpc.resultado;
      // cm_get_data: un proyecto activo con su reloj; cm_save_state: OK.
      if (fn === 'cm_get_data') {
        return {
          data: {
            proyectos: [
              { id: '11111111-1111-4111-8111-111111111111', updated_at: '2026-01-02T10:00:00Z' },
            ],
            config: {},
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));

import { civilManagerSave, defaultState } from '../storage.ts';
import { lastCmUpdatedAtLeido, loadFromSupabase } from '../storage/rpc.ts';

const PROYECTO = '11111111-1111-4111-8111-111111111111';

function resetLS(withProject: boolean) {
  const m = new Map<string, string>();
  if (withProject) {
    m.set('cm_proyecto_activo_id', PROYECTO);
    m.set('cm_proyecto_activo_nombre', 'P');
  }
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
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

describe('concurrencia optimistic en cm_save_state', () => {
  beforeEach(() => {
    resetLS(true);
    rpc.resultado = null;
    rpc.captured.length = 0;
  });

  it('la carga guarda el reloj del proyecto activo y el save lo manda como p_updated_at', async () => {
    await loadFromSupabase();
    expect(lastCmUpdatedAtLeido()).toBe('2026-01-02T10:00:00Z');
    rpc.captured.length = 0;
    await civilManagerSave(defaultState());
    const save = rpc.captured.find((c) => c.fn === 'cm_save_state')!;
    expect(save.args.p_updated_at).toBe('2026-01-02T10:00:00Z');
  });

  it('conflicto (BD más nueva que lo leído) → mensaje accionable, no el crudo del RPC', async () => {
    await loadFromSupabase();
    rpc.resultado = { data: null, error: { message: 'conflicto_concurrencia' } };
    await expect(civilManagerSave(defaultState())).rejects.toThrow(/Otro dispositivo/i);
  });

  it('tras un guardado OK el reloj se resetea (sin check hasta la próxima carga)', async () => {
    await loadFromSupabase();
    await civilManagerSave(defaultState());
    expect(lastCmUpdatedAtLeido()).toBeNull();
    rpc.captured.length = 0;
    await civilManagerSave(defaultState());
    const save = rpc.captured.find((c) => c.fn === 'cm_save_state')!;
    expect(save.args.p_updated_at).toBeNull();
  });
});
