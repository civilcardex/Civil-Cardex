import { devError } from '../../../utils/devError.ts';
import { supabase } from '../../../lib/supabase';
import { getUserId, ownerIdProyectoActivo } from './session.ts';
import { limpiarFilas } from './serialize.ts';
import type { CivilManagerState } from '../types.ts';

/**
 * Camino LEGADO (migración cm_save_state sin aplicar): ~20 round-trips en dos olas
 * paralelas. Se mantiene solo mientras la RPC no exista en la BD.
 */
export async function saveToSupabaseLegacy(state: CivilManagerState): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const proyectoId = localStorage.getItem('cm_proyecto_activo_id') || null;
  if (!proyectoId) {
    // Sin proyecto no se puede atribuir ninguna fila (proyecto_id uuid not null) — mandar
    // '' rompía con 400 (uuid inválido). Se guarda solo local hasta elegir proyecto.
    devError('saveToSupabaseLegacy: sin proyecto activo, solo IDB.');
    return;
  }
  try {
    const proyectoUid = proyectoId; // RLS exige proyecto válido del usuario
    // Empresarial: miembro editando el proyecto del dueño → las filas se sellan con el
    // user_id del DUEÑO (la policy RLS valida el asiento del miembro). Si no se puede
    // resolver el dueño, NO se sella con un id adivinado: se propaga el error.
    const ownerProyecto = await ownerIdProyectoActivo(proyectoUid);
    const userIdEscritura = ownerProyecto !== userId ? ownerProyecto : userId;
    const upsert = async (table: string, rows: unknown[]) => {
      if (!rows || (rows as unknown[]).length === 0) return;
      const withUser = limpiarFilas(table, rows, userIdEscritura, proyectoUid);
      // defaultToNull:false → header "Prefer: missing=default": las claves omitidas por el
      // saneo (null/NaN en columnas NOT NULL) las rellena PostgREST con el DEFAULT de la
      // columna; sin esto las rellenaba con NULL y tumbaba el upsert (23502).
      const { error } = await supabase.from(table).upsert(withUser as never, {
        onConflict: 'id',
        defaultToNull: false,
      });
      if (error) {
        devError(`upsert ${table}:`, error);
        return;
      }
      // Reconciliación de borrados: el upsert solo cubre filas presentes — sin delete de los
      // ids que ya no están, un registro eliminado resucitaba al recargar desde Supabase.
      const ids = withUser.map((r) => String(r.id));
      const existing = await supabase.from(table).select('id').eq('proyecto_id', proyectoUid);
      if (existing.error) {
        devError(`select ${table}:`, existing.error);
        return;
      }
      const stale = existing.data.map((r) => String(r.id)).filter((id) => !ids.includes(id));
      if (stale.length) {
        const del = await supabase.from(table).delete().in('id', stale);
        if (del.error) devError(`delete ${table}:`, del.error);
      }
    };
    // Dos olas paralelas respetando FKs (antes ~20 round-trips secuenciales). upsert() y el
    // bloque de integrantes tragan sus errores con devError: ninguno rechaza, Promise.all seguro.
    // OLA 1 — tablas sin dependencias entre sí (solo apuntan a auth.users / cm_proyectos).
    await Promise.all([
      upsert('cm_factores_prestacionales', state.factoresPrestaciones),
      upsert('cm_cargos', state.cargos),
      upsert('cm_proveedores', state.proveedores),
      upsert(
        'cm_cuadrillas',
        state.cuadrillas.map(({ integrantes: _integrantes, ...q }) => q),
      ),
      upsert('cm_apus', state.apus),
      upsert('cm_presupuestos', state.presupuestos),
    ]);
    const allIntegrantes = state.cuadrillas.flatMap((q) =>
      q.integrantes
        .filter((it) => it.cargo_id)
        .map((it) => ({
          id: it.id,
          user_id: userIdEscritura,
          proyecto_id: proyectoUid,
          cuadrilla_id: q.id,
          cargo_id: it.cargo_id,
          // cantidad integer not null check >= 0: NaN serializa a null y un decimal tumba el
          // insert con 400 — redondear y acotar.
          cantidad: Math.max(0, Math.round(Number(it.cantidad) || 0)),
        })),
    );
    const cuadrillaIds = state.cuadrillas.map((q) => q.id);
    const guardarIntegrantes = async () => {
      if (cuadrillaIds.length === 0) return;
      // Upsert PRIMERO y borrado SOLO de ids que ya no existen, DESPUÉS de un insert exitoso:
      // el delete-all + insert anterior vaciaba las cuadrillas en la BD cuando el insert
      // fallaba (400 de validación, red). Cubre también "todas las integrantes eliminadas".
      const ins = await supabase.from('cm_cuadrilla_integrantes').upsert(allIntegrantes as never);
      if (ins.error) {
        devError('upsert cm_cuadrilla_integrantes:', ins.error);
        return;
      }
      const existentes = await supabase
        .from('cm_cuadrilla_integrantes')
        .select('id')
        .in('cuadrilla_id', cuadrillaIds);
      if (existentes.error) {
        devError('select cm_cuadrilla_integrantes:', existentes.error);
        return;
      }
      const keep = new Set(allIntegrantes.map((r) => r.id));
      const stale = existentes.data.map((r) => r.id).filter((id) => !keep.has(id));
      if (stale.length > 0) {
        const del = await supabase.from('cm_cuadrilla_integrantes').delete().in('id', stale);
        if (del.error) devError(`delete cm_cuadrilla_integrantes:`, del.error);
      }
    };
    // OLA 2 — dependen de la ola 1: integrantes (FK cuadrillas+cargos), equipos/insumos (FK proveedor).
    const cfgRes = await Promise.all([
      guardarIntegrantes(),
      upsert('cm_equipos', state.equipos),
      upsert('cm_insumos', state.insumos),
      supabase
        .from('cm_config')
        .upsert(
          {
            user_id: userId,
            config: state.config,
            config_listas: state.config_listas,
            categorias_apu: state.categorias_apu,
          },
          { onConflict: 'user_id' },
        )
        .then((r) => {
          if (r.error) devError('upsert cm_config:', r.error);
        }),
    ]);
    void cfgRes;
  } catch (e) {
    devError('saveToSupabaseLegacy:', e);
    // Los upserts por tabla tragan SUS errores (devError), pero un fallo fuera de ellos
    // (e.g. el select/delete de integrantes, preparación de datos) deja la BD a medias.
    // Tragar el error dejaba la UI diciendo "guardado" mientras la BD tenía la versión
    // anterior -> al recargar, presupuestos y APU revertidos.
    throw e instanceof Error ? e : new Error(String(e));
  }
}
