import { devError } from '../../utils/devError';
import { idbTx, openIdb } from '../../lib/idb';
import { supabase } from '../../lib/supabase';
import {
  CARGOS_DEFAULTS,
  CATEGORIAS_APU,
  CATEGORIAS_INSUMO,
  COMENTARIOS_APU_DEFAULTS,
  ORIGENES,
  PREST_DEFAULTS,
  TIPO_EQUIPO,
  TRANSP_UNIDADES,
  UNIDADES,
  cargoCodigoDefault,
  perfilesPaisDefault,
} from './seedData';
import type { CivilManagerState } from './types';

const DB_NAME = 'CivilManagerDB';
const STORE_NAME = 'state';
const DB_VERSION = 1;
const RECORD_KEY = 'civilmanager';
const SCHEMA_VERSION = 1;

export function defaultState(): CivilManagerState {
  return {
    schemaVersion: SCHEMA_VERSION,
    factoresPrestaciones: PREST_DEFAULTS.map((p) => ({ ...p, id: crypto.randomUUID() })),
    cargos: CARGOS_DEFAULTS.map((c, i) => ({
      ...c,
      id: crypto.randomUUID(),
      codigo: cargoCodigoDefault(i),
    })),
    cuadrillas: [],
    equipos: [],
    insumos: [],
    apus: [],
    presupuestos: [],
    proveedores: [],
    categorias_apu: CATEGORIAS_APU.map((c) => ({ ...c })),
    config_listas: {
      unidades: UNIDADES.slice(),
      categorias_insumo: CATEGORIAS_INSUMO.slice(),
      categorias_apu: CATEGORIAS_APU.map((c) => ({
        codigo: c.codigo,
        categoria: c.categoria,
        desc: c.desc,
      })),
      tipos_equipo: TIPO_EQUIPO.slice(),
      origenes: ORIGENES.slice(),
      unidades_transporte: TRANSP_UNIDADES.slice(),
      perfiles_pais: perfilesPaisDefault(),
      tipos_unidad: [],
    },
    config: {
      pais: 'CO',
      moneda: 'COP',
      salario_base: 1750905,
      auxilio_transporte: 147674,
      ibc_tope: 25,
      pct_administracion: 10,
      pct_imprevistos: 3,
      pct_utilidad: 6,
      herr_pct: 5,
      dias_mes: 25,
      horas_mes: 182,
      unidad: 'mes',
      vr_resumido: false,
      usar_en_cada_apu: true,
      usar_fp_en_apu: false,
      comentarios_apu: { ...COMENTARIOS_APU_DEFAULTS },
    },
  };
}

export function migrateState(
  raw: Partial<CivilManagerState> | null | undefined,
): CivilManagerState {
  const base = defaultState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    // Respetar arrays vacíos vs. semillas: un proyecto nuevo debe partir SIN cargos,
    // factores ni entidades (vienen de cm_get_data como []). Solo se siembran los
    // defaults si el campo está ausente (undefined), no si llega vacío.
    factoresPrestaciones: Array.isArray(raw.factoresPrestaciones)
      ? raw.factoresPrestaciones
      : base.factoresPrestaciones,
    cargos: Array.isArray(raw.cargos) ? raw.cargos : base.cargos,
    categorias_apu: Array.isArray(raw.categorias_apu) ? raw.categorias_apu : base.categorias_apu,
    config_listas: { ...base.config_listas, ...(raw.config_listas || {}) },
    config: {
      ...base.config,
      ...(raw.config || {}),
      comentarios_apu: { ...base.config.comentarios_apu, ...(raw.config?.comentarios_apu || {}) },
    },
  };
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function loadFromSupabase(): Promise<CivilManagerState | null> {
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const proyectoId = localStorage.getItem('cm_proyecto_activo_id') || null;
    const { data, error } = await supabase.rpc('cm_get_data', {
      p_proyecto_id: proyectoId,
    } as unknown as never);
    if (error) {
      devError('cm_get_data rpc:', error);
      return null;
    }
    if (!data) return null;
    const d = data as Partial<CivilManagerState> & { config?: unknown };
    const raw: Partial<CivilManagerState> = {
      factoresPrestaciones: (d as unknown as { factores: unknown[] }).factores as never,
      cargos: (d as unknown as { cargos: unknown[] }).cargos as never,
      cuadrillas: (d as unknown as { cuadrillas: unknown[] }).cuadrillas as never,
      equipos: (d as unknown as { equipos: unknown[] }).equipos as never,
      insumos: (d as unknown as { insumos: unknown[] }).insumos as never,
      apus: (d as unknown as { apus: unknown[] }).apus as never,
      presupuestos: (d as unknown as { presupuestos: unknown[] }).presupuestos as never,
      proveedores: (d as unknown as { proveedores: unknown[] }).proveedores as never,
      config: (d as unknown as { config: { config: unknown } }).config as never,
      config_listas: (d as unknown as { config: { config_listas: unknown } }).config as never,
    };
    return migrateState(raw);
  } catch (e) {
    devError('loadFromSupabase:', e);
    return null;
  }
}

async function saveToSupabase(state: CivilManagerState): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const proyectoId = localStorage.getItem('cm_proyecto_activo_id') || null;
  try {
    const proyectoUid = proyectoId || ''; // RLS exige proyecto válido del usuario
    const upsert = async (table: string, rows: unknown[]) => {
      if (!rows || (rows as unknown[]).length === 0) return;
      const withUser = (rows as Record<string, unknown>[]).map((r) => ({
        ...r,
        user_id: userId,
        proyecto_id: (r as Record<string, unknown>).proyecto_id ?? proyectoUid,
      }));
      const { error } = await supabase.from(table).upsert(withUser as never, { onConflict: 'id' });
      if (error) devError(`upsert ${table}:`, error);
    };
    await upsert('cm_factores_prestacionales', state.factoresPrestaciones);
    await upsert('cm_cargos', state.cargos);
    await upsert('cm_proveedores', state.proveedores);
    await upsert(
      'cm_cuadrillas',
      state.cuadrillas.map(({ integrantes, ...q }) => q),
    );
    const allIntegrantes = state.cuadrillas.flatMap((q) =>
      q.integrantes.map((it) => ({
        id: it.id,
        user_id: userId,
        proyecto_id: proyectoUid,
        cuadrilla_id: q.id,
        cargo_id: it.cargo_id,
        cantidad: it.cantidad,
      })),
    );
    if (allIntegrantes.length > 0) {
      const cuadrillaIds = state.cuadrillas.map((q) => q.id);
      if (cuadrillaIds.length > 0) {
        await supabase.from('cm_cuadrilla_integrantes').delete().in('cuadrilla_id', cuadrillaIds);
        await supabase.from('cm_cuadrilla_integrantes').insert(allIntegrantes as never);
      }
    }
    await upsert('cm_equipos', state.equipos);
    await upsert('cm_insumos', state.insumos);
    await upsert('cm_apus', state.apus);
    await upsert('cm_presupuestos', state.presupuestos);
    await supabase.from('cm_config').upsert(
      {
        user_id: userId,
        config: state.config as unknown as never,
        config_listas: state.config_listas as unknown as never,
        categorias_apu: state.categorias_apu as unknown as never,
      } as never,
      { onConflict: 'user_id' },
    );
  } catch (e) {
    devError('saveToSupabase:', e);
  }
}

async function loadFromIdb(): Promise<CivilManagerState | null> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    const record = await idbTx<{ k: string; d: Partial<CivilManagerState> } | undefined>(
      db,
      STORE_NAME,
      'readonly',
      (store) => store.get(RECORD_KEY),
    );
    return record ? migrateState(record.d) : null;
  } catch (e) {
    devError('civilManagerStorage load IDB:', e);
    return null;
  }
}

async function saveToIdb(state: CivilManagerState): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ k: RECORD_KEY, d: state }),
    );
  } catch (e) {
    devError('civilManagerStorage save IDB:', e);
  }
}

export async function civilManagerLoad(): Promise<CivilManagerState | null> {
  // 1) Try Supabase if authenticated
  const fromSupa = await loadFromSupabase();
  if (fromSupa) {
    // Cache to IDB
    await saveToIdb(fromSupa);
    return fromSupa;
  }
  // 2) Fallback IDB
  const fromIdb = await loadFromIdb();
  if (fromIdb) {
    // One-time migration: if IDB has data but Supabase was empty, upload it
    const hasAny =
      fromIdb.apus.length ||
      fromIdb.equipos.length ||
      fromIdb.insumos.length ||
      fromIdb.cuadrillas.length;
    if (hasAny) {
      const userId = await getUserId();
      if (userId) {
        // Fire and forget — don't block load
        saveToSupabase(fromIdb).catch((e) => devError('migrate IDB->Supa:', e));
      }
    }
    return fromIdb;
  }
  return null;
}

export async function civilManagerSave(state: CivilManagerState): Promise<void> {
  // Save to both — IDB always, Supabase if authed
  await saveToIdb(state);
  await saveToSupabase(state);
}
