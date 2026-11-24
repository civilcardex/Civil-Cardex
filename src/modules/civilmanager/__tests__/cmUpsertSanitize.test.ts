import { describe, it, expect, beforeEach, vi } from 'vitest';

// RPC configurable: error=error real de la RPC (se propaga). El camino LEGADO de olas fue
// eliminado (storage/legacy.ts fuera, H-13): solo queda el guardado por RPC con versión.
const rpcSaveState = vi.hoisted(() => ({
  error: null as { code: string; message: string } | null,
  captured: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      // El forzado re-lee el proyecto para confirmar su versión: snapshot mínimo.
      if (fn === 'cm_get_data')
        return {
          data: { proyectos: [{ id: args.p_proyecto_id, updated_at: 'committed' }], config: {} },
          error: null,
        };
      if (rpcSaveState.error) return { data: null, error: rpcSaveState.error };
      rpcSaveState.captured.push({ fn, args });
      return { data: 'committed', error: null };
    },
  },
}));

import { defaultState, civilManagerSave } from '../storage.ts';
import { saveToSupabase } from '../storage/rpc.ts';

vi.mock('../storage/session.ts', () => ({
  cmScopeKey: ({ userId, proyectoId }: { userId: string; proyectoId: string }) =>
    `${userId}:${proyectoId}`,
  captureCmScope: async () => {
    const proyectoId = (globalThis as { localStorage: Storage }).localStorage.getItem(
      'cm_proyecto_activo_id',
    );
    return proyectoId ? { userId: 'u1', proyectoId } : null;
  },
}));

const PROYECTO = '11111111-1111-4111-8111-111111111111';

function resetLS(withProject: boolean) {
  const m = new Map<string, string>();
  if (withProject) m.set('cm_proyecto_activo_id', PROYECTO);
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

// 400/409 en consola (orig. usuario): FK proveedor_id:'' (409), columnas cliente sin
// columna BD (400), proyecto ausente (400 uuid inválido) y cantidad NaN (400 not-null).

function seedState() {
  const s = defaultState();
  s.equipos = [
    {
      id: 'e1',
      codigo: 'EQ-1',
      nombre: 'Andamio',
      tipo: 'Equipo menor',
      unidad: 'HR',
      costo_hora: 6000,
      fecha_cotizacion: '',
      proveedor_id: '',
    },
  ];
  s.insumos = [
    {
      id: 'i1',
      codigo: 'IN-1',
      nombre: 'Cemento',
      unidad: 'KG',
      origen: 'Local',
      categoria: 'C1',
      subcategoria: '',
      marca_referencia: '',
      costo_unitario: 100,
      fecha_cotizacion: '',
      apu_basico_id: '',
      proveedor_id: '',
    },
  ];
  s.apus = [
    {
      id: 'a1',
      codigo: 'APU-1',
      nombre: 'Zapata',
      categoria: 'C',
      unidad: 'M3',
      fecha_creacion: '',
      es_basico: false,
      recursos_mo: [],
      recursos_eq: [],
      recursos_ins: [],
      recursos_transporte: [],
    },
  ];
  s.cargos = [{ id: 'c1', codigo: 'C1', descripcion: 'Ayudante', num_salarios_base: 1 }];
  s.cuadrillas = [
    {
      id: 'q1',
      codigo: 'Q1',
      descripcion: 'Cuadrilla 1',
      integrantes: [{ id: 'it1', cargo_id: 'c1', cantidad: NaN }],
    },
  ];
  s.presupuestos = [
    {
      id: 'p1',
      codigo: 'P-1',
      nombre: 'Presupuesto 1',
      entidad: '',
      contrato: '',
      objeto: '',
      plazo: '',
      fecha_creacion: '',
      ciudad: '',
      departamento: '',
      elaborado_por: '',
      activo: true,
      con_sub_proyectos: false,
      parent_id: null,
      estado: 'borrador',
      fecha_cierre: '',
      observaciones: '',
      items: [],
      aiu_override: { activo: false, pct_a: 10, pct_i: 3, pct_u: 6, iva_pct: 19 },
      factores_snap: [],
      cargos_snap: [],
      apus_snap: [],
      insumos_snap: [],
      equipos_snap: [],
      cuadrillas_snap: [],
      perfil_pais_snap: null,
    },
  ];
  return s;
}

describe('civilManagerSave sanea payloads Supabase', () => {
  beforeEach(() => {
    rpcSaveState.error = null;
    rpcSaveState.captured.length = 0;
    resetLS(true);
  });

  it('sin proyecto activo no se dispara ninguna RPC de guardado', async () => {
    resetLS(false);
    await civilManagerSave(seedState());
    expect(rpcSaveState.captured).toHaveLength(0);
  });

  // ─── Camino RPC cm_save_state (LWW): una llamada, cero olas ───

  it('UNA llamada cm_save_state con el estado completo, sin reloj y cero olas', async () => {
    await saveToSupabase(seedState(), { userId: 'u1', proyectoId: PROYECTO });
    expect(rpcSaveState.captured).toHaveLength(1);
    const { fn, args } = rpcSaveState.captured[0];
    expect(fn).toBe('cm_save_state');
    expect(args.p_proyecto_id).toBe(PROYECTO);
    expect('p_updated_at' in args).toBe(false);
    const st = args.p_state as Record<string, unknown>;
    // Claves EXACTAS que espera la migración (nombres de cliente, sin extras).
    expect(Object.keys(st).sort()).toEqual(
      [
        'factoresPrestaciones',
        'cargos',
        'proveedores',
        'cuadrillas',
        'equipos',
        'insumos',
        'apus',
        'presupuestos',
        'config',
        'config_listas',
        'categorias_apu',
      ].sort(),
    );
    // El saneo del payload: FK '' → null (400/409 en consola, orig. usuario).
    const equipos = st.equipos as Array<{ proveedor_id: string | null }>;
    expect(equipos[0].proveedor_id).toBeNull();
    // Integrantes anidados: cantidad NaN → 0 y el integrante sin cargo no viaja.
    const cuadrillas = st.cuadrillas as Array<{
      id: string;
      integrantes: Array<{ id: string; cargo_id: string; cantidad: number }>;
    }>;
    expect(cuadrillas[0].integrantes).toEqual([{ id: 'it1', cargo_id: 'c1', cantidad: 0 }]);
    // Columnas dropeadas (M-14) fuera del payload.
    const pp = (st.presupuestos as Array<Record<string, unknown>>)[0];
    expect(pp).not.toHaveProperty('tipo_precio_formulario');
    expect(pp).not.toHaveProperty('alarmas_precio_faltante');
  });

  it('RPC con error real: se propaga sin caer a ningún camino alterno', async () => {
    rpcSaveState.error = { code: '23503', message: 'violates foreign key constraint' };
    await expect(
      saveToSupabase(seedState(), { userId: 'u1', proyectoId: PROYECTO }),
    ).rejects.toThrow(/cm_save_state/);
    expect(rpcSaveState.captured).toHaveLength(0);
  });
});
