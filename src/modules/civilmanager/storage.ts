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
// TEMPORAL (ponytail): backup real 2026-09-06 sembrado a la fuerza en el módulo.
// Revertir: borrar este import, la constante SEED_BACKUP_2026_09_06 y el `if` que la retorna en civilManagerLoad.
import seedBackup20260906 from './seedBackup20260906.json';

const SEED_BACKUP_2026_09_06 = seedBackup20260906 as unknown as Partial<CivilManagerState> | null;

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
      mapeos_formulario: [],
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
  // Los presupuestos guardados antes de los snapshots completos llegan sin las claves nuevas:
  // se rellenan con sus valores vacíos para que el resto del código pueda confiar en ellas.
  const presupuestos = Array.isArray(raw.presupuestos)
    ? raw.presupuestos.map((p) => ({
        ...p,
        insumos_snap: p.insumos_snap ?? [],
        equipos_snap: p.equipos_snap ?? [],
        cuadrillas_snap: p.cuadrillas_snap ?? [],
        perfil_pais_snap: p.perfil_pais_snap ?? null,
        formulario_original: p.formulario_original ?? null,
      }))
    : base.presupuestos;
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
    presupuestos,
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
  if (!proyectoId) {
    // Sin proyecto no se puede atribuir ninguna fila (proyecto_id uuid not null) — mandar
    // '' rompía con 400 (uuid inválido). Se guarda solo local hasta elegir proyecto.
    devError('saveToSupabase: sin proyecto activo, solo IDB.');
    return;
  }
  try {
    const proyectoUid = proyectoId; // RLS exige proyecto válido del usuario
    // Columnas reales por tabla (migración cm_schema + snaps): todo campo de más (p. ej.
    // tipoPrecioFormulario/alarmasPrecioFaltante en presupuestos) tumbaba el upsert con 400.
    const TABLE_COLUMNS: Record<string, string[]> = {
      cm_factores_prestacionales: ['id', 'codigo', 'nombre', 'factor', 'tipo'],
      cm_cargos: ['id', 'codigo', 'descripcion', 'num_salarios_base'],
      cm_proveedores: [
        'id',
        'codigo',
        'nombre',
        'nit',
        'contacto',
        'tel1',
        'tel2',
        'email',
        'direccion',
        'ciudad',
        'departamento',
        'tipo',
        'notas',
        'activo',
      ],
      cm_cuadrillas: ['id', 'codigo', 'descripcion'],
      cm_equipos: [
        'id',
        'codigo',
        'nombre',
        'tipo',
        'unidad',
        'costo_hora',
        'fecha_cotizacion',
        'proveedor_id',
      ],
      cm_insumos: [
        'id',
        'codigo',
        'nombre',
        'unidad',
        'origen',
        'categoria',
        'subcategoria',
        'marca_referencia',
        'costo_unitario',
        'fecha_cotizacion',
        'apu_basico_id',
        'proveedor_id',
      ],
      cm_apus: [
        'id',
        'codigo',
        'nombre',
        'categoria',
        'unidad',
        'fecha_creacion',
        'es_basico',
        'recursos_mo',
        'recursos_eq',
        'recursos_ins',
        'recursos_transporte',
      ],
      cm_presupuestos: [
        'id',
        'codigo',
        'nombre',
        'entidad',
        'contrato',
        'objeto',
        'plazo',
        'fecha_creacion',
        'ciudad',
        'departamento',
        'elaborado_por',
        'activo',
        'con_sub_proyectos',
        'parent_id',
        'estado',
        'fecha_cierre',
        'observaciones',
        'items',
        'aiu_override',
        'factores_snap',
        'cargos_snap',
        'apus_snap',
        'insumos_snap',
        'equipos_snap',
        'cuadrillas_snap',
        'perfil_pais_snap',
        'formulario_original',
      ],
    };
    // FKs anulables: '' no existe en la tabla referenciada y violaba la FK con 409.
    const NULLABLE_FK_EMPTY_TO_NULL: Record<string, string[]> = {
      cm_equipos: ['proveedor_id'],
      cm_insumos: ['proveedor_id'],
    };
    // Columnas anulables donde null significa "limpiar el valor" — viajan tal cual. En el
    // resto, null/undefined/NaN se OMITEN: JSON.stringify(NaN) serializa a null y tumbaba el
    // upsert con 23502 (es_basico, observaciones...); omitir deja que la BD aplique su default
    // (fila nueva) o conserve el valor previo (upsert).
    const NULLABLE: Record<string, string[]> = {
      cm_equipos: ['proveedor_id'],
      cm_insumos: ['proveedor_id', 'apu_basico_id'],
      cm_presupuestos: ['parent_id', 'perfil_pais_snap', 'formulario_original'],
    };
    const upsert = async (table: string, rows: unknown[]) => {
      if (!rows || (rows as unknown[]).length === 0) return;
      const cols = TABLE_COLUMNS[table];
      const nullFks = NULLABLE_FK_EMPTY_TO_NULL[table] || [];
      const nullables = NULLABLE[table] || [];
      const withUser = (rows as Record<string, unknown>[]).map((r) => {
        const clean: Record<string, unknown> = {};
        if (cols) {
          for (const c of cols) {
            if (!(c in r)) continue;
            const v = r[c];
            if (!nullables.includes(c)) {
              if (v == null) continue;
              if (typeof v === 'number' && Number.isNaN(v)) continue;
            }
            clean[c] = v;
          }
        } else {
          Object.assign(clean, r);
        }
        clean.user_id = userId;
        clean.proyecto_id = (r as Record<string, unknown>).proyecto_id ?? proyectoUid;
        for (const fk of nullFks) if (clean[fk] === '') clean[fk] = null;
        return clean;
      });
      // defaultToNull:false → header "Prefer: missing=default": las claves omitidas por el
      // saneo (null/NaN en columnas NOT NULL) las rellena PostgREST con el DEFAULT de la
      // columna; sin esto las rellenaba con NULL y tumbaba el upsert (23502).
      const { error } = await supabase.from(table).upsert(withUser as never, {
        onConflict: 'id',
        defaultToNull: false,
      });
      if (error) devError(`upsert ${table}:`, error);
    };
    await upsert('cm_factores_prestacionales', state.factoresPrestaciones);
    await upsert('cm_cargos', state.cargos);
    await upsert('cm_proveedores', state.proveedores);
    await upsert(
      'cm_cuadrillas',
      state.cuadrillas.map(({ integrantes: _integrantes, ...q }) => q),
    );
    const allIntegrantes = state.cuadrillas.flatMap((q) =>
      q.integrantes
        .filter((it) => it.cargo_id)
        .map((it) => ({
          id: it.id,
          user_id: userId,
          proyecto_id: proyectoUid,
          cuadrilla_id: q.id,
          cargo_id: it.cargo_id,
          // cantidad integer not null check >= 0: NaN serializa a null y un decimal tumba el
          // insert con 400 — redondear y acotar.
          cantidad: Math.max(0, Math.round(Number(it.cantidad) || 0)),
        })),
    );
    const cuadrillaIds = state.cuadrillas.map((q) => q.id);
    if (cuadrillaIds.length > 0) {
      // Upsert PRIMERO y borrado SOLO de ids que ya no existen, DESPUÉS de un insert exitoso:
      // el delete-all + insert anterior vaciaba las cuadrillas en la BD cuando el insert
      // fallaba (400 de validación, red). Cubre también "todas las integrantes eliminadas".
      const ins = await supabase.from('cm_cuadrilla_integrantes').upsert(allIntegrantes as never);
      if (ins.error) {
        devError('upsert cm_cuadrilla_integrantes:', ins.error);
      } else {
        const existentes = await supabase
          .from('cm_cuadrilla_integrantes')
          .select('id')
          .in('cuadrilla_id', cuadrillaIds);
        if (existentes.error) {
          devError('select cm_cuadrilla_integrantes:', existentes.error);
        } else {
          const keep = new Set(allIntegrantes.map((r) => r.id));
          const stale = existentes.data.map((r) => r.id).filter((id) => !keep.has(id));
          if (stale.length > 0) {
            const del = await supabase.from('cm_cuadrilla_integrantes').delete().in('id', stale);
            if (del.error) devError('delete cm_cuadrilla_integrantes:', del.error);
          }
        }
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
  // TEMPORAL: el backup gana sobre Supabase/IDB en cada carga (para revertir, poner SEED_BACKUP_2026_09_06 = null).
  if (SEED_BACKUP_2026_09_06) return migrateState(SEED_BACKUP_2026_09_06);
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
