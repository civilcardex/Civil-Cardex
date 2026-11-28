import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  civilManagerLoad,
  civilManagerSave,
  defaultState,
  guardarCmSalida,
  saveCmDraft,
} from '../storage.ts';
import type { CivilManagerState } from '../types.ts';
import type { CmStorageScope } from '../storage/session.ts';

const scope = { userId: 'u1', proyectoId: '11111111-1111-4111-8111-111111111111' };
const { rpc, drafts } = vi.hoisted(() => ({
  rpc: vi.fn(),
  drafts: new Map<
    string,
    { state: CivilManagerState; version: string | null; pending: boolean; scope: string[] | null }
  >(),
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
    scope: string[] | null = null,
  ) => drafts.set(key(value), { state, version, pending, scope }),
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

  // ── G1 (plan 2026-11-27): alcance del borrador recuperado ──

  /** Snapshot remoto configurable: lo devuelve el SIGUIENTE loadFromSupabase. */
  function remotoCon(equipos: Array<Record<string, unknown>>) {
    return {
      proyectos: [{ id: scope.proyectoId, updated_at: '2026-01-03T10:00:00Z' }],
      config: {},
      equipos: equipos.map((e) => ({ user_id: 'u2', proyecto_id: scope.proyectoId, ...e })),
    };
  }

  it('H-01: dos clientes en colecciones distintas conservan AMBOS cambios', async () => {
    // B edita insumos y queda pendiente (su alcance: solo insumos).
    const borradorB = defaultState();
    borradorB.insumos = [
      {
        id: 'iB',
        codigo: 'IN-B',
        nombre: 'Cemento de B',
        unidad: 'KG',
        origen: 'Local',
        categoria: '',
        subcategoria: '',
        marca_referencia: '',
        costo_unitario: 90,
        fecha_cotizacion: '',
        apu_basico_id: '',
        proveedor_id: '',
      },
    ];
    await saveCmDraft(scope, borradorB);
    const alcance = drafts.get(key(scope))?.scope ?? [];
    expect(alcance).toContain('insumos');
    expect(alcance).not.toContain('equipos'); // B nunca editó equipos
    // A (otro cliente) guarda SU equipo en la nube; B recarga contra esa base.
    rpc.mockResolvedValueOnce({
      data: remotoCon([
        { id: 'eA', codigo: 'EQ-A', nombre: 'Equipo de A', tipo: '', unidad: 'h', costo_hora: 50 },
      ]),
      error: null,
    });
    const cargado = await civilManagerLoad(scope);
    // Mezcla H-01: insumos del borrador de B + equipos del servidor de A.
    expect(cargado?.insumos.map((i) => i.id)).toEqual(['iB']);
    expect(cargado?.equipos.map((e) => e.id)).toEqual(['eA']);
    // El guardado de B envía SOLO su alcance: el equipo de A no vuelve a subirse.
    rpc.mockResolvedValue({ data: null, error: null });
    await civilManagerSave(cargado!, scope);
    const enviado = rpc.mock.calls.filter(([fn]) => fn === 'cm_save_state').at(-1)![1].p_state as
      Record<string, unknown> | undefined;
    expect(Object.keys(enviado!)).toContain('insumos');
    expect(Object.keys(enviado!)).not.toContain('equipos');
  });

  it('H-02: una confirmación tardía deja la edición de salida pendiente con su alcance', async () => {
    let confirm!: (result: { data: null; error: null }) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const saving = civilManagerSave(defaultState(), scope);
    await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
    const salida = defaultState();
    salida.config.salario_base += 100;
    await saveCmDraft(scope, salida);
    await guardarCmSalida(scope, salida);
    confirm({ data: null, error: null });
    await saving;
    // La confirmación del estado VIEJO no borra la salida: sigue pendiente con su alcance.
    expect(drafts.get(key(scope))).toMatchObject({
      state: salida,
      pending: true,
      scope: expect.arrayContaining(['config']),
    });
    // Recarga: la configuración de la salida sobrevive; el resto viene del servidor.
    rpc.mockResolvedValueOnce({
      data: remotoCon([]),
      error: null,
    });
    const cargado = await civilManagerLoad(scope);
    expect(cargado?.config.salario_base).toBe(salida.config.salario_base);
  });

  it('H-04: un fallo de IndexedDB avisa de verdad (saveCmDraft false, salida rechaza)', async () => {
    // El mock de arriba no puede fallar: parcheamos el módulo para ESTE test.
    const idb = await import('../storage/idb.ts');
    const espia = vi.spyOn(idb, 'saveToIdb').mockResolvedValue(false);
    const local = defaultState();
    await expect(saveCmDraft(scope, local)).resolves.toBe(false);
    await expect(guardarCmSalida(scope, local)).rejects.toThrow(/IndexedDB/);
    espia.mockRestore();
  });

  it('borrador LEGADO (sin alcance): se recupera entero y el primer guardado manda solo el delta', async () => {
    const legado = defaultState();
    legado.config.salario_base += 55;
    drafts.set(key(scope), { state: legado, version: null, pending: true, scope: null });
    rpc.mockResolvedValueOnce({
      data: remotoCon([]),
      error: null,
    });
    const cargado = await civilManagerLoad(scope);
    expect(cargado).toBe(legado); // sin alcance: estado entero del borrador
    rpc.mockResolvedValue({ data: null, error: null });
    await civilManagerSave(legado, scope);
    const enviado = rpc.mock.calls.filter(([fn]) => fn === 'cm_save_state').at(-1)![1].p_state as
      Record<string, unknown> | undefined;
    // Solo lo que difiere de la base sube: nada ambiguo se reenvía entero.
    expect(Object.keys(enviado!)).toContain('config');
    expect(Object.keys(enviado!)).not.toContain('equipos');
  });
});
