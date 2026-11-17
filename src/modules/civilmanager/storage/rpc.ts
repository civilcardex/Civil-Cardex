import { devError } from '../../../utils/devError.ts';
import { supabase } from '../../../lib/supabase';
import { getUserId } from './session.ts';
import { limpiarFilas, migrateState } from './serialize.ts';
import { saveToSupabaseLegacy } from './legacy.ts';
import { readCmSnapshot } from '../dto.ts';
import type { CivilManagerState } from '../types.ts';

/**
 * Queries Supabase del módulo CM: carga vía RPC cm_get_data y guardado vía RPC atómica
 * cm_save_state con fallback al camino legado de olas mientras la migración no se aplique.
 */

/** Reloj de concurrencia: updated_at del proyecto activo LEÍDO de la BD (cm_get_data trae
 * la fila completa de cm_proyectos). El guardado lo manda y el RPC rechaza si la BD tiene
 * uno mayor — otro dispositivo guardó después. Ref al nivel del módulo: load→save. */
let updatedAtLeido: string | null = null;

export function lastCmUpdatedAtLeido(): string | null {
  return updatedAtLeido;
}

export async function loadFromSupabase(): Promise<CivilManagerState | null> {
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const proyectoId = localStorage.getItem('cm_proyecto_activo_id') || null;
    const { data, error } = await supabase.rpc('cm_get_data', {
      p_proyecto_id: proyectoId,
    });
    if (error) {
      devError('cm_get_data rpc:', error);
      return null;
    }
    if (!data) return null;
    // readCmSnapshot es PASSTHROUGH: sin defaults, lo que falte en el jsonb queda undefined
    // y migrateState (abajo) aplica su fallback por clave — igual que con el cast anterior.
    const snap = readCmSnapshot(data);
    // Reloj del proyecto activo para el guardado optimistic (conflicto_concurrencia).
    const activo = snap.proyectos?.find((p) => p.id === proyectoId) as
      { id: string; updated_at?: string } | undefined;
    updatedAtLeido = activo?.updated_at ?? null;
    const raw: Partial<CivilManagerState> = {
      factoresPrestaciones: snap.factores,
      cargos: snap.cargos,
      cuadrillas: snap.cuadrillas,
      equipos: snap.equipos,
      insumos: snap.insumos,
      apus: snap.apus,
      presupuestos: snap.presupuestos,
      proveedores: snap.proveedores,
      // cm_get_data devuelve snap.config = {config, config_listas, categorias_apu} (wrapper) —
      // antes se asignaba el wrapper entero a ambas claves y categorias_apu no se extraía:
      // migrateState caía en defaults y se perdían país/salario/listas al cargar de Supabase.
      config: snap.config?.config,
      config_listas: snap.config?.config_listas,
      categorias_apu: snap.config?.categorias_apu,
    };
    return migrateState(raw);
  } catch (e) {
    devError('loadFromSupabase:', e);
    return null;
  }
}

/**
 * Detecta que cm_save_state aún no existe en la BD (migración 20261112000000 sin aplicar):
 * PostgREST responde 404 / PGRST202 "Could not find the function ... in the schema cache".
 * Ej: usuario sin la migración aplicada → true → el guardado cae al camino legado.
 */
function rpcSaveStateNoDesplegada(err: unknown): boolean {
  const e = err as {
    code?: string;
    message?: string;
    status?: number;
    context?: { status?: number };
  } | null;
  const status = e?.status ?? e?.context?.status;
  return (
    e?.code === 'PGRST202' || status === 404 || /not found|not find|404/i.test(e?.message ?? '')
  );
}

/**
 * Guarda el estado completo vía RPC cm_save_state: UNA llamada, UNA transacción en la BD
 * (o todo, o nada — adiós a las ~20 llamadas de olas que podían dejar la BD a medias).
 * El sello real lo hace el RPC (user_id = dueño del proyecto, proyecto_id del parámetro);
 * aquí solo se manda el mismo estado limpio que serializaba el camino legado.
 * @returns false si la función no está desplegada todavía (el llamador cae al legado).
 */
async function saveToSupabaseViaRpc(
  state: CivilManagerState,
  proyectoUid: string,
  userId: string,
): Promise<boolean> {
  const payload = {
    factoresPrestaciones: limpiarFilas(
      'cm_factores_prestacionales',
      state.factoresPrestaciones,
      userId,
      proyectoUid,
    ),
    cargos: limpiarFilas('cm_cargos', state.cargos, userId, proyectoUid),
    proveedores: limpiarFilas('cm_proveedores', state.proveedores, userId, proyectoUid),
    // Cuadrillas CON integrantes anidados: el RPC separa (upsert de cuadrilla sin
    // integrantes + insert de integrantes con el filtro y el redondeo del legado).
    cuadrillas: state.cuadrillas.map((q) => ({
      id: q.id,
      codigo: q.codigo,
      descripcion: q.descripcion,
      integrantes: q.integrantes
        .filter((it) => it.cargo_id)
        .map((it) => ({
          id: it.id,
          cargo_id: it.cargo_id,
          // cantidad numeric(6,2) (migración cm_doctrina_fixes): la UI acepta decimales
          // (1.5 integrantes = plaza y media). NaN → 0; el decimal viaja tal cual.
          cantidad: Math.max(0, Number(it.cantidad) || 0),
        })),
    })),
    equipos: limpiarFilas('cm_equipos', state.equipos, userId, proyectoUid),
    insumos: limpiarFilas('cm_insumos', state.insumos, userId, proyectoUid),
    apus: limpiarFilas('cm_apus', state.apus, userId, proyectoUid),
    presupuestos: limpiarFilas('cm_presupuestos', state.presupuestos, userId, proyectoUid),
    config: state.config,
    config_listas: state.config_listas,
    categorias_apu: state.categorias_apu,
  };
  const { error } = await supabase.rpc('cm_save_state', {
    p_proyecto_id: proyectoUid,
    p_state: payload,
    // Concurrencia optimistic: el updated_at leído al cargar; la BD rechaza si alguien
    // guardó después (conflicto_concurrencia). null = check desactivado.
    p_updated_at: updatedAtLeido,
  });
  if (!error) {
    // La RPC subió el reloj de la BD: el valor leído quedó VIEJO y haría conflicto con el
    // siguiente autosave. Sin check hasta la próxima carga del proyecto.
    updatedAtLeido = null;
    return true;
  }
  if (rpcSaveStateNoDesplegada(error)) return false;
  // Conflicto de concurrencia: no es error de transporte — mensaje accionable, sin fallback.
  if (/conflicto_concurrencia/i.test(error.message)) {
    throw new Error(
      'Otro dispositivo guardó cambios más recientes de este proyecto. Recargue la página para verlos y volver a intentar.',
    );
  }
  // Error real de la RPC (autorización, FK, validación): NO hay fallback — el legado
  // fallaría igual y sin atomicidad. Se propaga para que la UI deje de decir "guardando".
  throw new Error(`cm_save_state: ${error.message}`);
}

/**
 * Guarda en Supabase: RPC atómica cm_save_state primero; si la migración aún no se aplicó
 * (404/función-no-existe), cae al camino legado de olas paralelas. Sin proyecto activo no
 * se puede atribuir ninguna fila → solo IDB (IndexedDB, espejo local).
 */
export async function saveToSupabase(state: CivilManagerState): Promise<void> {
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
    if (await saveToSupabaseViaRpc(state, proyectoId, userId)) return;
    // La RPC no existe todavía: la migración 20261112000000_cm_save_state.sql no se ha
    // aplicado en el SQL Editor. Seguimos con el camino viejo hasta que se aplique.
    devError(
      'cm_save_state no desplegada: aplicar supabase/migrations/20261112000000_cm_save_state.sql en el SQL Editor. Usando camino legado de olas paralelas.',
    );
    await saveToSupabaseLegacy(state);
  } catch (e) {
    devError('saveToSupabase:', e);
    // Nada traga errores aquí: un fallo del RPC o de la preparación deja la UI diciendo
    // "guardado" mientras la BD tiene la versión anterior -> al recargar, presupuestos y
    // APU revertidos. Se propaga.
    throw e instanceof Error ? e : new Error(String(e));
  }
}
