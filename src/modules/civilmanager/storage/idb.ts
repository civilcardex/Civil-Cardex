import { devError } from '../../../utils/devError.ts';
import { idbTx, openIdb } from '../../../lib/idb';
import { migrateState } from './serialize.ts';
import type { CivilManagerState } from '../types.ts';
import { cmScopeKey, type CmStorageScope } from './session.ts';

/**
 * Respaldo local por cuenta y proyecto. Ej: abrir el proyecto B sin conexión nunca lee
 * el dibujo o presupuesto del proyecto A. El registro histórico queda reservado para recuperación.
 */
const DB_NAME = 'CivilManagerDB';
const STORE_NAME = 'state';
const DB_VERSION = 1;

interface StoredSnapshot {
  k: string;
  d: Partial<CivilManagerState>;
  version: string | null;
  pending: boolean;
}

export async function loadFromIdb(scope: CmStorageScope) {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    const record = await idbTx<StoredSnapshot | undefined>(db, STORE_NAME, 'readonly', (store) =>
      store.get(cmScopeKey(scope)),
    );
    return record
      ? { state: migrateState(record.d), version: record.version, pending: record.pending }
      : null;
  } catch (e) {
    devError('civilManagerStorage load IDB:', e);
    return null;
  }
}

export async function saveToIdb(
  scope: CmStorageScope,
  state: CivilManagerState,
  version: string | null,
  pending: boolean,
): Promise<boolean> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ k: cmScopeKey(scope), d: state, version, pending } satisfies StoredSnapshot),
    );
    return true;
  } catch (e) {
    devError('civilManagerStorage save IDB:', e);
    return false;
  }
}

/** ¿Queda un borrador sin confirmar para este proyecto? (aviso del banner de conflicto). */
export async function borradorPendiente(scope: CmStorageScope): Promise<boolean> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    const record = await idbTx<StoredSnapshot | undefined>(db, STORE_NAME, 'readonly', (store) =>
      store.get(cmScopeKey(scope)),
    );
    return !!record?.pending;
  } catch {
    return false;
  }
}

/** ¿Existe el respaldo LEGADO (registro 'civilmanager' de la era sin proyecto)? La app
 *  nunca lo lee para trabajar (aviso H-08): solo señala su existencia para recuperación
 *  manual (docs/save-rollout.md paso 4). */
export async function hayRespaldoLegado(): Promise<boolean> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    const record = await idbTx<(StoredSnapshot & { d: Partial<CivilManagerState> }) | undefined>(
      db,
      STORE_NAME,
      'readonly',
      (store) => store.get('civilmanager'),
    );
    if (!record) return false;
    const d = record.d ?? {};
    return [d.apus, d.equipos, d.insumos, d.cuadrillas].some(
      (xs) => Array.isArray(xs) && xs.length > 0,
    );
  } catch {
    return false;
  }
}
