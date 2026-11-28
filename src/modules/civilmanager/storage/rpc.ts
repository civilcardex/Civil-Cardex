import { supabase } from '../../../lib/supabase';
import { captureCmScope, type CmStorageScope, cmScopeKey } from './session.ts';
import { limpiarFilas, migrateState } from './serialize.ts';
import { readCmSnapshot } from '../dto.ts';
import type { CivilManagerState } from '../types.ts';

/** Lee el estado visible del proyecto. Null significa que no hay acceso o que no existe. */
export async function loadFromSupabase(scope: CmStorageScope) {
  const { data, error } = await supabase.rpc('cm_get_data', { p_proyecto_id: scope.proyectoId });
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const snap = readCmSnapshot(data);
  const activo = snap.proyectos?.find((p) => p.id === scope.proyectoId);
  if (!activo?.updated_at) return null;
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
  return { state: migrateState(raw), version: activo.updated_at };
}

/** Payload jsonb que espera cm_save_state: filas saneadas + integrantes anidados + config. */
function payloadCmDeEstado(
  state: CivilManagerState,
  userId: string,
  proyectoUid: string,
): Record<string, unknown> {
  return {
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
}

/** Rechaza el guardado si la pestaña cambió de proyecto o cuenta. */
async function verificarScopeActual(scope: CmStorageScope): Promise<void> {
  const { userId, proyectoId: proyectoUid } = scope;
  const actual = await captureCmScope();
  if (actual?.userId !== userId || actual.proyectoId !== proyectoUid) {
    throw new Error('Cambió la cuenta o el proyecto. El borrador sigue en este dispositivo.');
  }
}

/** Claves de colección + preferencias que puede traer el payload (save parcial 2026-11-27).
 *  Exportada para el alcance del borrador (H-01): las mismas claves delimitan qué colecciones
 *  del estado recuperado manda el borrador y cuáles el servidor. */
export const CLAVES_CM = [
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
] as const;

export type ClaveCm = (typeof CLAVES_CM)[number];

/** Mezcla H-01: sobre la base del servidor, superpone SOLO las colecciones dentro del
 *  alcance del borrador recuperado — lo que otro cliente guardó fuera del alcance sobrevive.
 *  Ej: borrador con alcance ['insumos'] + remoto con equipos nuevos de otro cliente →
 *  insumos del borrador + equipos del remoto. */
export function superponerColecciones(
  base: CivilManagerState,
  draft: CivilManagerState,
  claves: string[],
): CivilManagerState {
  const out = { ...base } as Record<string, unknown>;
  const record = draft as unknown as Record<string, unknown>;
  for (const k of claves) if (k in record) out[k] = record[k];
  return out as unknown as CivilManagerState;
}

/** Base CONFIRMADA por cuenta+proyecto (H-01): lo que SE SABE que está en el servidor. El
 *  delta del guardado se calcula contra esto AL EJECUTAR cada operación de la cola, y solo
 *  avanza con las colecciones que Supabase aceptó. null = sin base → payload completo. */
const basesConfirmadas = new Map<string, CivilManagerState>();

/** Siembra/repone la base confirmada tras una CARGA (lo que devolvió el servidor). */
export function fijarBaseCm(scope: CmStorageScope, state: CivilManagerState | null): void {
  const key = cmScopeKey(scope);
  if (!key) return;
  if (state) basesConfirmadas.set(key, state);
  else basesConfirmadas.delete(key);
}

/** Colecciones del estado que la base confirmada NO conoce todavía (H-02): vacío = todo
 *  confirmado. Ej: tras guardar y sin nuevas ediciones devuelve [] (el borrador de salida
 *  no debe volver a marcarse pendiente). */
export function cmPendientesDe(scope: CmStorageScope, state: CivilManagerState): string[] {
  const key = cmScopeKey(scope);
  const base = key ? basesConfirmadas.get(key) : undefined;
  if (!base) return [...CLAVES_CM]; // sin base: nada confirmado en el servidor
  const full = payloadCmDeEstado(state, scope.userId, scope.proyectoId);
  const baseFull = payloadCmDeEstado(base, scope.userId, scope.proyectoId);
  return CLAVES_CM.filter((k) => JSON.stringify(full[k]) !== JSON.stringify(baseFull[k]));
}

/** Guarda el estado (last-write-wins, ped. usuario 2026-11-24: sin reloj, el borrador local
 *  SIEMPRE pisa la nube). El delta se calcula contra la base confirmada AL EJECUTAR (H-01:
 *  una pestaña vieja deja de reponer filas que nunca editó y volver al valor original sí se
 *  envía). Al aceptar Supabase, la base avanza SOLO con las colecciones enviadas.
 *  @returns las claves de colección incluidas en el payload aceptado. */
export async function saveToSupabase(
  state: CivilManagerState,
  scope: CmStorageScope,
): Promise<string[]> {
  const { userId, proyectoId: proyectoUid } = scope;
  await verificarScopeActual(scope);
  const key = cmScopeKey(scope);
  const base = key ? (basesConfirmadas.get(key) ?? null) : null;
  const completo = payloadCmDeEstado(state, userId, proyectoUid);
  let p_state: Record<string, unknown> = completo;
  let enviadas: string[] = [...CLAVES_CM];
  if (base) {
    const baseFull = payloadCmDeEstado(base, userId, proyectoUid);
    p_state = {};
    enviadas = [];
    for (const k of CLAVES_CM)
      if (JSON.stringify(completo[k]) !== JSON.stringify(baseFull[k])) {
        p_state[k] = completo[k];
        enviadas.push(k);
      }
  }
  const { error } = await supabase.rpc('cm_save_state', {
    p_proyecto_id: proyectoUid,
    p_state,
  });
  if (error) throw new Error(`cm_save_state: ${error.message}`);
  // Aceptado: la base avanza SOLO con lo enviado (las colecciones omitidas conservan la suya).
  if (key) {
    const previa = basesConfirmadas.get(key);
    if (previa) {
      const avanzada = { ...previa } as Record<string, unknown>;
      for (const k of enviadas) avanzada[k] = completo[k];
      basesConfirmadas.set(key, avanzada as unknown as CivilManagerState);
    } else {
      basesConfirmadas.set(key, state);
    }
  }
  return enviadas;
}
