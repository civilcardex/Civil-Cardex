import { devError } from '../../../utils/devError.ts';
import { idbTx, openIdb } from '../../../lib/idb';
import { migrateState } from './serialize.ts';
import type { CivilManagerState } from '../types.ts';

/**
 * Espejo local del estado CM en IDB (IndexedDB): carga y guardado offline. Un solo registro
 * ('civilmanager') con el estado completo. Ej: sin red, el usuario sigue trabajando y su
 * copia migra a la nube al reconectar (la orquesta civilManagerLoad).
 */
const DB_NAME = 'CivilManagerDB';
const STORE_NAME = 'state';
const DB_VERSION = 1;
const RECORD_KEY = 'civilmanager';

export async function loadFromIdb(): Promise<CivilManagerState | null> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    const record = await idbTx<{ k: string; d: Partial<CivilManagerState> } | undefined>(
      db,
      STORE_NAME,
      'readonly',
      (store) => store.get(RECORD_KEY),
    );
    return record ? migrateState(record.d) : null;
  } catch (e) {
    devError('civilManagerStorage load IDB:', e);
    return null;
  }
}

export async function saveToIdb(state: CivilManagerState): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'k');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ k: RECORD_KEY, d: state }),
    );
  } catch (e) {
    devError('civilManagerStorage save IDB:', e);
  }
}
