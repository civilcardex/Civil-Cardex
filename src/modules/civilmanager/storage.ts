import { hayRespaldoLegado, loadFromIdb, saveToIdb } from './storage/idb.ts';
import { cmPendientesDe, fijarBaseCm, loadFromSupabase, saveToSupabase } from './storage/rpc.ts';
import { captureCmScope, cmScopeKey, type CmStorageScope } from './storage/session.ts';
import type { CivilManagerState } from './types.ts';

export { defaultState, migrateState } from './storage/serialize.ts';

const saveQueues = new Map<string, Promise<void>>();
const latestDrafts = new Map<string, CivilManagerState>();

/** Deja el borrador en disco antes del guardado diferido. */
export async function saveCmDraft(scope: CmStorageScope, state: CivilManagerState): Promise<void> {
  const key = cmScopeKey(scope);
  latestDrafts.set(key, state);
  await saveToIdb(scope, state, null, true);
}

/** Borrador de SALIDA (H-02): pending solo si quedan colecciones sin confirmar contra la
 *  base — salir tras un guardado aceptado NO vuelve a marcar pendiente lo confirmado.
 *  @throws si IndexedDB falla: el llamador conserva la señal de error. */
export async function guardarCmSalida(
  scope: CmStorageScope,
  state: CivilManagerState,
): Promise<void> {
  const pendiente = cmPendientesDe(scope, state).length > 0;
  await saveToIdb(scope, state, null, pendiente);
}

/** ¿Existe el respaldo legado de la era sin proyecto? (aviso one-shot, H-08). */
export const hayRespaldoAnterior = hayRespaldoLegado;

/** Recupera un borrador del mismo proyecto y mantiene su versión base. */
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
  /* La base confirmada es SIEMPRE lo que tiene el servidor (H-01): si hay borrador pendiente,
   * sus colecciones difieren de esta base y el primer guardado las incluye. */
  fijarBaseCm(scope, remote.state);
  if (draft?.pending) return draft.state;
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
      const local = await saveToIdb(scope, latestDrafts.get(key) ?? state, null, true);
      await saveToSupabase(state, scope).catch((error) => {
        if (local === false)
          throw new Error('No se pudo guardar en nube ni en el navegador.', { cause: error });
        throw error;
      });
      const latest = latestDrafts.get(key);
      await saveToIdb(scope, latest ?? state, null, latest !== undefined && latest !== state);
      if (latest === state && latestDrafts.get(key) === state) latestDrafts.delete(key);
    });
  saveQueues.set(key, job);
  try {
    await job;
  } finally {
    if (saveQueues.get(key) === job) saveQueues.delete(key);
  }
}
