import { supabase } from '../../../lib/supabase';
import { captureCmScope, type CmStorageScope } from './session.ts';
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

/** Guard mis-usuario/mis-proyecto compartido por ambos caminos de guardado. */
async function verificarScopeActual(scope: CmStorageScope): Promise<void> {
  const { userId, proyectoId: proyectoUid } = scope;
  const actual = await captureCmScope();
  if (actual?.userId !== userId || actual.proyectoId !== proyectoUid) {
    throw new Error('Cambió la cuenta o el proyecto. El borrador sigue en este dispositivo.');
  }
}

/** Guarda una colección completa solo si su versión coincide con la última leída. */
export async function saveToSupabase(
  state: CivilManagerState,
  scope: CmStorageScope,
  version: string,
): Promise<string> {
  const { userId, proyectoId: proyectoUid } = scope;
  await verificarScopeActual(scope);
  const { data, error } = await supabase.rpc('cm_save_state_versioned', {
    p_proyecto_id: proyectoUid,
    p_state: payloadCmDeEstado(state, userId, proyectoUid),
    p_updated_at: version,
  });
  if (error?.message.includes('conflicto_concurrencia')) {
    throw new Error(
      'Otro dispositivo guardó cambios más recientes. Se conservó tu borrador local.',
    );
  }
  if (error || !data)
    throw new Error(`cm_save_state_versioned: ${error?.message ?? 'sin versión confirmada'}`);
  return data;
}

/** Guardado FORZADO (H-02, resolución «mi borrador gana»): usa la firma antigua cm_save_state
 *  (p_updated_at default null = sin check de versión, migración 20261123000002 la conserva)
 *  y devuelve la versión vigente releyendo el proyecto para re-armar el reloj del cliente. */
export async function saveForzadoSupabase(
  state: CivilManagerState,
  scope: CmStorageScope,
): Promise<string> {
  const { userId, proyectoId: proyectoUid } = scope;
  await verificarScopeActual(scope);
  const { error } = await supabase.rpc('cm_save_state', {
    p_proyecto_id: proyectoUid,
    p_state: payloadCmDeEstado(state, userId, proyectoUid),
  });
  if (error) throw new Error(`cm_save_state: ${error.message}`);
  const relectura = await loadFromSupabase(scope);
  if (!relectura) throw new Error('cm_save_state: sin versión confirmada tras el guardado.');
  return relectura.version;
}
