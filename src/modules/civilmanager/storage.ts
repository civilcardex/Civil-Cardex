import { borradorPendiente, hayRespaldoLegado, loadFromIdb, saveToIdb } from './storage/idb.ts';
import { loadFromSupabase, saveToSupabase } from './storage/rpc.ts';
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

/** ¿Hay un borrador sin confirmar para este proyecto? (banner de conflicto, H-02). */
export const hayBorradorPendiente = borradorPendiente;

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
    return draft.state;
  }
  if (!remote) throw new Error('Proyecto no encontrado o sin acceso.');
  if (draft?.pending) return draft.state;
  await saveToIdb(scope, remote.state, null, false);
  return remote.state;
}

/** Encola el guardado con el proyecto capturado al editar, incluso si cambia la ruta. */
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
