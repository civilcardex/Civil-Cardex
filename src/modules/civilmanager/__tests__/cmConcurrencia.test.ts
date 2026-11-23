import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  civilManagerLoad,
  civilManagerResolverConflicto,
  civilManagerSave,
  defaultState,
  saveCmDraft,
} from '../storage.ts';
import type { CivilManagerState } from '../types.ts';
import type { CmStorageScope } from '../storage/session.ts';

const first = '2026-01-02T10:00:00Z';
const committed = '2026-01-02T10:01:00Z';
const remote = '2026-01-02T12:00:00Z';
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
  // Archivar = mover la entrada a la clave de rescate (la nube vuelve a mandar).
  archivarBorradorPendiente: async (value: CmStorageScope) => {
    const actual = drafts.get(key(value));
    if (actual) {
      drafts.set(`rescate_${key(value)}`, actual);
      drafts.delete(key(value));
    }
  },
  hayRespaldoLegado: async () => false,
}));

describe('versiones y respaldo de CivilManager', () => {
  beforeEach(async () => {
    drafts.clear();
    rpc.mockReset();
    rpc.mockResolvedValueOnce({
      data: { proyectos: [{ id: scope.proyectoId, updated_at: first }], config: {} },
      error: null,
    });
    await civilManagerLoad(scope);
  });

  it('el segundo guardado usa la versión confirmada por el primero', async () => {
    rpc.mockResolvedValue({ data: committed, error: null });
    await Promise.all([
      civilManagerSave(defaultState(), scope),
      civilManagerSave(defaultState(), scope),
    ]);
    expect(rpc.mock.calls.slice(1).map(([fn, args]) => [fn, args.p_updated_at])).toEqual([
      ['cm_save_state_versioned', first],
      ['cm_save_state_versioned', committed],
    ]);
    expect(drafts.get(key(scope))?.pending).toBe(false);
  });

  it('el conflicto conserva el borrador con su versión base y no reemplaza la copia remota', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'conflicto_concurrencia' } });
    const draft = defaultState();
    await expect(civilManagerSave(draft, scope)).rejects.toThrow(/Otro dispositivo/i);
    expect(drafts.get(key(scope))).toMatchObject({ state: draft, pending: true, version: first });
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });
    expect(await civilManagerLoad(scope)).toBe(draft);
    await expect(civilManagerLoad({ ...scope, userId: 'u2' })).rejects.toThrow(/sin conexión/);
    await expect(civilManagerLoad({ ...scope, proyectoId: 'otro' })).rejects.toThrow(
      /sin conexión/,
    );
  });

  it('la confirmación de un guardado en vuelo no reemplaza un borrador más reciente', async () => {
    let confirm!: (result: { data: string; error: null }) => void;
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
    confirm({ data: committed, error: null });
    await saving;
    expect(drafts.get(key(scope))).toMatchObject({
      state: newer,
      pending: true,
      version: committed,
    });
  });

  it('resolver «nube» archiva el borrador y deja la versión remota como base', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'conflicto_concurrencia' } });
    const draft = defaultState();
    await expect(civilManagerSave(draft, scope)).rejects.toThrow(/Otro dispositivo/);
    rpc.mockResolvedValueOnce({
      data: { proyectos: [{ id: scope.proyectoId, updated_at: remote }], config: {} },
      error: null,
    });
    const estado = await civilManagerResolverConflicto(scope, 'nube');
    expect(estado).not.toBeNull();
    // La entrada activa quedó limpia (nube manda) y el borrador sobrevive bajo la rescate
    // con la versión base con la que chocó (sin comparar el estado entero: defaultState()
    // regenera UUIDs aleatorios por instancia).
    expect(drafts.get(key(scope))).toMatchObject({ pending: false, version: remote });
    expect(drafts.get(`rescate_${key(scope)}`)).toMatchObject({ pending: true, version: first });
    // El reloj quedó en la versión remota: el siguiente save ya no choca.
    rpc.mockResolvedValueOnce({ data: `${remote}+`, error: null });
    await civilManagerSave(defaultState(), scope);
    expect(rpc.mock.calls.at(-1)?.[1].p_updated_at).toBe(remote);
  });

  it('resolver «borrador» fuerza cm_save_state sin reloj y confirma su versión', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'conflicto_concurrencia' } });
    const draft = defaultState();
    await expect(civilManagerSave(draft, scope)).rejects.toThrow(/Otro dispositivo/);
    rpc.mockImplementationOnce(async (fn: string, args: Record<string, unknown>) => {
      expect(fn).toBe('cm_save_state');
      expect(args.p_updated_at).toBeUndefined();
      return { data: null, error: null };
    });
    rpc.mockResolvedValueOnce({
      data: { proyectos: [{ id: scope.proyectoId, updated_at: committed }], config: {} },
      error: null,
    });
    const estado = await civilManagerResolverConflicto(scope, 'borrador');
    expect(estado).not.toBeNull();
    expect(drafts.get(key(scope))).toMatchObject({
      state: draft,
      pending: false,
      version: committed,
    });
  });
});
