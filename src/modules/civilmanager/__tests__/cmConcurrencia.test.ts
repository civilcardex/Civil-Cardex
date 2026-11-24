import { beforeEach, describe, expect, it, vi } from 'vitest';
import { civilManagerLoad, civilManagerSave, defaultState, saveCmDraft } from '../storage.ts';
import type { CivilManagerState } from '../types.ts';
import type { CmStorageScope } from '../storage/session.ts';

const scope = { userId: 'u1', proyectoId: '11111111-1111-4111-8111-111111111111' };
const { rpc, drafts } = vi.hoisted(() => ({
  rpc: vi.fn(),
  drafts: new Map<string, { state: CivilManagerState; version: string | null; pending: boolean }>(),
}));
const key = (value: CmStorageScope) => `${value.userId}:${value.proyectoId}`;
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../storage/session.ts', () => ({
  cmScopeKey: (value: CmStorageScope) => `${value.userId}:${value.proyectoId}`,
  captureCmScope: async () => scope,
}));
vi.mock('../storage/idb.ts', () => ({
  loadFromIdb: async (value: CmStorageScope) => drafts.get(key(value)) ?? null,
  saveToIdb: async (
    value: CmStorageScope,
    state: CivilManagerState,
    version: string | null,
    pending: boolean,
  ) => drafts.set(key(value), { state, version, pending }),
  borradorPendiente: async (value: CmStorageScope) => drafts.get(key(value))?.pending ?? false,
  hayRespaldoLegado: async () => false,
}));

describe('guardado LWW de CivilManager (el local siempre pisa la nube)', () => {
  beforeEach(async () => {
    drafts.clear();
    rpc.mockReset();
    rpc.mockResolvedValueOnce({
      data: {
        proyectos: [{ id: scope.proyectoId, updated_at: '2026-01-02T10:00:00Z' }],
        config: {},
      },
      error: null,
    });
    await civilManagerLoad(scope);
  });

  it('cada guardado llama cm_save_state SIN reloj y deja el borrador confirmado', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await Promise.all([
      civilManagerSave(defaultState(), scope),
      civilManagerSave(defaultState(), scope),
    ]);
    const saves = rpc.mock.calls
      .slice(1)
      .filter(([fn]) => fn === 'cm_save_state')
      .map(([, args]) => args);
    expect(saves).toHaveLength(2);
    for (const args of saves) {
      expect('p_updated_at' in args).toBe(false); // sin reloj: LWW, nunca choca
    }
    expect(drafts.get(key(scope))?.pending).toBe(false);
  });

  it('un error de red rechaza pero el borrador queda pendiente y la carga lo recupera', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });
    const draft = defaultState();
    await expect(civilManagerSave(draft, scope)).rejects.toThrow(/sin conexión/);
    expect(drafts.get(key(scope))).toMatchObject({ state: draft, pending: true });
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });
    expect(await civilManagerLoad(scope)).toBe(draft);
    await expect(civilManagerLoad({ ...scope, userId: 'u2' })).rejects.toThrow(/sin conexión/);
    await expect(civilManagerLoad({ ...scope, proyectoId: 'otro' })).rejects.toThrow(
      /sin conexión/,
    );
  });

  it('la confirmación de un guardado en vuelo no reemplaza un borrador más reciente', async () => {
    let confirm!: (result: { data: null; error: null }) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const saving = civilManagerSave(defaultState(), scope);
    await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
    const newer = defaultState();
    newer.config.salario_base += 100;
    await saveCmDraft(scope, newer);
    confirm({ data: null, error: null });
    await saving;
    expect(drafts.get(key(scope))).toMatchObject({ state: newer, pending: true });
  });
});
