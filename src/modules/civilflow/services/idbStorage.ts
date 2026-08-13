import { devError } from '../../../utils/devError';
import { idbTx, openIdb } from '../../../lib/idb';

const DB_NAME = 'civilflow_plans';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

interface PDFRecord {
  id: number;
  name: string;
  data: ArrayBuffer;
}

/**
 * Guarda un archivo PDF en IndexedDB con clave numérica por id.
 * @param id - Identificador numérico del plano.
 * @param file - Objeto File PDF a persistir.
 */
export async function storePDF(id: number, file: File): Promise<void> {
  try {
    const data = await file.arrayBuffer();
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ id, name: file.name, data }),
    );
  } catch (e) {
    devError('idbStorage storePDF:', id, e);
  }
}

/**
 * Carga un archivo PDF de IndexedDB por id. Devuelve un objeto File con el nombre original
 * y el MIME type.
 * @param id - Identificador numérico del plano.
 * @returns Objeto File o null si no existe.
 */
export async function loadPDF(id: number): Promise<File | null> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    const record = await idbTx<PDFRecord | undefined>(db, STORE_NAME, 'readonly', (store) =>
      store.get(id),
    );
    if (!record) return null;
    return new File([record.data], record.name, { type: 'application/pdf' });
  } catch (e) {
    devError('idbStorage loadPDF:', id, e);
    return null;
  }
}

/**
 * Elimina todos los registros PDF del store de IndexedDB.
 */
export async function clearAllPDFs(): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) => store.clear());
  } catch (e) {
    devError('idbStorage clearAllPDFs:', e);
  }
}

/**
 * Elimina un registro PDF individual de IndexedDB por id.
 * @param id - Identificador numérico del plano.
 */
export async function deletePDF(id: number): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) => store.delete(id));
  } catch (e) {
    devError('idbStorage deletePDF:', id, e);
  }
}
