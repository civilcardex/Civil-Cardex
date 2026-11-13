import { devError } from '../../utils/devError.ts';
import { loadFromIdb, saveToIdb } from './storage/idb.ts';
import { loadFromSupabase, saveToSupabase } from './storage/rpc.ts';
import { getUserId } from './storage/session.ts';

export { defaultState, migrateState } from './storage/serialize.ts';
import type { CivilManagerState } from './types.ts';

/**
 * Persistencia del módulo CM (CivilManager): una sola verdad (Supabase) con espejo local (IndexedDB).
 * Carga: Supabase primero -> si falla/vacío, IDB (y migra lo local hacia arriba). Guardado: IDB +
 * RPC cm_save_state (una transacción atómica); mientras la migración no esté aplicada, camino legado de olas paralelas.
 * Ej: civilManagerLoad() abre el proyecto con sus APU (Análisis de Precio Unitario) aunque no haya red.
 * Piezas: storage/serialize.ts (forma del estado + saneo), storage/idb.ts (espejo local),
 * storage/rpc.ts (queries Supabase), storage/legacy.ts (camino de olas), storage/session.ts (identidad).
 */
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

// Cola serial: dos civilManagerSave en vuelo intercalaban ~10 upserts y la BD podía quedar
// con apus de una generación y presupuestos de otra. Una nueva llamada espera a la anterior.
let saveChain: Promise<void> = Promise.resolve();

/**
 * Guarda el estado en IDB + Supabase, SERIALIZADO: cada save espera al anterior (~10 upserts).
 * Ej: dos saves seguidos tras editar un APU y un presupuesto no intercalan tablas en la BD.
 * @param state estado completo del módulo a persistir.
 */
export function civilManagerSave(state: CivilManagerState): Promise<void> {
  const job = saveChain
    .catch(() => {})
    .then(async () => {
      await saveToIdb(state);
      await saveToSupabase(state);
    });
  // La cadena almacenada NUNCA queda en rechazo sin handler (el último save de la sesión
  // produciría un unhandledRejection en la página). El rechazo real viaja en `job`, que es
  // lo que se devuelve a quien llamó; a la cola solo llega una versión resuelta.
  saveChain = job
    .catch(() => {})
    .finally(() => {
      if (saveChain === job) saveChain = Promise.resolve();
    });
  return job;
}
