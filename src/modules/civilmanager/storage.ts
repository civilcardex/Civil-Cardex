import { hayRespaldoLegado, loadFromIdb, saveToIdb } from './storage/idb.ts';
import {
  cmPendientesDe,
  fijarBaseCm,
  loadFromSupabase,
  saveToSupabase,
  superponerColecciones,
} from './storage/rpc.ts';
import { captureCmScope, cmScopeKey, type CmStorageScope } from './storage/session.ts';
import type { CivilManagerState } from './types.ts';

export { defaultState, migrateState } from './storage/serialize.ts';

const saveQueues = new Map<string, Promise<void>>();
const latestDrafts = new Map<string, CivilManagerState>();

/** Deja el borrador en disco antes del guardado diferido. Registra su ALCANCE (H-01): las
 *  colecciones que difieren de la base confirmada — la recuperación las superpone sobre el
 *  servidor en vez de pisarlo entero. Devuelve false si IndexedDB falló (H-04): el llamador
 *  avisa de verdad que la copia local quedó desactualizada. */
export async function saveCmDraft(
  scope: CmStorageScope,
  state: CivilManagerState,
): Promise<boolean> {
  const key = cmScopeKey(scope);
  latestDrafts.set(key, state);
  const alcance = cmPendientesDe(scope, state);
  return saveToIdb(scope, state, null, true, alcance);
}

/** Borrador de SALIDA (H-02): pending solo si quedan colecciones sin confirmar contra la
 *  base — salir tras un guardado aceptado NO vuelve a marcar pendiente lo confirmado.
 *  Registra el alcance igual que saveCmDraft. @throws si IndexedDB falla: el llamador
 *  conserva la señal de error. */
export async function guardarCmSalida(
  scope: CmStorageScope,
  state: CivilManagerState,
): Promise<void> {
  const alcance = cmPendientesDe(scope, state);
  const ok = await saveToIdb(scope, state, null, alcance.length > 0, alcance);
  if (!ok) throw new Error('IndexedDB rechazó la escritura del borrador de salida.');
}

/** ¿Existe el respaldo legado de la era sin proyecto? (aviso one-shot, H-08). */
export const hayRespaldoAnterior = hayRespaldoLegado;

/** Recupera el estado del proyecto: borrador pendiente SUPERPUESTO sobre el servidor (H-01)
 *  cuando trae alcance registrado — las colecciones del alcance vienen del borrador, el
 *  resto del servidor (lo que otro cliente guardó sobrevive). Borrador LEGADO (sin alcance)
 *  se recupera entero, como siempre. La base confirmada es SIEMPRE lo del servidor. */
export async function civilManagerLoad(scope: CmStorageScope): Promise<CivilManagerState | null> {
  const draft = await loadFromIdb(scope);
  let remote: Awaited<ReturnType<typeof loadFromSupabase>>;
  try {
    remote = await loadFromSupabase(scope);
  } catch (error) {
    if (!draft) throw error;
    fijarBaseCm(scope, null); // sin base: el próximo guardado envía el estado completo
    return draft.state;
  }
  if (!remote) throw new Error('Proyecto no encontrado o sin acceso.');
  fijarBaseCm(scope, remote.state);
  if (draft?.pending) {
    if (draft.scope) return superponerColecciones(remote.state, draft.state, draft.scope);
    return draft.state; // legado: sin alcance registrado, estado entero del borrador
  }
  await saveToIdb(scope, remote.state, null, false);
  return remote.state;
}

/** Encola el guardado con el proyecto capturado al editar, incluso si cambia la ruta.
 *  El delta parcial se calcula contra la base confirmada AL EJECUTAR (H-01, dentro del RPC). */
export async function civilManagerSave(
  state: CivilManagerState,
  capturedScope?: CmStorageScope,
): Promise<void> {
  const scope = capturedScope ?? (await captureCmScope());
  if (!scope) return;
  const key = cmScopeKey(scope);
  const job = (saveQueues.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      // LWW (ped. usuario 2026-11-24): sin reloj — el borrador local SIEMPRE pisa la nube.
      const enVuelo = latestDrafts.get(key) ?? state;
      const local = await saveToIdb(scope, enVuelo, null, true, cmPendientesDe(scope, enVuelo));
      await saveToSupabase(state, scope).catch((error) => {
        if (local === false)
          throw new Error('No se pudo guardar en nube ni en el navegador.', { cause: error });
        throw error;
      });
      const latest = latestDrafts.get(key);
      const final = latest ?? state;
      const pendientes = cmPendientesDe(scope, final);
      await saveToIdb(scope, final, null, pendientes.length > 0, pendientes);
      if (latest === state && latestDrafts.get(key) === state) latestDrafts.delete(key);
    });
  saveQueues.set(key, job);
  try {
    await job;
  } finally {
    if (saveQueues.get(key) === job) saveQueues.delete(key);
  }
}
