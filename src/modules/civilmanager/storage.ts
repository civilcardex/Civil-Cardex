import {
  archivarBorradorPendiente,
  borradorPendiente,
  hayRespaldoLegado,
  loadFromIdb,
  saveToIdb,
} from './storage/idb.ts';
import { loadFromSupabase, saveForzadoSupabase, saveToSupabase } from './storage/rpc.ts';
import { captureCmScope, cmScopeKey, type CmStorageScope } from './storage/session.ts';
import type { CivilManagerState } from './types.ts';

export { defaultState, migrateState } from './storage/serialize.ts';

const versions = new Map<string, string>();
const saveQueues = new Map<string, Promise<void>>();
const latestDrafts = new Map<string, CivilManagerState>();

/** Deja el borrador en disco antes del guardado diferido. */
export async function saveCmDraft(scope: CmStorageScope, state: CivilManagerState): Promise<void> {
  const key = cmScopeKey(scope);
  latestDrafts.set(key, state);
  await saveToIdb(scope, state, versions.get(key) ?? null, true);
}

/** ¿Hay un borrador sin confirmar para este proyecto? (banner de conflicto, H-02). */
export const hayBorradorPendiente = borradorPendiente;

/** ¿Existe el respaldo legado de la era sin proyecto? (aviso one-shot, H-08). */
export const hayRespaldoAnterior = hayRespaldoLegado;

/** Recupera un borrador del mismo proyecto y mantiene su versión base. */
export async function civilManagerLoad(scope: CmStorageScope): Promise<CivilManagerState | null> {
  const key = cmScopeKey(scope);
  const draft = await loadFromIdb(scope);
  let remote: Awaited<ReturnType<typeof loadFromSupabase>>;
  try {
    remote = await loadFromSupabase(scope);
  } catch (error) {
    if (!draft) throw error;
    if (draft.version) versions.set(key, draft.version);
    else versions.delete(key);
    return draft.state;
  }
  if (!remote) {
    versions.delete(key);
    throw new Error('Proyecto no encontrado o sin acceso.');
  }
  if (draft?.pending) {
    if (draft.version) versions.set(key, draft.version);
    else versions.delete(key);
    return draft.state;
  }
  versions.set(key, remote.version);
  await saveToIdb(scope, remote.state, remote.version, false);
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
      const version = versions.get(key) ?? null;
      const local = await saveToIdb(scope, latestDrafts.get(key) ?? state, version, true);
      if (!version) {
        throw new Error(
          local === false
            ? 'No se pudo guardar en el navegador y no se conoce la versión en nube.'
            : 'No se conoce la versión en nube. Se conservó tu borrador local.',
        );
      }
      const committedVersion = await saveToSupabase(state, scope, version).catch((error) => {
        if (local === false)
          throw new Error('No se pudo guardar en nube ni en el navegador.', { cause: error });
        throw error;
      });
      versions.set(key, committedVersion);
      const latest = latestDrafts.get(key);
      await saveToIdb(
        scope,
        latest ?? state,
        committedVersion,
        latest !== undefined && latest !== state,
      );
      if (latest === state && latestDrafts.get(key) === state) latestDrafts.delete(key);
    });
  saveQueues.set(key, job);
  try {
    await job;
  } finally {
    if (saveQueues.get(key) === job) saveQueues.delete(key);
  }
}

/** Resolución EXPLÍCITA del conflicto de versiones (H-02): hasta hoy un borrador pendiente
 *  ganaba siempre al cargar y cada guardado volvía a chocar sin salida dentro de la app.
 *  · 'nube'    → archiva el borrador (clave de rescate en IDB) y recarga desde Supabase.
 *  · 'borrador' → fuerza el guardado sin reloj (cm_save_state, firma conservada por la
 *                 migración 20261123000002) y confirma su nueva versión como base.
 * Devuelve el estado que debe montar el provider (null = nada que montar). */
export async function civilManagerResolverConflicto(
  scope: CmStorageScope,
  modo: 'nube' | 'borrador',
): Promise<CivilManagerState | null> {
  const key = cmScopeKey(scope);
  if (modo === 'nube') {
    await archivarBorradorPendiente(scope);
    versions.delete(key);
    latestDrafts.delete(key);
    const remote = await loadFromSupabase(scope);
    if (!remote) throw new Error('Proyecto no encontrado o sin acceso.');
    versions.set(key, remote.version);
    await saveToIdb(scope, remote.state, remote.version, false);
    return remote.state;
  }
  const draft = latestDrafts.get(key) ?? (await loadFromIdb(scope))?.state;
  if (!draft) return null;
  const committed = await saveForzadoSupabase(draft, scope);
  versions.set(key, committed);
  await saveToIdb(scope, draft, committed, false);
  latestDrafts.delete(key);
  return draft;
}
